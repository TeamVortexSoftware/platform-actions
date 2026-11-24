# Building machine images

**SDLC workflow:** [Automated deployment](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/sdlc/README.md#automated-deployment), in development.

A scheduled job that builds the platform's machine images: our own copy of each
image's source, rebuilt when the source publishes a new release. What a machine
image is, and how copies are kept, shared and marked bad, is in the umbrella's
[machine images](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/platform-construction/machine-images/README.md)
page.

## What it does

1. Signs in to the accounts the stub names, with the role it names, through
   [setup-aws-oidc-accounts](../../actions/setup-aws-oidc-accounts/action.yml).
2. Installs Packer and runs `vortex aws images build --execute` in the repo.
   The command does the work: for each image file, it builds the newest
   release that has no copy yet, scans and labels the copy, shares it, and
   deletes old copies. One image failing raises an alert and doesn't stop the
   others; the run then fails.
3. If the run built at least one copy, starts the repo's
   `vtx-job-apply-images.yml` ([job-apply-images](job-apply-images.md)), which
   requests an apply of every root whose machines use a built image.

It runs on one of our own GitHub runners, named in the stub: the temporary
machines the command builds on admit SSH only from our GitHub runners.

When it runs is set by the `schedule` in the installed
`.github/workflows/vtx-job-build-images.yml`. It can also be run by hand from
the Actions tab.

## Installing it

It is installed in `infra-data-dev` only. Production never builds.

```bash
vortex repo gha install job-build-images   # writes .github/workflows/vtx-job-build-images.yml
```

Its settings and secrets are described in the installed stub. Its defaults are
infra-data-dev's: the `images` role, the `dev` account, and the
`vtx-amazon-linux-2023` GitHub runners.

## Where things live

- The stub: [workflow-stubs/job-build-images.yml](../../workflow-stubs/job-build-images.yml)
- The reusable workflow: [.github/workflows/job-build-images.yml](../../.github/workflows/job-build-images.yml)
