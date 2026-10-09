# Renewing certificates

A weekly job that keeps the platform's TLS certificates from expiring. A root
that holds certificates re-issues one on any apply inside the renewal window.
Nothing else applies those roots on a schedule, so this job requests the apply.
It knows nothing about what issues a certificate.

## What it does

1. Finds every root in the organization's infra-data repo (`infra-data-dev` in
   development, `infra-data-prod` in production) whose `OUTPUT.json` has a
   top-level `certificates` entry: each certificate's `not_after`, in the shape
   config-utility's `RootCertificates` schema defines.
2. A root is due when any of its certificates expires within
   `general.certificate_renewal_days` in that repo's `data/core-infra/core.yml`,
   the same value the roots renew by.
3. For each due root, writes `job-renew-certs.json` into the root as
   `{ "sha": <commit the job ran from>, "run": <link to the run> }` on a branch
   named after the root, `state-groups/<group>/<root>`, and opens a PR. That
   starts the infra-data repo's "Apply One Root Module" workflow, which applies
   the root, commits its run-files and merges — the same path a service deploy
   takes.

If a root's branch already exists, an apply of it is in flight or stuck: the job
leaves it, requests the others, and fails the run so the stuck one is seen.

Running it by hand from the Actions tab offers a **force** checkbox, which
requests an apply of every certificate root, due or not. An apply outside the
window re-issues nothing; it is how the whole path is tested.

## Installing it

It is installed in `assets-static`, the one repo that exists in both
organizations, so one file serves both:

```bash
vortex repo gha install job-renew-certs   # writes .github/workflows/vtx-job-renew-certs.yml
```

Its settings and secrets are described in the installed stub, and resolve from
organization variables and secrets, so it goes in unedited.

## Where things live

- The stub: [workflow-stubs/job-renew-certs.yml](../../workflow-stubs/job-renew-certs.yml)
- The reusable workflow: [.github/workflows/job-renew-certs.yml](../../.github/workflows/job-renew-certs.yml)
