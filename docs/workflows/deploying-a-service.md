# Deploying a service

A service repo deploys a container service with one standard workflow. It builds
the service's image, pushes it to the registry, and asks the infra-data repo to
run the new version. The infra-data repo applies the change and merges it.
Nobody runs a deploy by hand.

This is the automated deployment in the platform's SDLC: a workflow that makes
one narrow, predefined change, checked so that it can change nothing else.

### Contents

<!-- vtxmd:toc from-level=2 to-level=2 -->
* [What it does](#what-it-does)
* [What it asks of your repo](#what-it-asks-of-your-repo)
* [What the platform needs before the first deploy](#what-the-platform-needs-before-the-first-deploy)
* [Installing it](#installing-it)
* [Where things live](#where-things-live)
<!-- vtxmd:end -->

## What it does

1. **Build.** Builds the image from the service's Dockerfile, tagged
   `build-<first 8 characters of the commit>`.
2. **Push.** Pushes the image to the service's repository in the registry.
   Tags are immutable, so a tag that is already there is left alone, and a
   re-run of the same commit pushes nothing.
3. **Ask for the deploy.** In the infra-data repo, on a branch named after the
   service's root, `state-groups/<group>/<root>`, it changes one file,
   `deployment-version-<environment>.json`:

    ```json
    { "tag": "build-4e7a9c21", "sha": "<the full commit>" }
    ```

   and opens a PR. If the file already says this, there is nothing to deploy
   and the run ends.
4. **Wait.** It waits for the infra-data repo to apply and merge the PR, then
   reports which commit is live. If it is still waiting after 15 minutes, it
   fails and says so.

The infra-data repo takes it from step 3:

1. **A check confirms the PR changes only that file.** A branch named
   `state-groups/...` exists for automated requests. If it changes anything
   other than the deployment version, or the certificate renewal request, of its
   own root, the check fails and nothing is applied.
2. **The apply workflow applies the root**, which starts the new image, and
   commits the run's output files.
3. **When the apply succeeds, the PR merges.** If it fails, the branch stays,
   and the next deploy of that service stops until a person deals with it.

## What it asks of your repo

- **A Dockerfile** for each service it deploys. The build can be given a
  read token for the organization's private npm packages, as the build secret
  `npm_token`; the token is never in the image.
- **Build arguments**, if the Dockerfile needs any. The Node version comes from
  the repo's `.nvmrc` as `NODE_VERSION`; anything else is set in the stub.
- Nothing from `package.json`.

## What the platform needs before the first deploy

Once per service, in the infra-data repo:

- **Its image repository and its place in a system**, in the system's settings
  file, for example
  [the platform system](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/systems/platform/README.md).
- **Its deployment**: the deployment file and the root that runs it, with a
  `deployment-version-<environment>.json` for each environment.

Once per repo:

- **Permission to push images.** The repo is added to the account's GitHub
  Actions role, so it can sign in to AWS, and given the variable naming that
  role.
- **The infra-data key**, as the repo secret `SSH_PRIVATE_KEY`, to push the
  request branch.

## Installing it

```bash
vortex repo gha install deploy-service   # writes .github/workflows/vtx-deploy-service.yml
```

The stub runs on a push to the branch you deploy from. Set the branch, and for
each service its deployment, environment, root and Dockerfile, in the stub's
`vtx:keep` blocks. The infra-data repo, the bot identity and the registry come
from organization variables and secrets.

## Where things live

- The stub: [workflow-stubs/deploy-service.yml](../../workflow-stubs/deploy-service.yml)
- The reusable workflow: [.github/workflows/deploy-service.yml](../../.github/workflows/deploy-service.yml)
- The check and the apply: the infra-data repo's apply workflow
