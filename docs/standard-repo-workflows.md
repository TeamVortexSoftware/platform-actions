# Standard repo workflows

Every repo on the platform verifies its pull requests the same way: a short stub
in the repo calls one reusable workflow that holds all the logic. Adopting it is
a copy-paste plus whatever plumbing the repo's own targets need.

### Contents

<!-- vtxmd:toc from-level=2 to-level=2 -->
* [What you get](#what-you-get)
* [The stub](#the-stub)
* [What each target has to satisfy](#what-each-target-has-to-satisfy)
* [When a target needs the CLI itself](#when-a-target-needs-the-cli-itself)
* [No AWS session](#no-aws-session)
* [Inputs and secrets](#inputs-and-secrets)
* [Adopting it in a repo](#adopting-it-in-a-repo)
* [Where things live](#where-things-live)
<!-- vtxmd:end -->

## What you get

```
repo's PR  →  .github/workflows/vtx-repo-verify.yml   (the stub, in your repo)
                        ↓  uses:
              platform-actions/.github/workflows/repo-verify.yml   (all the logic)
                        ↓  runs, as four concurrent jobs
              lint        test        generate        build
```

The split is the point. When what verification _means_ changes, the reusable
workflow changes and **no consuming repo is touched**.

Each job is its own runner. It checks the repo out (submodules included,
recursively), installs Node and pnpm from the repo's own `.nvmrc` and
`packageManager`, runs `pnpm install --frozen-lockfile`, runs its one
`vortex:<concern>:all` target, and then requires the working tree to be
unchanged. That preamble is the `setup-vortex-repo` composite action; the
tree check is `assert-clean-tree`.

**Four jobs rather than four steps, so one run tells you everything.** Run
sequentially, a lint failure ends the run and you never learn whether the tests
pass — you fix lint, push, and meet the next failure a run later. Separate jobs
also mean separate check names, which is what a branch-protection rule keys off.

Every target is invoked with `pnpm run --if-present`, which exits 0 when a script
is undefined. The default repo profile ships every `vortex:<concern>:all` as a
runnable `echo` placeholder for the repo's keeper to fill in, so the targets are
expected to be there — `--if-present` is the safety net, not the design.

## The stub

Copy [`workflow-stubs/repo-verify.yml`](../workflow-stubs/repo-verify.yml) into
your repo as **`.github/workflows/vtx-repo-verify.yml`**, unedited:

```yaml
# From the vortex 'repo-verify' workflow template. Install as vtx-repo-verify.yml.
# See platform-actions/docs/standard-repo-workflows.md
name: "[VTX] Repo Verify"

on:
    pull_request:

jobs:
    verify:
        # `uses:` cannot take an expression, so this one org is a literal.
        uses: TeamVortexSoftware/platform-actions/.github/workflows/repo-verify.yml@main
        secrets:
            ssh-key: ${{ secrets.SSH_PRIVATE_KEY }}
            npm-token: ${{ secrets.NPM_TOKEN }}

####   End of Stub  ----  Make all edits below this line  #####
```

**The filename and the `name:` are the convention, not a preference.** Every
shared workflow lands as `vtx-<shared-workflow-name>.yml` with
`name: "[VTX] <Title Case Name>"`, so that in a repo carrying forty workflows of
its own you can tell at a glance which came from here — in the directory
listing, the Actions sidebar and the PR check list alike.

Keep the header comment lines and the end-of-stub marker. They cost nothing and
they are how a file is recognised later as coming from a template.

Both secrets are optional and both resolve to empty when the repo has no such
secret, which is what lets the stub go in unedited either way.

**Leave `on: pull_request` bare.** That gives the default trigger set —
`opened`, `synchronize`, `reopened` — which is what verification wants. Adding
`types: [opened]` would mean a PR that fails, gets fixed and re-pushed never
re-verifies, leaving a green tick on a tree that no longer exists. That trap is
live elsewhere on the platform; see
[platform-gotchas.md](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/platform-gotchas.md).

`@main` is deliberate: consumers track the workflow as it moves. Pin to a tag
only if a repo needs to lag behind on purpose.

## What each target has to satisfy

The targets themselves are defined in
[script-targets.md](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/script-targets.md). What this workflow additionally
requires of them:

| Target                | Requirement                                                  |
| --------------------- | ------------------------------------------------------------ |
| `vortex:lint:all`     | Read-only. Must not modify the tree.                         |
| `vortex:test:all`     | Read-only, and **must run without credentials** (see below). |
| `vortex:generate:all` | Mutates by design; the tree must be clean afterwards.        |
| `vortex:build:all`    | Opt-in; its output must be gitignored.                       |

**A dirty tree fails the job — every job.** After its target, each job stages
everything and fails if anything changed. Staging first is deliberate: a *new*
file counts as drift, not only a modified one, and `git diff` alone would ignore
an untracked path — which is exactly how a newly generated file would slip
through.

One check, four reasons it fires:

| Job | A dirty tree means |
| --- | --- |
| `lint` | the target modified something. `lint` is a read-only concern — mutating fixes belong in `vortex:lint:fix`. |
| `test` | the test battery wrote into the repo. Write to a temp dir, or gitignore the output. |
| `generate` | a source was edited without regenerating. Run the target locally and commit the result. |
| `build` | build output is not gitignored. Artifacts are never committed. |

The read-only concerns were always required not to modify the tree; this is the
first time it is enforced rather than documented. **Expect adoption to find
something** — a coverage file, a cache, a fixture written in place. That is the
check working. Fix the target or ignore the output; don't weaken the check.

`vortex:build:all` no longer has to run last. It used to, so its uncommitted
output could not be reported as generate's drift — with one job per concern that
confusion is structurally impossible, since each job has its own checkout. So
build is held to the same rule and gives an honest message of its own.

## When a target needs the CLI itself

Some `vortex:<concern>:all` targets shell out to a bare `vortex` —
`vortex:generate:all` does in the infra repos. Set `install-vortex-cli: true`
and every job puts the CLI on PATH before running its target, via
`setup-vortex-repo`, which defers to the `setup-vortex-cli` composite action.

It installs **globally** and never reaches into `node_modules`. Whether a repo
also carries `config-utility` as a dependency is that repo's own decision, and a
shared workflow that relied on it would quietly do different things in different
repos.

There is **no version pin**. A runner starts clean every time, so latest is both
the simplest thing to install and the most current — which also means the CLI's
own staleness gate never has cause to fire in CI. A pin would be one more number
to remember to bump, and its staleness would surface as a CI failure nobody was
expecting.

It checks before installing, so a job that already has the CLI pays nothing. It
needs the `npm-token` secret, and fails with a clear message rather than a later
`command not found` if the token is missing or the install lands off PATH.

## No AWS session

**Nothing in this workflow gets AWS credentials.** A shared workflow that every
repo calls is the wrong place to hold a role.

If a repo's test suite needs the vault, that is for the repo to solve inside its
own target — by scoping `vortex:test:all` to the credential-free suites, or by
keeping the vault-backed run in a separate workflow that does configure a role.
`config-utility` is the live example: several of its suites reach AWS, so its
`vortex:test:all` is deliberately still a placeholder while `vortex:lint:all` and
`vortex:generate:all` are plumbed.

## Inputs and secrets

All optional.

| Input                 | Default     | Use it when                                              |
| --------------------- | ----------- | -------------------------------------------------------- |
| `node-version`        | `.nvmrc`    | You need to override the repo's pinned version.          |
| `submodules`          | `recursive` | Set `false` in a repo with no submodules to save a step. |
| `skip-generate-check` | `false`     | Adopting before your generators are honest. Temporary — it skips the whole `generate` job. |
| `run-build`           | `false`     | A PR should prove the artifact still builds. Off means the `build` job reports skipped. |
| `install-vortex-cli`  | `false`     | A target shells out to a bare `vortex`. Requires `npm-token`. |

| Secret      | Required when                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ssh-key`   | The repo has submodules. `.gitmodules` uses SSH URLs here, which the default workflow token cannot satisfy — without a key, checkout silently produces an empty submodule directory. |
| `npm-token` | The repo installs a package from the `@teamvortexsoftware` scope. Written to the runner's user-level `~/.npmrc`, never the repo's committed one.                                     |

The stub already passes both secrets. An input is added below the job's `uses:`
line:

```yaml
jobs:
    verify:
        uses: TeamVortexSoftware/platform-actions/.github/workflows/repo-verify.yml@main
        with:
            run-build: true
        secrets:
            ssh-key: ${{ secrets.SSH_PRIVATE_KEY }}
            npm-token: ${{ secrets.NPM_TOKEN }}
```

## Adopting it in a repo

1. **Install the profile** if the repo doesn't have one — `vortex repo profile apply`
   gives it `package.json`, `.nvmrc`, `.npmrc` and the `vortex:*`
   placeholders. See [script-targets.md](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/script-targets.md).
2. **Plumb the targets you actually have.** A placeholder is a free pass, so
   plumbing is what makes verification mean anything. Start with
   `vortex:generate:all` — it is the one that catches real drift.
3. **Install the stub** above, as `.github/workflows/vtx-repo-verify.yml`.
4. **Add secrets** if the repo needs them, per the table.
5. **Open a PR and watch the four checks run.** If one fails on first adoption,
   that is the workflow doing its job — something in the repo was already stale,
   or a target you believed was read-only isn't.

## Where things live

- The reusable workflow: `platform-actions/.github/workflows/repo-verify.yml`
- The stub to install: `platform-actions/workflow-stubs/repo-verify.yml`
- The composite actions it builds on: `platform-actions/actions/setup-vortex-repo/`
  and `platform-actions/actions/assert-clean-tree/`
- The target definitions: [script-targets.md](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/script-targets.md)
