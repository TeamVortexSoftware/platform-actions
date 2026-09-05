# platform-actions

Shared GitHub Actions code for the Vortex platform — reusable workflows and
composite actions called by workflows in the platform repos and the service
repos — and the home for scheduled automation (e.g. Let's Encrypt certificate
issuance and renewal).

Part of the [platform-repos](https://github.com/TeamVortexSoftware/platform-repos)
umbrella, where it is incorporated as a git submodule; see that repo's `docs/`
hub for platform-wide documentation.

## Docs

How to call what lives here — the caller stub, inputs, secrets and failure modes
— is documented beside the workflow it describes:

- [Standard repo workflows](docs/standard-repo-workflows.md) — what every
  standard workflow has in common, and how a stub is installed and kept current
- [repo-verify](docs/repo-verify.md) — `repo-verify.yml`, the shared
  pull-request verification workflow
- [Promoting a repo to production](docs/promoting-to-production.md) —
  `promote-repo.yml`, the shared two-org promotion workflow

Platform-wide context those docs assume — what the `vortex:*` script targets
mean, why production lives in a second organization — stays in the umbrella's
docs hub.

## Workflow stubs

`workflow-stubs/` holds the caller workflow each consuming repo installs. This is
the **only** copy — the vortex CLI fetches them from here rather than bundling
its own, so there is nothing to keep in step:

```bash
vortex repo gha list                  # what is on offer, and what a repo has
vortex repo gha install repo-verify   # writes .github/workflows/vtx-repo-verify.yml
vortex repo gha update                # keeps every installed stub current
```

Every value that can be pre-set comes from an organization-level Actions
variable, so a stub goes in unedited. What a repo may change is fenced by
`# vtx:keep <name>` … `# vtx:end` blocks: content inside a block is the repo's
and is never touched, everything outside it is refreshed on every apply. That
polarity is deliberate — it is what lets a stub gain a key later and have it
reach every installed copy.

### How a stub is named where it lands

A consuming repo installs a stub under a fixed name, so that every shared
workflow is recognisable as one at a glance:

| | |
| --- | --- |
| file | `.github/workflows/vtx-<shared-workflow-name>.yml` |
| `name:` | `[VTX] <Title Case Name>` |

So `repo-verify.yml` is installed as `vtx-repo-verify.yml`, named
`[VTX] Repo Verify`.

The `vtx-` prefix sorts every shared workflow together in the directory listing
and in the Actions sidebar; the `[VTX]` display prefix does the same on a pull
request's check list. In a service repo carrying forty workflows of its own,
that is the difference between "which of these are ours" being obvious and
being a question.

**This repository is public.** Keep organization names, domains, secret paths,
account aliases and role names out of these files; pass them in from the calling
repo. See `CLAUDE.md`.
