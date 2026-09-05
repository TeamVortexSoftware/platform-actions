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
* [Script targets: the usual touch point](#script-targets-the-usual-touch-point)
* [Installing a stub](#installing-a-stub)
* [What is yours, and what is not](#what-is-yours-and-what-is-not)
* [Staying current](#staying-current)
* [Inputs and secrets](#inputs-and-secrets)
* [The standard workflows](#the-standard-workflows)
* [Where things live](#where-things-live)
<!-- vtxmd:end -->

## What every standard workflow is

Two things are true of every one of them, and a third is the shape they nearly
always take.

**A stub in your repo.** GitHub only runs workflows it finds in
`.github/workflows/`, so a file has to exist in the repo — you cannot simply
point at someone else's. A stub is the smallest such file: a name, and the
handful of choices that are genuinely yours.

**A managed file, not a snippet.** A stub is installed, updated and removed with
`vortex repo gha`, and every part of it that is platform-owned is refreshed from
here each time. What a repo may change is fenced; everything outside the fence
follows this repo.

**And, as a rule, a reusable workflow here.** Every line that decides what the
workflow _does_ lives in platform-actions, so the stub is a `uses:` and a few
inputs.

```
repo's PR / push / tag  →  .github/workflows/vtx-<name>.yml   (the stub, in your repo)
                                    ↓  uses:
                       platform-actions/.github/workflows/<name>.yml   (all the logic)
```

**Those are two files in two repos, and that split is the point.** When what a
workflow _means_ changes, this repo changes and **no consuming repo is touched**.
A stub that held the logic itself would forfeit that, so a standard workflow
delegates unless it has a reason not to.

What a standard workflow **asks of your repo** is not part of the definition, and
varies. The established way to ask is a script target, and most use one — but
`promote-repo` asks for nothing in your `package.json` at all, and a workflow is
free to bring its own tooling instead. Each workflow's page says what its own
needs are; the section below is the shared convention it will most likely be
reaching for.

## Script targets: the usual touch point

Where a standard workflow does need something from your repo, the platform's
answer is a **target** — a `package.json` script with a reserved name. The
`vortex:<concern>:<action>` namespace is reserved for them, and `:all` is the
contract: a standard workflow calls only `vortex:<concern>:all`, never a leaf.

The indirection is what lets one workflow serve the vortex CLI's repo, a
Terraform data repo and a shared-actions repo without knowing anything about any
of them — it invokes a name, and what that name does inside your repo is
entirely yours.

**A stub declares which targets its workflow runs**, in its header, so
`vortex repo gha install` and `update` say when one is missing from the repo's
`package.json` and point at `vortex repo profile apply`. That is advisory: the
install still succeeds. Today:

| Workflow       | Declares                                                                   |
| -------------- | -------------------------------------------------------------------------- |
| `repo-verify`  | `vortex:lint:all` `vortex:test:all` `vortex:generate:all` `vortex:build:all` |
| `repo-release` | `vortex:build:all`                                                         |
| `promote-repo` | `none` — spelled out, so a reader can tell it was decided rather than forgotten |

So adopting a workflow that uses targets is two things: installing the stub,
which is one command, and making sure the targets it calls exist and actually do
something. **A target you have not filled in is not an error** — a target is
normally invoked with `pnpm run --if-present`, so an undefined one exits 0 and
the job succeeds having done nothing. The default repo profile ships each
`vortex:<concern>:all` as a runnable `echo` placeholder for the repo's keeper to
fill in, so `--if-present` is the safety net, not the design. A workflow may
choose to be stricter — `repo-release` calls `vortex:build:all` without it, so an
unplumbed target fails the release rather than shipping nothing.

The namespace itself, and every target in it, is defined in
[script-targets.md](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/script-targets.md).
Which targets a given workflow runs, and what it additionally demands of them, is
on that workflow's own page.

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
- The target definitions, for the workflows that use them:
  [script-targets.md](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/script-targets.md)
