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

Install it with the CLI, from the repo that is adopting it:

```bash
vortex repo gha install promote-repo   # writes .github/workflows/vtx-promote-repo.yml
```

Nothing to fill in — every value resolves from an organization-level Actions
variable or from the event.

`vortex repo gha update` keeps it current afterwards. Everything outside a
`# vtx:keep <name>` … `# vtx:end` block is refreshed from the published stub;
everything inside is yours. The `name` and the promotion itself — which repos it
crosses, which branches it moves between, the log path, whether LFS objects are
mirrored — sit inside blocks, so a repo on a different progression configures it
here rather than installing a different stub.

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
| `lfs` | `false` | Mirror Git LFS objects to the production repository. Leave false unless the repo actually stores binaries through LFS. |
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
- The stub to install: `platform-actions/workflow-stubs/promote-repo.yml` —
  fetched from here by `vortex repo gha install`, so this is the only copy
