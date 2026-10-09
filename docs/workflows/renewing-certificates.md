# Renewing Let's Encrypt certificates

A weekly job that keeps the platform's Let's Encrypt certificates from expiring.
Terraform issues each certificate and re-issues it on any apply of its root once
it is within its renewal window. Nothing else applies those roots, so this job
requests the apply.

## What it does

1. Reads every root's `OUTPUT.json` in the organization's infra-data repo
   (`infra-data-dev` in development, `infra-data-prod` in production) for
   certificates that report an expiry and a renewal window.
2. Picks the one due soonest. If it isn't inside its window, the run ends there.
3. Writes `data/jobs/renew-certs.yml` as `{ "lastRunRequest": "<time>" }` on a
   branch named after the root, `state-groups/<group>/<root>`, and opens a PR.
   That starts the infra-data repo's "Apply One Root Module" workflow, which
   applies the root, commits its run-files and merges — the same path a service
   deploy takes.

It requests at most one root per run, since every request writes the same job
file. If the root's branch already exists, an apply of it is already in flight
or stuck, and the run fails rather than stepping on it.

Running it by hand from the Actions tab offers a **force** checkbox, which
requests an apply of the soonest-due root even if nothing is due yet. That
apply re-issues nothing; it is how the whole path is tested.

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
- The certificate's expiry and renewal window come from infra-as-code's
  `lib/acme/certificate` module, set by `renew_before_days` in the account's
  `dns.yml`.
