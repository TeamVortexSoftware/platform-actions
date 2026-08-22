# CLAUDE.md

Guidance for Claude Code working in **platform-actions**.

## This repository is PUBLIC

**Everything committed here is world-readable.** Treat every file as published
the moment it lands on `main`.

That is deliberate, not an oversight: a reusable workflow in a *private* repo can
only be called from repos in the same GitHub organization, and this platform
spans two (`TeamVortexSoftware` and `vortex-production`). GitHub's repo-level
Actions `access_level` is `none` / `organization` / `enterprise` with no
per-organization allowlist, and `enterprise` needs both orgs under one GitHub
Enterprise account — which the `team` plan does not provide. Public is what makes
one shared workflow serve both orgs.

**What that means in practice.** Secret *values* never belong in a workflow file
anywhere, so that part is unchanged. What changes is that **structure is
published too**: domain names, secret paths, AWS account aliases, role names,
bucket names, internal hostnames. Those are the things that get typed into a
workflow without a second thought, and here they are visible to anyone.

This matters most for the **scheduled automation** this repo is slated to host —
Let's Encrypt certificate issuance and renewal, and similar. That kind of
workflow names domains and secret paths as a matter of course.

Before committing, ask what a reader outside the company learns from the file. If
the answer includes anything about how our infrastructure is laid out, pass it in
as an input or a secret from the calling repo instead of writing it here.

## What lives here

- **Reusable workflows** (`.github/workflows/*.yml` with `on: workflow_call`) —
  called by workflows in the platform repos and the service repos.
- **Composite actions** — the same idea at step granularity.
- **Scheduled automation** — workflows on a `schedule:` trigger that run *here*
  rather than in a service repo, because they belong to the platform rather than
  to any one service.
- **`workflow-stubs/`** — the caller workflow a consuming repo installs, one per
  shared workflow. Copied in unedited: every value that can be pre-set resolves
  from an organization-level Actions variable or from the `github` context, so a
  service repo adopting one configures nothing. Each carries a header comment and
  an end-of-stub marker so the file stays recognisable as coming from a template.

  **A stub lands under a fixed name**: `.github/workflows/vtx-<shared-workflow-name>.yml`,
  with `name: "[VTX] <Title Case Name>"`. So `repo-verify.yml` installs as
  `vtx-repo-verify.yml` named `[VTX] Repo Verify`. The prefixes are what make a
  shared workflow identifiable in a repo that has forty of its own — in the
  directory listing, the Actions sidebar and the PR check list. `repo-release`
  and `promote-repo` predate the convention and do not follow it yet.
- **`docs/`** — how to *call* what lives here: the caller stub, inputs, secrets
  and failure modes, one doc per shared workflow. These sit beside the workflow
  they describe rather than in the umbrella, because their subject is one
  artifact in this repo. A wide audience is not what makes a doc cross-repo —
  see the home rules in the umbrella's `docs/documentation-map.md`. The umbrella
  keeps a pointer so they stay findable from the hub.

  Platform-wide context those docs assume — the `vortex:*` target namespace, why
  production lives in a second GitHub organization — stays in the umbrella. That
  split is also what keeps organization names and topology out of this public
  repo.

Nothing here is built, published, or deployed on its own. It is consumed by
reference (`uses:`), so a change to a workflow on `main` reaches every consumer
that tracks `@main` on its next run — there is no release step between the two.
That is the trade for keeping the logic in one place: **a broken workflow on
`main` breaks every consuming repo's PRs at once.**

## The `vortex:*` targets

`repo-verify.yml` runs a repo's `vortex:<concern>:all` scripts. The namespace,
what each concern means, and which of them mutate are defined in
`platform-repos/docs/script-targets.md`. The caller stub and adoption steps are
in `docs/standard-repo-workflows.md`.

Do not encode a repo's specifics in a shared workflow — that is what the targets
exist to avoid. If a workflow needs to know something repo-shaped, it becomes an
input.

## Repo conventions

- Part of the [platform-repos](https://github.com/TeamVortexSoftware/platform-repos)
  umbrella, as a git submodule. Cross-repo work starts there.
- Base branches are read-only: push a `feature/*` branch and open a PR; JJ merges.
- Pin third-party actions by commit SHA with a version comment, as
  `repo-verify.yml` does for `pnpm/action-setup`. First-party `actions/*` are
  pinned by major tag.

## A reusable workflow cannot reach its own repo relatively

A reusable workflow here refers to this repo's composite actions by full
`TeamVortexSoftware/platform-actions/actions/<name>@main`, never `./actions/<name>`.
A relative `uses:` resolves against the **caller's** checkout, not this
repository's, so the local form simply is not there.

The consequence bites on a feature branch: **a change that adds a composite
action and calls it from a reusable workflow in the same commit cannot be
verified before merge.** The workflow is read from your branch, but its `@main`
action references resolve against `main`, where the new action does not exist
yet — every job fails with `Can't find 'action.yml' … for action …@main`.

To prove such a change, temporarily point both the consuming repo's stub *and*
the workflow's own `uses:` lines at the feature ref, then revert both before
merge. Repointing only the stub is not enough.
