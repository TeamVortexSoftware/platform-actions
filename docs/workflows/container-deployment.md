# Container deployment

A service repo deploys its container services with the container deployment
workflow. In development it builds each service's image and asks infra-data-dev
to run it. In production it builds nothing: it asks infra-data-prod to run the
image development is already running. Nobody runs a deploy by hand.

It works with either
[branch setup](https://github.com/TeamVortexSoftware/platform-repos/blob/main/open-discussions/sdlc.md#branches),
and with a repo in one organization or both.

### Contents

<!-- vtxmd:toc from-level=2 to-level=2 -->
* [Which branch deploys where](#which-branch-deploys-where)
* [In development](#in-development)
* [In production](#in-production)
* [What infra-data does with the request](#what-infra-data-does-with-the-request)
* [What it asks of your repo](#what-it-asks-of-your-repo)
* [What the platform needs before the first deploy](#what-the-platform-needs-before-the-first-deploy)
* [Installing it](#installing-it)
* [Where things live](#where-things-live)
<!-- vtxmd:end -->

## Which branch deploys where

| Branch setup | Development organization | Production organization |
| --- | --- | --- |
| Single branch | `main` deploys to a development environment | `main` deploys to production |
| Two branches | `develop` deploys to a development environment; `main` may deploy to another, such as `staging` | `main` deploys to production |

The stub says which development environment, if any, each branch deploys to.

In the production organization, `main` only changes when a
[repo promotion](promoting-to-production.md) pushes it. Any other branch, and any
pull request, deploys nothing.

## In development

1. **Build.** Builds the service's image from its Dockerfile, tagged
   `build-<first 8 characters of the commit>`.
2. **Push.** Pushes it to the service's repository in the development registry.
   Tags are immutable, so a re-run of the same commit pushes nothing.
3. **Ask for the deploy.** In infra-data-dev, on a branch named after the
   service's root, `state-groups/<group>/<root>`, it changes one file,
   `deployment-version-<environment>.json`:

    ```json
    { "tag": "build-4e7a9c21", "sha": "<the full commit>" }
    ```

   and opens a PR. If the file already says this, there is nothing to deploy
   and the run ends.
4. **Wait.** It waits for the PR to be applied and merged, then reports which
   commit is live. If it is still waiting after 15 minutes, it fails and says
   so.

## In production

1. **Find the version development is running.** It reads the service's
   `deployment-version-<environment>.json` in infra-data-dev, for the
   development environment production is promoted from. It takes that version
   rather than the commit being promoted: in a repo with several services, a
   service the release did not change has no image at that commit.
2. **Ask for the deploy.** In infra-data-prod, it writes that same version into
   the service's `deployment-version-<environment>.json`, on a branch named
   after the root, and opens a PR.
3. **Wait**, as in development.

Production pulls the image from the development registry. It runs exactly the
image development tested; nothing is built in production.

## What infra-data does with the request

The same in both infra-data repos:

1. **A check confirms the PR changes only that file.** If it changes anything
   else, the check fails and nothing is applied.
2. **The apply workflow applies the root**, which starts the new image, and
   commits the run's output files.
3. **When the apply succeeds, the PR merges.** If it fails, the branch stays,
   and the next deploy of that service stops until a person deals with it; see
   [stuck deployments](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/stuck-deployments.md).

## What it asks of your repo

- **A Dockerfile** for each service. The build can be given a read token for
  the organization's private npm packages, as the build secret `npm_token`;
  the token is never in the image.
- **Build arguments**, if the Dockerfile needs any. The Node version comes from
  the repo's `.nvmrc` as `NODE_VERSION`; anything else is set in the stub.
- Nothing from `package.json`.

## What the platform needs before the first deploy

Once per service:

- **Its image repository**, in the development registry, and its place in a
  system, in the system's settings file; for example
  [the platform system](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/systems/platform/README.md).
- **Its deployment in each organization it runs in**: the deployment file and
  the root that runs it; see
  [adding a deployment](https://github.com/TeamVortexSoftware/infra-data-dev/blob/main/docs/adding-a-deployment.md).
- **If it runs in production**, permission for production to pull its images
  from the development registry.

Once per repo, in each organization it is in:

- **The infra-data key**, as the repo secret `SSH_PRIVATE_KEY`, to read and
  push the request branch.
- **In development only, permission to push images.** The repo is added to the
  account's GitHub Actions role, so it can sign in to AWS, and given the
  variable naming that role. Production never pushes an image.

## Installing it

```bash
vortex repo gha install container-deployment   # writes .github/workflows/vtx-container-deployment.yml
```

Install it in the development repo; a promotion carries it to the production
copy. One stub serves both organizations: which job runs is decided by the
organization and the branch.

In the stub's `vtx:keep` blocks, set:

- **The branches**: in the development organization, which environment each
  branch deploys to, if any; and which development environment production is
  promoted from.
- **For each service**: its name, its Dockerfile, its deployment environment
  and root in infra-data-dev, its deployment environment and root in
  infra-data-prod if it runs in production, and whether it deploys at all. That
  switch covers both organizations, so a service can be added before it is
  ready to deploy.

The infra-data repos, the bot identity and the registry come from
organization variables and secrets.

## Where things live

- The stub: [workflow-stubs/container-deployment.yml](../../workflow-stubs/container-deployment.yml)
- The reusable workflow: [.github/workflows/container-deployment.yml](../../.github/workflows/container-deployment.yml)
- The check and the apply: each infra-data repo's apply workflow
