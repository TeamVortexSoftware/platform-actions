# Releasing artifacts and updating a Homebrew formula

A repo that ships a compiled artifact calls one reusable workflow to build it,
attach it to a GitHub Release, and point a Homebrew formula at it. The logic
lives in `platform-actions`, so the next tool distributed this way reuses it
rather than copying it.

### Contents

<!-- vtxmd:toc from-level=2 to-level=2 -->
* [What it does](#what-it-does)
* [The build stays in the repo](#the-build-stays-in-the-repo)
* [When the build needs the CLI itself](#when-the-build-needs-the-cli-itself)
* [Three fields move together](#three-fields-move-together)
* [The tap credential](#the-tap-credential)
* [The caller grants the permission](#the-caller-grants-the-permission)
* [Inputs and secrets](#inputs-and-secrets)
* [Nothing private is hardcoded here](#nothing-private-is-hardcoded-here)
* [Gotcha: a stale Homebrew cache hides download failures](#gotcha-a-stale-homebrew-cache-hides-download-failures)
* [Installing it](#installing-it)
* [Where things live](#where-things-live)
<!-- vtxmd:end -->

## What it does

1. **Guard.** Checks out the tag and asserts its `package.json` version matches
   the version being released. A GitHub Release is visible the instant it is
   created, so this runs before anything is built.
2. **Build.** One job per target, running the repo's own `vortex:build:all` with
   `VORTEX_BUILD_TARGET` set. Then it asserts artifacts actually appeared — a
   placeholder target exits 0 and would otherwise produce an empty release.
3. **Release.** Creates the Release at that tag and uploads every artifact.
4. **Tap.** Rewrites the formula and pushes it.

It **releases a version that already exists.** It never bumps a version, edits a
changelog, or publishes to npm. Those belong to the repo's release script, which
is what dispatches this.

## The build stays in the repo

This workflow never runs a compiler. It sets `VORTEX_BUILD_TARGET` and calls
`vortex:build:all`, because shared workflows call `vortex:<concern>:all` and
nothing narrower — see
[script-targets.md](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/script-targets.md).

The repo decides what building for a target means. That is what keeps this file
free of any one toolchain, and what lets a repo change how it compiles without
touching `platform-actions`.

## When the build needs the CLI itself

Nothing to configure. If the repo does not supply the CLI itself, the build job
installs it before running the target — the same behaviour, and the same
reasoning, as the verification workflow. See
[repo-verify.md](repo-verify.md).

Unlike verification, this workflow calls `vortex:build:all` **without**
`--if-present`, so a repo that has not plumbed that target fails the release
rather than producing an empty one. The stub declares the dependency —
`# vtx:requires vortex:build:all` — so `vortex repo gha install` says something
at install time instead of leaving it to a release.

## Three fields move together

A formula pointing at a **private** release asset references it by numeric asset
id, because only the asset API endpoint serves private assets to a token. GitHub
assigns a fresh id on every upload. So each release rewrites three things:

| Field | Why it changes |
| --- | --- |
| `version` | the release being described |
| the asset id in `url` | GitHub assigns a new one per upload |
| `sha256` | a new binary |

Rewriting only some of them yields a formula that installs the *previous* binary
under the *new* version number — which is why the tap job asserts all three
landed rather than trusting its own regexes.

## The tap credential

The job's own `GITHUB_TOKEN` cannot reach a second repository. Updating a formula
in a tap therefore needs a separate credential with `contents: write` on the tap
repo, passed as the `tap-token` secret.

Wire it through core infrastructure — `global_env_vars.repository_secrets` in
`infra-data-*/data/core-infra/repos.yml` — not through the GitHub UI, so it is
declared like every other platform secret.

## The caller grants the permission

The stub carries `permissions: contents: write`. A called workflow can hold no
more permission than its caller grants, and repos on this platform default to
read-only — so a stub without that block fails **at startup**, before any job
runs, reporting only "This run likely failed because of a workflow file issue".
There is no log to read, because nothing started.

`repo-verify` needs no equivalent because it only reads.

## Inputs and secrets

| Input | Required | Means |
| --- | --- | --- |
| `version` | yes | version being released, no leading `v` |
| `tag` | yes | existing tag to release from |
| `targets` | yes | JSON array of build targets; one job each |
| `artifact-glob` | no | where the repo leaves artifacts (default `dist-binary/*`) |
| `tap-repo` | no | `owner/name` of the tap; omit to publish artifacts with no formula |
| `formula-path` | no | path to the formula within the tap |
| `asset-pattern` | no | glob picking the one asset the formula points at |
| `node-version` | no | defaults to the repo's `.nvmrc` |
| `submodules` | no | passed to `actions/checkout` |

| Secret | Required | Means |
| --- | --- | --- |
| `tap-token` | when `tap-repo` is set | `contents: write` on the tap repo |
| `npm-token` | when the repo installs from the private scope | read access |
| `ssh-key` | when the repo has private submodules | read access |

## Nothing private is hardcoded here

`platform-actions` is a **public** repository. Every repository, owner, tap and
formula name arrives as an input for that reason. A hardcoded name would publish
the platform's private topology to anyone who looks.

## Gotcha: a stale Homebrew cache hides download failures

Verifying an install by hand proves nothing if brew still holds the artifact from
an earlier successful fetch — it will install happily with no credentials at all.
Remove `brew --cache <formula>` first, or the check is theatre.

## Installing it

Install it with the CLI, from the repo that is adopting it:

```bash
vortex repo gha install repo-release   # writes .github/workflows/vtx-repo-release.yml
```

Then set the per-repo values — `targets`, `artifact-glob`, `tap-repo`,
`formula-path`, `asset-pattern`. They sit inside the stub's `# vtx:keep inputs`
block, which is what makes them survive `vortex repo gha update`: everything
outside a block is refreshed from the published stub, everything inside is
yours. A repo that ships artifacts but no formula clears `tap-repo`,
`formula-path` and `asset-pattern` and keeps the rest.

## Where things live

- The reusable workflow: `platform-actions/.github/workflows/repo-release.yml`
- The stub to install: `platform-actions/workflow-stubs/repo-release.yml` —
  fetched from here by `vortex repo gha install`, so this is the only copy
- The target definitions: [script-targets.md](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/script-targets.md)
- PR verification, the sibling workflow: [repo-verify.md](repo-verify.md)
- The family contract: [standard-repo-workflows.md](standard-repo-workflows.md)
