import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// OPS-1148. The promotion pushed the target branch to production BEFORE it
// mirrored the Git LFS objects there. Production's pre-receive hook rejects a
// ref that references LFS objects the server does not already hold —
// `GH008: Your push referenced at least N unknown Git LFS objects` — and every
// push here uses `--no-verify`, which skips git-lfs's pre-push auto-upload, so
// the explicit mirror is the only thing that sends them.
//
// The bug was latent for as long as it existed: each successful run's mirror
// incidentally pre-uploaded the objects the NEXT promotion would reference, so
// the out-of-order push got away with it until a release finally added a new
// LFS object. Then it failed half-way — development refs advanced, production
// did not, and no production deploy ran. Two consecutive releases were lost
// that way before anyone noticed the order was wrong.
//
// These assertions exist so nobody "tidies" the two blocks back together.

const workflow = await readFile(
  new URL('../.github/workflows/promote-repo.yml', import.meta.url),
  'utf8',
);

const doc = await readFile(
  new URL('../docs/workflows/promoting-to-production.md', import.meta.url),
  'utf8',
);

/** Index of the one line containing `needle`, asserted present and unique. */
const soleLineIndex = (haystack, needle, label) => {
  const hits = haystack
    .split('\n')
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.includes(needle));

  assert.equal(
    hits.length,
    1,
    `expected exactly one ${label} line (matching ${JSON.stringify(needle)}), found ${hits.length}. ` +
      'If the command was renamed, update this test rather than deleting it — ' +
      'a needle that no longer matches would let the ordering regress silently.',
  );

  return hits[0].index;
};

test('the LFS objects are mirrored to production before the branch is pushed', () => {
  const mirror = soleLineIndex(workflow, 'git lfs push --all production', 'LFS mirror');
  const push = soleLineIndex(
    workflow,
    'git push --no-verify production "HEAD:${TARGET_BRANCH}"',
    'production branch push',
  );

  assert.ok(
    mirror < push,
    'promote-repo.yml must run `git lfs push --all production` BEFORE pushing the ' +
      'target branch to production. Production rejects a ref whose LFS objects it ' +
      'does not already hold (GH008), and `--no-verify` means nothing else uploads ' +
      `them. Found the mirror at line ${mirror + 1} and the push at line ${push + 1}.`,
  );
});

test('the local LFS cache is filled before anything is mirrored from it', () => {
  const fetch = soleLineIndex(workflow, 'git lfs fetch --all origin', 'LFS fetch');
  const mirror = soleLineIndex(workflow, 'git lfs push --all production', 'LFS mirror');

  assert.ok(
    fetch < mirror,
    'promote-repo.yml must `git lfs fetch --all origin` before `git lfs push --all ' +
      'production`, or the mirror runs against an empty cache and uploads nothing. ' +
      'This is the reason the fix is to move the PUSH down, never the fetch up.',
  );
});

test('both LFS steps stay behind the opt-in flag', () => {
  // `lfs` is opt-in: a repo that stores no binaries must not pay for either step.
  // Reordering must not have left one of them running unconditionally.
  for (const command of ['git lfs fetch --all origin', 'git lfs push --all production']) {
    const index = soleLineIndex(workflow, command, 'LFS');
    // Nearest preceding shell conditional. Match the trimmed line against real
    // tokens: a substring test would hit the `fi` inside an English word in one
    // of the comments above.
    const guard = workflow
      .split('\n')
      .slice(0, index)
      .reverse()
      .map((line) => line.trim())
      .find((line) => /^if \[/.test(line) || line === 'fi');

    assert.match(
      guard ?? '',
      /if \[ "\$\{WITH_LFS\}" = "true" \]/,
      `\`${command}\` must sit inside a \`WITH_LFS\` guard; the nearest preceding ` +
        `conditional was ${JSON.stringify(guard)}.`,
    );
  }
});

test('the promotion doc describes the same order as the workflow', () => {
  const mirror = soleLineIndex(doc, 'mirror LFS objects', 'documented LFS mirror');
  const push = soleLineIndex(doc, 'push main to the PRODUCTION org', 'documented production push');

  assert.ok(
    mirror < push,
    'docs/workflows/promoting-to-production.md must list the LFS mirror before the ' +
      'push to the production org, so the doc and the workflow cannot drift.',
  );
});
