# Applying machine images

**SDLC workflow:** [Automated deployment](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/sdlc/README.md#automated-deployment), in production.

A job that moves machines onto the newest usable copy of the machine image they
boot. A root boots that copy on any apply, so this job requests the apply. It
never touches AWS or an image. How copies become usable is in the umbrella's
[machine images](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/platform-construction/machine-images/README.md)
page.

## What it does

1. Finds every root in the repo with a machine booting a built image: one of
   its `operator/vm` modules names a VM profile file whose `aws.image` is not a
   stock image in infra-as-code's `data/providers/aws.yml`.
2. For each, writes `job-apply-images.json` into the root as
   `{ "sha": <commit the job ran from>, "actions_log": <link to the run> }` on a
   branch named after the root, `state-groups/<group>/<root>`, and opens a PR.
   That starts the repo's "Apply One Root Module" workflow, which applies the
   root, commits its run-files and merges.

If a root's branch already exists, an apply of it is in flight or stuck: the job
leaves it, requests the others, and fails the run so the stuck one is seen.

## What starts it

- In `infra-data-dev`: [job-build-images](job-build-images.md), after it builds
  a copy.
- In `infra-data-prod`: its own `schedule`, in the installed
  `.github/workflows/vtx-job-apply-images.yml`.
- In both: `vortex aws images mark-bad`, so machines leave a bad copy.
- By hand, from the Actions tab.

## Installing it

It is installed in both `infra-data-dev` and `infra-data-prod`:

```bash
vortex repo gha install job-apply-images   # writes .github/workflows/vtx-job-apply-images.yml
```

In `infra-data-dev`, remove the `schedule` from the triggers block; the build
job starts it there. Its settings and secrets are described in the installed
stub, and resolve from organization variables and secrets.

## Where things live

- The stub: [workflow-stubs/job-apply-images.yml](../../workflow-stubs/job-apply-images.yml)
- The reusable workflow: [.github/workflows/job-apply-images.yml](../../.github/workflows/job-apply-images.yml)
