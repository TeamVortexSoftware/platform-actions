# Standard repo workflows

The platform comes with pre-canned workflows to simplify routine tasks, execute
common paths in our CI/CD pipelines and accommodate compliance requirements.
Short workflow stubs are maintained in the **platform-actions** repository. These
can be installed and updated as GitHub Actions workflow files in any repository
using the `vortex repo gha` sub-command. They typically call reusable workflows
that hold all the logic.

**This page is the family contract** — what every standard workflow has in
common, and how one is installed, updated and removed. What an individual
workflow _does_, and what it asks of your repo, is on its own page: see
[The standard workflows](#the-standard-workflows).

### Contents

<!-- vtxmd:toc from-level=2 to-level=2 -->
* [What every standard workflow is](#what-every-standard-workflow-is)
* [The touch point: script targets](#the-touch-point-script-targets)
* [Installing a stub](#installing-a-stub)
* [What is yours, and what is not](#what-is-yours-and-what-is-not)
* [Staying current](#staying-current)
* [Inputs and secrets](#inputs-and-secrets)
* [The standard workflows](#the-standard-workflows)
* [Where things live](#where-things-live)
<!-- vtxmd:end -->

## What every standard workflow is

Three things, always.

**A stub in your repo.** GitHub only runs workflows it finds in
`.github/workflows/`, so a file has to exist in the repo — you cannot simply
point at someone else's. A stub is the smallest such file: a name, a `uses:`
line, and the handful of choices that are genuinely yours.

**A reusable workflow here.** Every line that decides what the workflow _does_
lives in platform-actions.

```
repo's PR / push / tag  →  .github/workflows/vtx-<name>.yml   (the stub, in your repo)
                                    ↓  uses:
                       platform-actions/.github/workflows/<name>.yml   (all the logic)
```

**Those are two files in two repos, and that split is the point.** When what a
workflow _means_ changes, this repo changes and **no consuming repo is touched**.

**Script targets as the touch point.** A standard workflow never invokes a tool
of its own. It invokes reserved `package.json` script names, and what each one
does inside your repo is entirely yours. That indirection is the whole reason one
workflow can serve the vortex CLI's repo, a Terraform data repo and a
shared-actions repo without knowing anything about any of them.

## The touch point: script targets

**The touch points between these workflows and each individual repo are well
defined script targets in the `package.json` files.** A _target_ is a
`package.json` script with a reserved name. The platform reserves the
`vortex:<concern>:<action>` namespace for them, and `:all` is the contract — a
standard workflow calls only `vortex:<concern>:all`, never a leaf.

The namespace itself, and every target in it, is defined in
[script-targets.md](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/script-targets.md).
Which targets a given workflow runs, and what it additionally demands of them, is
on that workflow's own page.

So adopting any standard workflow is two things: installing the stub, which is
one command, and making sure the targets it calls exist and actually do
something. **A target you have not filled in is not an error** — every target is
invoked with `pnpm run --if-present`, so an undefined one exits 0 and the job
succeeds having done nothing. The default repo profile ships each
`vortex:<concern>:all` as a runnable `echo` placeholder for the repo's keeper to
fill in, so `--if-present` is the safety net, not the design.

A stub declares the targets its workflow runs in its header, so
`vortex repo gha install` and `update` say when one is missing from the repo's
`package.json` and point at `vortex repo profile apply`. That is advisory: the
install still succeeds.

## Installing a stub

From the repo that is adopting it:

```bash
vortex repo gha list             # what platform-actions offers, and what you have
vortex repo gha install <name>   # writes .github/workflows/vtx-<name>.yml
```

`install` fetches the stub from this repo, so there is one copy of it and no
paste to get wrong. Commit the result; from then on `vortex repo gha update`
keeps it current.

**The filename is the record.** A stub is installed if and only if
`.github/workflows/vtx-<name>.yml` is there, so nothing tracks adoption
separately and there is no state to drift.

`vortex repo profile` is independent of `vortex repo gha` — a stub is not a
profile member, and `profile apply` does not touch one.

## What is yours, and what is not

Every stub is a managed file, partitioned by markers:

- everything **outside** a `# vtx:keep <name>` … `# vtx:end` block is
  platform-owned and refreshed from the published stub on every update — which is
  how a change here reaches every repo that installed it
- everything **inside** a block is yours and is never touched

Blocks are matched by name, so one the stub later adds arrives carrying its
default, and one it drops disappears. Unpaired markers abort the run with nothing
written in any file, rather than guessing where your content ends.

A block partitions a YAML mapping as readily as it partitions a file, which is
how a stub can hold platform-owned and repo-owned settings side by side:

```yaml
jobs:
    <job>:
        # Platform-owned: refreshed on every update, not yours to change.
        if: <a condition the platform guarantees>

        uses: TeamVortexSoftware/platform-actions/.github/workflows/<name>.yml@main
        with:
            # A platform-owned input sits HERE, outside the block.
            example-platform-input: true

        # ------------------------------------------- vtx:keep inputs ---
            # ...and the settings that are yours sit between the markers.
            some-setting: false
        # --------------------------------------------------- vtx:end ---
```

`example-platform-input` is not a real setting — it is in the listing to show
where one would go. Which regions a given stub reserves is that workflow's own
decision, and its page says so.

**Two ways out, and they differ:**

|                                    |                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------- |
| **rename** the file to drop `vtx-` | stops it being managed; you keep a working workflow, now entirely yours |
| `vortex repo gha delete <name>`    | removes the workflow                                                   |

## Staying current

`vortex repo gha update` refreshes every `vtx-*.yml` the repo has.

A stub is fetched from this repo's default branch every time it is installed or
updated, so a change here reaches every repo on its next update and no CLI
release sits in the path. There is no cached or bundled fallback: if this repo
cannot be reached, the command fails rather than writing a stale copy.

The reusable workflow is tracked the same way — a stub's `uses:` ends in `@main`
deliberately, so consumers follow the workflow as it moves. Pin to a tag only if
a repo needs to lag behind on purpose.

## Inputs and secrets

**The stub is where they are documented.** Every setting is written out in the
installed file at its default value, with a description block above it giving
each one's name, default and effect.

That is deliberate rather than lazy: the description block sits outside the
`vtx:keep` markers, so `vortex repo gha update` refreshes it, and a setting added
later appears in every repo's own copy. A table in a doc would be a second copy
that nothing maintains.

Secrets follow the same rule. Where one is an organization-level Actions secret,
the stub already names it and goes in unedited.

## The standard workflows

| Workflow       | What it is for                                            | Page                                                    |
| -------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| `repo-verify`  | verifying pull requests — lint, test, generate, build     | [repo-verify.md](repo-verify.md)                        |
| `promote-repo` | promoting a repo to production across the two GitHub orgs | [promoting-to-production.md](promoting-to-production.md) |
| `repo-release` | releasing an artifact, and updating a Homebrew formula    | [releasing-artifacts.md](releasing-artifacts.md)        |

Adding another is adding a stub to `workflow-stubs/`, the reusable workflow it
calls to `.github/workflows/`, and a page beside these — the contract on this
page does not change.

## Where things live

For a standard workflow named `<name>`:

- The stub to install: `platform-actions/workflow-stubs/<name>.yml` — fetched
  from here by `vortex repo gha install`, so this is the only copy
- The reusable workflow it calls:
  `platform-actions/.github/workflows/<name>.yml`
- Shared building blocks: `platform-actions/actions/` — e.g.
  `setup-vortex-repo`, `assert-clean-tree`
- The target definitions:
  [script-targets.md](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/script-targets.md)
