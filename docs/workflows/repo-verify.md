# repo-verify: standard PR verification

Every repo on the platform verifies its pull requests the same way: a short stub
in the repo calls one reusable workflow that holds all the logic.

This page covers `repo-verify` specifically. What it has in common with every
other standard workflow — the stub/reusable split, keep blocks, installing and
staying current — is in
[standard-repo-workflows.md](standard-repo-workflows.md).

### Contents

<!-- vtxmd:toc from-level=2 to-level=2 -->
* [What you get](#what-you-get)
* [The stub](#the-stub)
* [The triggers, and the draft gate](#the-triggers-and-the-draft-gate)
* [What each target has to satisfy](#what-each-target-has-to-satisfy)
* [When a target needs the CLI itself](#when-a-target-needs-the-cli-itself)
* [No AWS session](#no-aws-session)
* [Its inputs and secrets](#its-inputs-and-secrets)
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

Each job is its own runner. It checks the repo out (submodules included,
recursively), installs Node and pnpm from the repo's own `.nvmrc` and
`packageManager`, runs `pnpm install --frozen-lockfile`, runs its one
`vortex:<concern>:all` target, and then requires the working tree to be
unchanged. That preamble is the `setup-vortex-repo` composite action; the tree
check is `assert-clean-tree`.

**Four jobs rather than four steps, so one run tells you everything.** Run
sequentially, a lint failure ends the run and you never learn whether the tests
pass — you fix lint, push, and meet the next failure a run later. Separate jobs
also mean separate check names, which is what a branch-protection rule keys off.

## The stub

The file `vortex repo gha install repo-verify` writes into your repo is
[`workflow-stubs/repo-verify.yml`](../workflow-stubs/repo-verify.yml) — read it
there rather than a copy here, which would be a second version to keep in step.

It is worth opening once. Every setting is written out at its default value with
a description block above it giving each one's name, default and effect, and that
block is refreshed on every `vortex repo gha update`, so it is the reference this
page deliberately does not duplicate.

## The triggers, and the draft gate

**The triggers are not yours to change.** They and the `if:` on the `verify` job
are the two halves of the draft gate, and both sit outside every `vtx:keep`
block. Leave one half repo-editable and a repo could end up holding just one — an
`if:` that skips drafts with no `ready_for_review` to fire when the draft is
marked ready, so the pull request never verifies at all.

| Type               | Why it is in the list                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| `opened`           | a pull request appears. Skipped while it is a draft.                                                        |
| `synchronize`      | a commit is pushed. **The one people delete as redundant** — without it, a PR that fails, gets fixed and is re-pushed never re-verifies, leaving a green tick on a tree that no longer exists. |
| `reopened`         | a closed pull request comes back.                                                                           |
| `ready_for_review` | a draft is marked ready. The run that matters: the first full verification of the finished tree.             |

That trap in the `synchronize` row is live elsewhere on the platform; see
[platform-gotchas.md](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/platform-gotchas.md).

**The draft gate: a draft pull request does not verify.** Review is iterative,
and without the gate every push during a review fires the full four-job fan-out.
With it, iteration is free and the runners are spent once — on the tree the
review finished with. Marking the PR ready fires `ready_for_review` and the run
happens then; a push to an already-ready PR still re-verifies through
`synchronize`. The gate buys cheap iteration, never a way to merge something
unverified.

A gated push still _creates_ a run: it completes as `skipped` in about two
seconds, having claimed no runner. While a PR is a draft the only check on it is
`verify` (skipped) — the four inner job checks do not exist at all. **A
branch-protection rule must therefore require the four job names, never
`verify`**: a rule keyed on `verify` would be satisfied by a skipped one.

The `github.event_name` half of the condition keeps `workflow_dispatch` working,
where there is no `pull_request` payload to read `draft` from.

**`workflow_dispatch` runs verification on demand**, against a branch you pick —
useful for re-checking a branch after a change to the shared workflow lands, or
for checking one that has no PR open yet. GitHub only surfaces the "Run workflow"
button once the file is on the repo's default branch, so it will not appear on
the PR that first installs the stub.

## What each target has to satisfy

The targets themselves are defined in
[script-targets.md](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/script-targets.md).
What this workflow additionally requires of them:

| Target                | Requirement                                                       |
| --------------------- | ----------------------------------------------------------------- |
| `vortex:lint:all`     | Read-only. Must not modify the tree.                              |
| `vortex:test:all`     | Read-only, and **must run without credentials** (see below).      |
| `vortex:generate:all` | Mutates by design; the tree must be clean afterwards.             |
| `vortex:build:all`    | Skipped by default (`skip-build`); its output must be gitignored. |

**A dirty tree fails the job — every job.** After its target, each job stages
everything and fails if anything changed. Staging first is deliberate: a _new_
file counts as drift, not only a modified one, and `git diff` alone would ignore
an untracked path — which is exactly how a newly generated file would slip
through.

One check, four reasons it fires:

| Job        | A dirty tree means                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| `lint`     | the target modified something. `lint` is a read-only concern — mutating fixes belong in `vortex:lint:fix`. |
| `test`     | the test battery wrote into the repo. Write to a temp dir, or gitignore the output.                        |
| `generate` | a source was edited without regenerating. Run the target locally and commit the result.                    |
| `build`    | build output is not gitignored. Artifacts are never committed.                                             |

The read-only concerns were always required not to modify the tree; this is the
first time it is enforced rather than documented. **Expect adoption to find
something.** A job that fails here is reporting a real defect in the repo, not a
strict check working. Fix the target or ignore the output; don't weaken the
check.

## When a target needs the CLI itself

Some `vortex:<concern>:all` targets shell out to a bare `vortex` —
`vortex:generate:all` does in the infra repos. **Nothing to configure:**
`setup-vortex-repo` asks whether the repo supplies the CLI, and installs it when
it does not.

The question it asks is whether `node_modules/.bin/vortex` exists, which is where
`pnpm install` links a dependency's binary and where a `vortex:*` target finds
it, since pnpm puts that directory on PATH when it runs a script. Present,
nothing happens. Absent, the CLI is fetched globally.

There used to be an `install-vortex-cli` input for this, and forgetting to set it
produced a failure with nothing to point at. Whether a repo carries
`config-utility` as a dependency stays that repo's decision — the workflow just
adapts to the answer.

One caveat: the install is skipped when no `npm-token` is available, because it
could not succeed. A target that then needs `vortex` fails on its own and says
so.

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

## Its inputs and secrets

All optional, and the stub is where they are documented — see
[Inputs and secrets](standard-repo-workflows.md#inputs-and-secrets) for why a
table here would rot.

There is one setting per job, named for the target it runs:

|                                           |                                                     |
| ----------------------------------------- | --------------------------------------------------- |
| `skip-lint`, `skip-test`, `skip-generate` | default `false` — the job runs                      |
| `skip-build`                              | default `true` — the one job most repos do not want |

Plus `node-version` (empty means read `.nvmrc`) and `submodules` (`recursive`).
Read the stub for what each does.

| Secret      | Required when                                                                                                                                                                                                                                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ssh-key`   | The repo has submodules. `.gitmodules` uses SSH URLs here, which the default workflow token cannot satisfy — without a key, checkout silently produces an empty submodule directory.                                                                                                                                                                 |
| `npm-token` | The repo installs a package from the `@teamvortexsoftware` scope. Pass `secrets.NPM_READ_TOKEN` — the read credential is an **org-level** Actions secret under that name, so every repo has it. `NPM_TOKEN` is a repo-level secret on the two `infra-data` repos only. Written to the runner's user-level `~/.npmrc`, never the repo's committed one. |

**It is `NPM_READ_TOKEN`, not `NPM_TOKEN`.** Getting this wrong is quiet rather
than loud: the token resolves to an empty string, npm answers an unauthenticated
private-package request with **404 rather than 401**, and the run fails with
`ERR_PNPM_FETCH_404` on a package that plainly exists.

The stub already passes both secrets and every setting, so changing one means
editing the value that is already there, between the `vtx:keep inputs` markers —
never adding a `with:` block of your own.

## Adopting it in a repo

1. **Install the profile** if the repo doesn't have one — `vortex repo profile apply`
   gives it `package.json`, `.nvmrc`, `.npmrc` and the `vortex:*`
   placeholders. See [script-targets.md](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/script-targets.md).
2. **Plumb the targets you actually have.** A placeholder is a free pass, so
   plumbing is what makes verification mean anything. Start with
   `vortex:generate:all` — it is the one that catches real drift.
3. **Install the stub** — `vortex repo gha install repo-verify`. It says so if a
   target the workflow runs is missing from `package.json`, and points at
   `vortex repo profile apply`. Advisory: the install still succeeds.
4. **Add secrets** if the repo needs them, per the table.
5. **Open a PR and watch the four checks run.** If one fails on first adoption,
   that is the workflow doing its job — something in the repo was already stale,
   or a target you believed was read-only isn't.

## Where things live

- The reusable workflow: `platform-actions/.github/workflows/repo-verify.yml`
- The stub to install: `platform-actions/workflow-stubs/repo-verify.yml` —
  fetched from here by `vortex repo gha install`, so this is the only copy
- The composite actions it builds on:
  `platform-actions/actions/setup-vortex-repo/` and
  `platform-actions/actions/assert-clean-tree/`
- The target definitions:
  [script-targets.md](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/script-targets.md)
- The family contract: [standard-repo-workflows.md](standard-repo-workflows.md)
