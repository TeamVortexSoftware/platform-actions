# Standard repo workflows

Every repo on the platform verifies its pull requests the same way: a six-line
stub in the repo calls one reusable workflow that holds all the logic. Adopting
it is a copy-paste plus whatever plumbing the repo's own targets need.

### Contents

<!-- vtxmd:toc from-level=2 to-level=2 -->
* [What you get](#what-you-get)
* [The stub](#the-stub)
* [What each target has to satisfy](#what-each-target-has-to-satisfy)
* [No AWS session](#no-aws-session)
* [Inputs and secrets](#inputs-and-secrets)
* [Adopting it in a repo](#adopting-it-in-a-repo)
* [Where things live](#where-things-live)
<!-- vtxmd:end -->

## What you get

```
repo's PR  →  .github/workflows/verify.yml   (the stub, in your repo)
                        ↓  uses:
              platform-actions/.github/workflows/repo-verify.yml   (all the logic)
                        ↓  runs
              vortex:lint:all · vortex:test:all · vortex:generate:all
```

The split is the point. When what verification _means_ changes, the reusable
workflow changes and **no consuming repo is touched**.

The reusable workflow checks the repo out (submodules included, recursively),
installs Node and pnpm from the repo's own `.nvmrc` and `packageManager`, runs
`pnpm install --frozen-lockfile`, then runs the targets. Every target is invoked
with `pnpm run --if-present`, which exits 0 when a script is undefined — so the
whole set is called unconditionally and a repo implementing only part of it still
passes.

## The stub

Create `.github/workflows/verify.yml` in your repo:

```yaml
# From the vortex 'repo-verify' workflow template.
# See platform-actions/docs/standard-repo-workflows.md
name: verify

on:
    pull_request:

jobs:
    verify:
        uses: TeamVortexSoftware/platform-actions/.github/workflows/repo-verify.yml@main
```

Keep the two comment lines. They cost nothing and they are how a file is
recognised later as coming from a template.

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
| `vortex:build:all`    | Opt-in, and never part of the clean-tree check.              |

**The clean-tree check is the sharp edge.** After `vortex:generate:all`, the
workflow stages everything and fails if anything changed — a new generated file
counts, not just a modified one. A failure means somebody edited a source and
didn't regenerate; the fix is to run the target locally and commit the result.

`vortex:build:all` runs _after_ that check, and only when you ask for it. Build
output isn't committed, so a dirty tree after building means `dist/` isn't
ignored — a different bug, and one you don't want reported as a drift failure.

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
| `skip-generate-check` | `false`     | Adopting before your generators are honest. Temporary.   |
| `run-build`           | `false`     | A PR should prove the artifact still builds.             |

| Secret      | Required when                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ssh-key`   | The repo has submodules. `.gitmodules` uses SSH URLs here, which the default workflow token cannot satisfy — without a key, checkout silently produces an empty submodule directory. |
| `npm-token` | The repo installs a package from the `@teamvortexsoftware` scope. Written to the runner's user-level `~/.npmrc`, never the repo's committed one.                                     |

Passing them looks like this:

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
3. **Add the stub** above.
4. **Add secrets** if the repo needs them, per the table.
5. **Open a PR and watch it run.** If `vortex:generate:all` fails on first
   adoption, that is the workflow doing its job — something in the repo was
   already stale.

## Where things live

- The reusable workflow: `platform-actions/.github/workflows/repo-verify.yml`
- The target definitions: [script-targets.md](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/script-targets.md)
