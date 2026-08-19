# Promoting a repo to production

Services operating in production have copies of their repositories in a
**separate GitHub organization**. Development deployment environments
(`develop`, `stg`, ...) source from actions running in the development
organization repository (eg. `<dev-gh-org>/<repo>`) where as production
deployment environments (`prod`, ...) source from the production organization
repository actions (eg. `<prod-gh-org>/<repo>`). _Shipping_ means promoting one
to the other.

Promotion is a manual button, not a branch push. A short stub in the production
copy calls one reusable workflow that holds all the logic.

## What it does

```
you dispatch  →  .github/workflows/vtx-promote-repo.yml   (the stub, in the PRODUCTION repo)
                        ↓  uses:
              platform-actions/.github/workflows/promote-repo.yml   (all the logic)
                        ↓
              FF develop → main on the DEVELOPMENT repo
              push main to the development org (origin)
              push main to the PRODUCTION org (production remote)
```

The workflow only makes a single, no-op commit by the production service user.
It appends a line to `REPO_DEPLOYMENT_LOG.md`. **Pushing the target branch to
the production organization is what triggers that repo's deploy workflows** —
other than adding one empty commit, the promotion just moves refs. The empty
commit is to satisfy a Vercel dependency in that the service account user is a
member of the production Vercel team and so can trigger deployments on Vercel
projects.

Both hops are `--ff-only`. The two branches must never diverge, and a
fast-forward that cannot happen fails loudly rather than inventing a merge
commit.

Run from the development org repo the action is **inert**. Only firing it in the
production repo triggers deployments.

## Installing it

Copy [the stub](../workflow-stubs/promote-repo.yml) into the service repo as
`.github/workflows/vtx-promote-repo.yml`. Nothing to fill in — every value
resolves from an organization-level Actions variable or from the event. Keep the
stub portion intact; the `name` is yours to change.

Dispatching takes one optional note for the deployment log, defaulting to a
timestamp.

## Inputs

<!-- vtxmd:workflow-inputs ../.github/workflows/promote-repo.yml -->
| Input | Default | Description |
| --- | --- | --- |
| `dev-owner` | _required_ | Owner of the development repository — the source of truth. |
| `dev-repo` | _required_ | Name of the development repository. |
| `prod-owner` | _required_ | Owner of the production repository — the promotion destination. |
| `prod-repo` | _required_ | Name of the production repository. |
| `source-branch` | `develop` | Branch being promoted. |
| `target-branch` | `main` | Branch promoted onto, in BOTH repositories. Pushing it to the production repository is what triggers the production deploys. |
| `lfs` | `false` | Mirror Git LFS objects to the production repository. Leave false unless the repo actually vendors binaries through LFS. |
| `deployment-log-path` | `REPO_DEPLOYMENT_LOG.md` | Markdown log appended with one row per promotion, committed to the source branch before promoting. Set to an empty string to skip the commit. |
| `deployment-log-description` | `""` | Optional note for the log row and commit message. Blank becomes "production deployment at <time> UTC". |
| `commit-author` | `""` | Author of the deployment-log commit, as "Name <email>". Must be an identity the production deploy platform accepts — Vercel refuses a build whose commit author is not on its team. |
| `committer-name` | `platform-actions` | git user.name for the deployment-log commit. |
| `committer-email` | `platform-actions@users.noreply.github.com` | git user.email for the deployment-log commit. |
<!-- vtxmd:end -->

## Secrets

<!-- vtxmd:workflow-inputs ../.github/workflows/promote-repo.yml section=secrets -->
| Secret | Required | Description |
| --- | --- | --- |
| `bot-token` | yes | Bot PAT with write on both repositories' target branch and on the development repository's source branch. A GITHUB_TOKEN will not do — commits it authors do not trigger the production deploys. |
<!-- vtxmd:end -->

## Outputs

<!-- vtxmd:workflow-inputs ../.github/workflows/promote-repo.yml section=outputs -->
| Output | Description |
| --- | --- |
| `promoted-sha` | The commit now on the target branch in both repositories. |
<!-- vtxmd:end -->

## Where things live

- The reusable workflow: `platform-actions/.github/workflows/promote-repo.yml`
- The stub to install: `platform-actions/workflow-stubs/promote-repo.yml`
- PR verification, the other shared workflow:
  [standard-repo-workflows.md](standard-repo-workflows.md)
