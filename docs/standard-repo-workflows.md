# Standard repo workflows

Every repo on the platform verifies its pull requests the same way: a short stub
in the repo calls one reusable workflow that holds all the logic. Adopting it is
one command plus whatever plumbing the repo's own targets need.

**A _target_ is a `package.json` script with a reserved name.** The platform
reserves the `vortex:<concern>:<action>` namespace for them, and this workflow
runs four: `vortex:lint:all`, `vortex:test:all`, `vortex:generate:all` and
`vortex:build:all`. It never invokes a tool of its own — it invokes those four
names, and what each one does inside your repo is entirely yours. That
indirection is the whole reason one workflow can verify the vortex CLI's repo, a
Terraform data repo and a shared-actions repo without knowing anything about any
of them.

So "adopting this workflow" is two things: installing the stub, which is one
command, and making sure the four targets in your `package.json` actually do
something. A target you have not filled in is not an error — it is a job that
goes green having verified nothing.

The namespace itself, and every target in it, is defined in
[script-targets.md](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/script-targets.md).
What *this* workflow additionally demands of the four it runs is in
[What each target has to satisfy](#what-each-target-has-to-satisfy).

### Contents

<!-- vtxmd:toc from-level=2 to-level=2 -->
* [What you get](#what-you-get)
* [The stub](#the-stub)
* [Staying current](#staying-current)
* [What each target has to satisfy](#what-each-target-has-to-satisfy)
* [When a target needs the CLI itself](#when-a-target-needs-the-cli-itself)
* [No AWS session](#no-aws-session)
* [Inputs and secrets](#inputs-and-secrets)
* [Adopting it in a repo](#adopting-it-in-a-repo)
* [Where things live](#where-things-live)
<!-- vtxmd:end -->

## What you get

```
repo's PR  →  .github/workflows/vtx-repo-verify.yml   (the stub, in your repo)
                        ↓  uses:
              platform-actions/.github/workflows/repo-verify.yml   (all the logic)
                        ↓  runs, as four concurrent jobs
              lint        test        generate        build
```

**Those are two files in two repos, and that split is the point.** Your repo
holds only the stub — a name, the settings you want, and any jobs of your own
you add alongside it; the triggers and the draft gate come from here. Every
line that decides what verification *does* lives in the reusable workflow here.
So when what verification _means_ changes, this repo changes and **no consuming
repo is touched**.

Each job is its own runner. It checks the repo out (submodules included,
recursively), installs Node and pnpm from the repo's own `.nvmrc` and
`packageManager`, runs `pnpm install --frozen-lockfile`, runs its one
`vortex:<concern>:all` target, and then requires the working tree to be
unchanged. That preamble is the `setup-vortex-repo` composite action; the
tree check is `assert-clean-tree`.

**Four jobs rather than four steps, so one run tells you everything.** Run
sequentially, a lint failure ends the run and you never learn whether the tests
pass — you fix lint, push, and meet the next failure a run later. Separate jobs
also mean separate check names, which is what a branch-protection rule keys off.

Every target is invoked with `pnpm run --if-present`, which exits 0 when a script
is undefined. The default repo profile ships every `vortex:<concern>:all` as a
runnable `echo` placeholder for the repo's keeper to fill in, so the targets are
expected to be there — `--if-present` is the safety net, not the design.

## The stub

Install it with the CLI, from the repo that is adopting it:

```bash
vortex repo gha list                  # what platform-actions offers, and what you have
vortex repo gha install repo-verify   # writes .github/workflows/vtx-repo-verify.yml
```

`install` fetches the stub from this repo, so there is one copy of it and no
paste to get wrong. Commit the result; from then on
`vortex repo gha update` keeps it current — see
[Staying current](#staying-current) below.

What lands is this:

```yaml
# From the vortex 'repo-verify' workflow template. Install as vtx-repo-verify.yml.
# See platform-actions/docs/standard-repo-workflows.md
#
# MANAGED BY `vortex repo gha update`. Everything outside a `vtx:keep` block
# is refreshed from this template on every update — which is how a change here
# reaches every repo that installed it. Everything INSIDE a block is yours and is
# never touched. To stop the file being managed at all, rename it to drop the
# `vtx-` prefix; you keep a working workflow that is then entirely your own.

# vtx:keep name
name: "[VTX] Repo Verify"
# vtx:end

# TRIGGERS AND THE DRAFT GATE — platform-owned, deliberately NOT a vtx:keep
# block, so a change to either half reaches every repo on the next update.
on:
    pull_request:
        types: [opened, synchronize, reopened, ready_for_review]
    workflow_dispatch:

jobs:
    verify:
        # A draft pull request does not verify. See "The draft gate" below.
        if: github.event_name != 'pull_request' || github.event.pull_request.draft == false

        # `uses:` cannot take an expression, so this one org is a literal.
        uses: TeamVortexSoftware/platform-actions/.github/workflows/repo-verify.yml@main
        with:
            # A platform-owned input sits HERE, outside the block — refreshed on
            # every update, not yours to change, exactly like the triggers above.
            # There are none today; this line is an illustration, not a setting
            # you can pass. See the note under this listing.
            example-platform-input: true

        # -------------------------------------------------- vtx:keep inputs ---
            skip-lint: false
            skip-test: false
            skip-generate: false
            skip-build: true
            node-version: ""
            submodules: "recursive"
        # ---------------------------------------------------------- vtx:end ---
        secrets:
            # NPM_READ_TOKEN, not NPM_TOKEN. The read credential is published as
            # an ORG-level Actions secret under that name, so every repo has it
            # and this stub goes in unedited. NPM_TOKEN exists only as a
            # repo-level secret on the two infra-data repos; using it here would
            # resolve to empty everywhere else, and npm answers an
            # unauthenticated private-package request with 404 rather than 401 —
            # so the failure would surface as a missing package, not a missing
            # credential.
            ssh-key: ${{ secrets.SSH_PRIVATE_KEY }}
            npm-token: ${{ secrets.NPM_READ_TOKEN }}

####   Your own jobs and edits go INSIDE the block below.  ####
####   Anything outside it is replaced on the next update. ####
# vtx:keep extra
# vtx:end
```

**The filename and the `name:` are the convention, not a preference.** Every
shared workflow lands as `vtx-<shared-workflow-name>.yml` with
`name: "[VTX] <Title Case Name>"`, so that in a repo carrying forty workflows of
its own you can tell at a glance which came from here — in the directory
listing, the Actions sidebar and the PR check list alike.

**About `example-platform-input`.** It is not a real setting — passing it would
fail. It is in the listing to show the shape, because a keep block partitions a
YAML mapping as readily as it partitions a file: `with:` itself sits outside the
block, so anything above the marker is platform-owned and refreshed on every
update, while the entries between the markers are yours and never touched. Every
input this workflow actually accepts is on the repo's side of that line today.
The triggers and the draft gate are the live example of the same rule, one level
up.

## Staying current

`vortex repo gha update` refreshes every `vtx-*.yml` the repo has. **The
filename is the record** — a stub is installed if and only if the file is there,
so nothing tracks adoption separately and there is no state to drift.

A stub is fetched from this repo's default branch every time it is installed or
updated, so a change here reaches every repo on its next update and no CLI
release sits in the path. There is no cached or bundled fallback: if this repo
cannot be reached, the command fails rather than writing a stale copy.

`vortex repo profile` is independent of `vortex repo gha` — a stub is not a
profile member, and `profile apply` does not touch one.

What it may rewrite is bounded by markers:

- everything **outside** a `# vtx:keep <name>` … `# vtx:end` block is refreshed
  from the published stub — which is how a change here reaches every repo that
  installed it
- everything **inside** a block is yours and is never touched

Blocks are matched by name, so one the stub later adds arrives with its default
and one it drops disappears. Unpaired markers abort the run with nothing written
in any file, rather than guessing where your content ends.

Two ways out, and they differ:

| | |
| --- | --- |
| **rename** the file to drop `vtx-` | stops it being managed; you keep a working workflow, now entirely yours |
| `vortex repo gha delete repo-verify` | removes the workflow |

Both secrets are optional and both resolve to empty when the repo has no such
secret, which is what lets the stub go in unedited either way.

**It is `NPM_READ_TOKEN`, not `NPM_TOKEN`.** The read credential is published as
an org-level Actions secret under that name, so every repo in the org has it.
Getting this wrong is quiet rather than loud: the token resolves to an empty
string, npm answers an unauthenticated private-package request with **404 rather
than 401**, and the run fails with `ERR_PNPM_FETCH_404` on a package that plainly
exists.

**The triggers are not yours to change.** They and the `if:` on the `verify` job
are the two halves of the draft gate, and both sit outside every `vtx:keep`
block. `opened`, `synchronize` and `reopened` are the default set that
verification wants; `ready_for_review` is what fires the run when a draft is
marked ready. Do not trim the list — dropping `synchronize` in particular would
mean a PR that fails, gets fixed and is re-pushed never re-verifies, leaving a
green tick on a tree that no longer exists. That trap is live elsewhere on the
platform; see
[platform-gotchas.md](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/platform-gotchas.md).
A repo that genuinely needs different triggers renames the file to drop the
`vtx-` prefix and owns it outright.

**The draft gate: a draft pull request does not verify.** Review is iterative,
and without the gate every push during a review fires the full four-job fan-out.
With it, iteration is free and the runners are spent once — on the tree the
review finished with. Marking the PR ready fires `ready_for_review` and the run
happens then; a push to an already-ready PR still re-verifies through
`synchronize`. The gate buys cheap iteration, never a way to merge something
unverified. The `github.event_name` half of the condition keeps
`workflow_dispatch` working, where there is no `pull_request` payload to read
`draft` from.

**`workflow_dispatch` runs verification on demand**, against a branch you pick —
useful for re-checking a branch after a change to the shared workflow lands, or
for checking one that has no PR open yet. GitHub only surfaces the "Run workflow"
button once the file is on the repo's default branch, so it will not appear on
the PR that first installs the stub.

`@main` is deliberate: consumers track the workflow as it moves. Pin to a tag
only if a repo needs to lag behind on purpose.

## What each target has to satisfy

The targets themselves are defined in
[script-targets.md](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/script-targets.md). What this workflow additionally
requires of them:

| Target                | Requirement                                                  |
| --------------------- | ------------------------------------------------------------ |
| `vortex:lint:all`     | Read-only. Must not modify the tree.                         |
| `vortex:test:all`     | Read-only, and **must run without credentials** (see below). |
| `vortex:generate:all` | Mutates by design; the tree must be clean afterwards.        |
| `vortex:build:all`    | Skipped by default (`skip-build`); its output must be gitignored. |

**A dirty tree fails the job — every job.** After its target, each job stages
everything and fails if anything changed. Staging first is deliberate: a *new*
file counts as drift, not only a modified one, and `git diff` alone would ignore
an untracked path — which is exactly how a newly generated file would slip
through.

One check, four reasons it fires:

| Job | A dirty tree means |
| --- | --- |
| `lint` | the target modified something. `lint` is a read-only concern — mutating fixes belong in `vortex:lint:fix`. |
| `test` | the test battery wrote into the repo. Write to a temp dir, or gitignore the output. |
| `generate` | a source was edited without regenerating. Run the target locally and commit the result. |
| `build` | build output is not gitignored. Artifacts are never committed. |

The read-only concerns were always required not to modify the tree; this is the
first time it is enforced rather than documented. **Expect adoption to find
something** — a coverage file, a cache, a fixture written in place. That is the
check working. Fix the target or ignore the output; don't weaken the check.

`vortex:build:all` no longer has to run last. It used to, so its uncommitted
output could not be reported as generate's drift — with one job per concern that
confusion is structurally impossible, since each job has its own checkout. So
build is held to the same rule and gives an honest message of its own.

## When a target needs the CLI itself

Some `vortex:<concern>:all` targets shell out to a bare `vortex` —
`vortex:generate:all` does in the infra repos. **Nothing to configure:**
`setup-vortex-repo` asks whether the repo supplies the CLI, and installs it when
it does not.

The question it asks is whether `node_modules/.bin/vortex` exists, which is where
`pnpm install` links a dependency's binary and where a `vortex:*` target finds it,
since pnpm puts that directory on PATH when it runs a script. Present, nothing
happens. Absent, the CLI is fetched globally.

There used to be an `install-vortex-cli` input for this, and forgetting to set it
produced a failure with nothing to point at. Whether a repo carries
`config-utility` as a dependency stays that repo's decision — the workflow just
adapts to the answer.

One caveat: the install is skipped when no `npm-token` is available, because it
could not succeed. A target that then needs `vortex` fails on its own and says so.

There is **no version pin**. A runner starts clean every time, so latest is both
the simplest thing to install and the most current — which also means the CLI's
own staleness gate never has cause to fire in CI. A pin would be one more number
to remember to bump, and its staleness would surface as a CI failure nobody was
expecting.

It checks before installing, so a job that already has the CLI pays nothing. It
needs the `npm-token` secret, and fails with a clear message rather than a later
`command not found` if the token is missing or the install lands off PATH.

## No AWS session

**Nothing in this workflow gets AWS credentials.** A shared workflow that every
repo calls is the wrong place to hold a role.

If a repo's test suite needs the vault, that is for the repo to solve inside its
own target — by scoping `vortex:test:all` to the credential-free suites, or by
keeping the vault-backed run in a separate workflow that does configure a role.
`config-utility` is the live example: several of its suites reach AWS, so its
`vortex:test:all` is deliberately still a placeholder while `vortex:lint:all` and
`vortex:generate:all` are plumbed.

## Inputs and secrets

All optional, and **the stub is where they are documented.** Every setting is
written out in the installed file at its default value, with a description block
above it giving each one's name, default and effect.

That is deliberate rather than lazy: the block sits outside the `vtx:keep`
markers, so `vortex repo gha update` refreshes it, and a setting added later
appears in every repo's own copy. A table here would be a second copy that
nothing maintains — which is what the table this replaced had become.

There is one setting per job, named for the target it runs:

| | |
| -- | -- |
| `skip-lint`, `skip-test`, `skip-generate` | default `false` — the job runs |
| `skip-build` | default `true` — the one job most repos do not want |

Plus `node-version` (empty means read `.nvmrc`) and `submodules` (`recursive`).
Read the stub for what each does.

| Secret      | Required when                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ssh-key`   | The repo has submodules. `.gitmodules` uses SSH URLs here, which the default workflow token cannot satisfy — without a key, checkout silently produces an empty submodule directory. |
| `npm-token` | The repo installs a package from the `@teamvortexsoftware` scope. Pass `secrets.NPM_READ_TOKEN` — the read credential is an **org-level** Actions secret under that name, so every repo has it. `NPM_TOKEN` is a repo-level secret on the two `infra-data` repos only. Written to the runner's user-level `~/.npmrc`, never the repo's committed one. |

The stub already passes both secrets and every setting. Changing one means
editing the value that is already there, inside the keep block:

```yaml
jobs:
    verify:
        uses: TeamVortexSoftware/platform-actions/.github/workflows/repo-verify.yml@main
        with:
            skip-build: false
        secrets:
            ssh-key: ${{ secrets.SSH_PRIVATE_KEY }}
            npm-token: ${{ secrets.NPM_READ_TOKEN }}
```

## Adopting it in a repo

1. **Install the profile** if the repo doesn't have one — `vortex repo profile apply`
   gives it `package.json`, `.nvmrc`, `.npmrc` and the `vortex:*`
   placeholders. See [script-targets.md](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/script-targets.md).
2. **Plumb the targets you actually have.** A placeholder is a free pass, so
   plumbing is what makes verification mean anything. Start with
   `vortex:generate:all` — it is the one that catches real drift.
3. **Install the stub** — `vortex repo gha install repo-verify`. It says so if a
   target the workflow runs is missing from `package.json`, and points at
   `vortex repo profile apply`. Advisory: the install still succeeds.
4. **Add secrets** if the repo needs them, per the table.
5. **Open a PR and watch the four checks run.** If one fails on first adoption,
   that is the workflow doing its job — something in the repo was already stale,
   or a target you believed was read-only isn't.

## Where things live

- The reusable workflow: `platform-actions/.github/workflows/repo-verify.yml`
- The stub to install: `platform-actions/workflow-stubs/repo-verify.yml` —
  fetched from here by `vortex repo gha install`, so this is the only copy
- The composite actions it builds on: `platform-actions/actions/setup-vortex-repo/`
  and `platform-actions/actions/assert-clean-tree/`
- The target definitions: [script-targets.md](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/script-targets.md)
