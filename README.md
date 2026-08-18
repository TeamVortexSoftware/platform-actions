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

- [Standard repo workflows](docs/standard-repo-workflows.md) — `repo-verify.yml`,
  the shared pull-request verification workflow
- [Promoting a repo to production](docs/promoting-to-production.md) —
  `promote-repo.yml`, the shared two-org promotion workflow

Platform-wide context those docs assume — what the `vortex:*` script targets
mean, why production lives in a second organization — stays in the umbrella's
docs hub.

**This repository is public.** Keep organization names, domains, secret paths,
account aliases and role names out of these files; pass them in from the calling
repo. See `CLAUDE.md`.
