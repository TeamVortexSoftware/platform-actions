# Applying machine images

**SDLC workflow:** [Automated deployment](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/sdlc/README.md#automated-deployment), in production.

This workflow is effectively a service that keeps an infra-data repo's VM
instances on the latest usable versions of their images. The images are
always built in the development infrastructure and shared with the accounts
that use them. Each infra-data repo that installs it runs it either on a
schedule or, in the repo that builds the images, after each build. Each run
creates a no-op commit for each applicable root, followed by a PR, which
triggers the centralized `root-module-apply.yml` mechanism for automated
terraform applies.

A job that moves machines onto the newest usable copy of the machine image they
boot. A root boots that copy on any apply, so this job requests the apply. It
never touches AWS or an image. How copies become usable is in the umbrella's
[machine images](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/platform-construction/machine-images/README.md)
page.

```
  infra-data-dev  (development)
  ─────────────────────────────
   every day:
     BUILD JOB
       ├─ GitHub published a new Ubuntu 26.04 image?
       │     no  → stop. Nothing else happens today.
       │     yes → build our copy, scan it, label it "good",
       │           share it with production
       └─ starts ↓
     APPLY JOB
       └─ opens an apply PR for each root whose machines use the image
            → the normal apply runs → machines rebuilt on the new copy

  infra-data-prod  (production)
  ─────────────────────────────
   every day:
     APPLY JOB  (same job, its own copy)
       └─ opens an apply PR for each root whose machines use the image
            → the apply picks the newest copy that's been good for 24 hours
            → machines rebuilt on it

  What each job does:
  - The build job makes images. It runs only in development.
  - The apply job gets machines onto the latest image. It runs in both repos. Development starts it right after a build. Production runs it daily, because production waits 24 hours before
    using a copy.
```

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
