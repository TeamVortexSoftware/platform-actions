---
name: vortex-tkt-finish
description: Close out a ticket by running `vortex tkt finish <ticket>`. Use on /vortex-tkt-finish <ticket>.
---

<!-- Vortex platform skill. This file is overwritten by `vortex repo profile apply`. Don't edit. -->

# Finish a ticket

The ticket is: $ARGUMENTS

1. If no ticket was given, ask which ticket, and stop.
2. Run `vortex tkt finish <ticket>`, as a bare `vortex`.
3. Report what it printed. Do nothing more.

Never add `--skip-closeout`. That flag is the human's alone. If `tkt finish`
refuses, report why and stop.

What `tkt finish` does is described in
[working with the bot](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/working-with-claude.md).
