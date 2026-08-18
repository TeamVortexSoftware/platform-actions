# Promoting a repo to production

Some services keep production in a **separate GitHub organization**. Development
happens on `develop` in the development org; production is a second copy of the
repo in the production org, and shipping means promoting one to the other.

> This repository is public, so the production organization is written below as
> `<production-org>`. The concrete value, and which services use this pattern,
> are in the platform-repos docs hub.

Promotion is a manual button, not a branch push. A short stub in the production
copy calls one reusable workflow that holds all the logic.

### Contents

<!-- vtxmd:toc from-level=2 to-level=2 -->
* [What it does](#what-it-does)
* [Why the stub lives in the production repo](#why-the-stub-lives-in-the-production-repo)
* [The stub](#the-stub)
* [The token must be a PAT](#the-token-must-be-a-pat)
* [Inputs and secrets](#inputs-and-secrets)
* [When a promotion fails](#when-a-promotion-fails)
* [Where things live](#where-things-live)
<!-- vtxmd:end -->

## What it does

```
you dispatch  →  .github/workflows/promote.yml   (the stub, in the PRODUCTION repo)
                        ↓  uses:
              platform-actions/.github/workflows/promote-repo.yml   (all the logic)
                        ↓
              FF develop → main on the DEVELOPMENT repo
              push main to the development origin      (deploy-inert)
              push main to the PRODUCTION org          (fires the deploys)
```

The workflow deploys nothing itself. **Pushing the target branch to the
production organization is what triggers that repo's deploy workflows** — the
promotion just moves refs.

Both hops are `--ff-only`. The two branches must never diverge, and a
fast-forward that cannot happen fails loudly rather than inventing a merge
commit.

## Why the stub lives in the production repo

The stub gets mirrored into the development repo by the promotion itself, since
the two repos hold the same content. It must therefore be **inert** in the
development org, which is what the `VTX_INFRA_ENV` gate below does — dispatching
it there is a skipped no-op.

Firing it from the production side is also the honest place for the button: one
action, in the org that is about to change.

## The stub

Create `.github/workflows/promote.yml`:

```yaml
# From the vortex 'promote-repo' workflow template.
# See platform-actions/docs/promoting-to-production.md
name: promote

on:
  workflow_dispatch:

jobs:
  promote:
    # Production org only — inert in the development mirror of this file.
    if: ${{ vars.VTX_INFRA_ENV == 'production' }}
    uses: TeamVortexSoftware/platform-actions/.github/workflows/promote-repo.yml@main
    with:
      dev-owner: TeamVortexSoftware
      dev-repo: your-repo
      prod-owner: <production-org>
      prod-repo: your-repo
    secrets:
      bot-token: ${{ secrets.GHCR_TOKEN }}
```

Keep the two comment lines. They cost nothing and they are how a file is
recognised later as coming from a template.

**Keep the trigger `workflow_dispatch` only.** Manual promotion is the deliberate
gate — production will not update any other way. No `push`, `schedule` or
`repository_dispatch`.

## The token must be a PAT

`bot-token` cannot be the default `GITHUB_TOKEN`.

A push authored by `GITHUB_TOKEN` **does not trigger downstream workflow runs**.
Since firing the production deploys is the entire point of the final push, a
`GITHUB_TOKEN` promotion would move the ref and then sit there having deployed
nothing — succeeding, silently, while shipping nothing.

The bot needs:

| Repo | Access |
| --- | --- |
| development | write on the source branch (only when using a deployment log) and on the target branch |
| production | write on the target branch |

## Inputs and secrets

| Input | Default | Notes |
| --- | --- | --- |
| `dev-owner`, `dev-repo` | — | **Required.** The development repo, checked out as the source of truth. |
| `prod-owner`, `prod-repo` | — | **Required.** The promotion destination. |
| `source-branch` | `develop` | The branch being promoted. |
| `target-branch` | `main` | Promoted onto, in **both** repos. |
| `lfs` | `false` | Mirror Git LFS objects to production. |
| `deployment-log-path` | — | Land a bookkeeping commit before promoting. Off by default. |
| `deployment-log-description` | — | Text for the log row and commit message. |
| `commit-author` | — | Author of that commit, as `Name <email>`. |
| `committer-name`, `committer-email` | generic | `git user.*` for any commit created. |

| Secret | Required |
| --- | --- |
| `bot-token` | **Yes.** A PAT — see above. |

Output: `promoted-sha`, the commit now on the target branch in both repos.

### `lfs` — only if the repo vendors binaries

Without it a production checkout of the target branch would have dangling LFS
pointers. With it, objects are fetched after the merge and pushed explicitly,
because `--no-verify` on the pushes skips git-lfs's pre-push auto-upload.

Leave it `false` unless the repo actually uses LFS.

### `deployment-log-path` — only if your deploy platform checks commit authors

This lands a one-line row on the source branch before promoting, so the promoted
tip is authored by an identity you choose.

It exists for one specific failure: **Vercel blocks a deployment whose commit
author's email is not a member of the Vercel team.** A promotion whose tip
happened to be authored by an unauthorized identity shipped as BLOCKED and never
went live. Making the promotion author its own tip removes that failure mode.

A repo deploying to S3, ECS or anywhere else that does not inspect commit authors
should leave this unset.

If you do set it, the commit must touch **that file and nothing else**. Widening
it starts firing the source branch's pipelines on every promotion.

## When a promotion fails

| Symptom | Cause |
| --- | --- |
| `Not possible to fast-forward` | The target branch diverged from the source branch. They must never — investigate rather than merging manually. |
| Push to the source branch rejected | The branch moved mid-run. Re-dispatch. **Never force.** |
| Succeeds but nothing deploys | `bot-token` is a `GITHUB_TOKEN`, not a PAT. |
| Warning about a CI-skip directive | The promoted tip carries `[skip ci]` or similar, so it never ran the source pipelines. It still promotes; the content is just unvalidated. |

The workflow refuses outright if a CI-skip directive appears in the *description*
you dispatch with, because that string becomes the promoted HEAD's commit message
and would cancel every downstream production job.

## Where things live

- The reusable workflow: `platform-actions/.github/workflows/promote-repo.yml`
- PR verification, the other shared workflow:
  [standard-repo-workflows.md](standard-repo-workflows.md)
- `platform-actions` is a **public** repo, which is what lets one workflow serve
  both GitHub organizations. That is why every org and repo name here is an
  input rather than being written into the workflow — see that repo's
  `CLAUDE.md` before adding to it.
