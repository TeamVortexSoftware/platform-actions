---
name: vortex-tkt-shape
description: Shape a ticket or epic so it is ready to work, with the right sub-tickets, blocking links and doc links, in as few PRs as possible. Use on /vortex-tkt-shape <ticket>.
---

<!-- Vortex platform skill. This file is overwritten by `vortex repo profile apply`. Don't edit. -->

# Shape a ticket

The ticket is: $ARGUMENTS

This is a light pass. It makes a ticket ready to work. It does not design the
work. Spend minutes on it, not an hour.

1. If no ticket was given, ask which ticket, and stop.
2. Read the ticket from Linear, with its comments, its parent if it has one,
   and its sub-tickets and their blocking links. If it is a sub-ticket, shape
   its parent epic instead, and say so.
3. Work out which repos the work touches. Read code only far enough to answer
   that, and to name the terraform roots it touches.
4. Work out the shape the ticket should have, following
   [work that spans repos](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/working-with-claude.md#work-that-spans-repos):
   - Work in more than one repo is an epic with one sub-ticket per repo.
   - Production work is in its own sub-tickets, each blocked by the
     development work it depends on.
   - The order between sub-tickets is recorded as blocking links.
5. Then make it take as few PRs and as few rounds with the bot as possible:
   - Fold small sub-tickets for the same repo into one. One ticket is one set
     of PRs.
   - Put every decision the human has to make in a **Decisions** section at
     the top of the ticket, as a question. Don't answer it.
   - Write each ticket as a checklist of the work, in the order it is done.
   - Link the platform docs each ticket needs, chosen from the
     [documentation hub](https://github.com/TeamVortexSoftware/platform-repos/blob/main/docs/README.md).
   - Put the bot's detail (files, roots, commands) in a collapsible
     "Agent notes" section at the end of the description.
6. **Dry run: this is where every run stops.** Write nothing to Linear yet.
   Show exactly what would be written:
   - one line per ticket to create, change or link, indented under its epic;
   - for a ticket that would be created, its full title and description;
   - for a ticket that would be changed, the before and after of each field
     that changes, as a diff;
   - each blocking link to add or remove;
   - the open decisions.

   Then stop and wait.
7. Write to Linear only when the human says go, and write exactly what the
   dry run showed, nothing more. If anything has to change, show a new dry run
   first. Before creating a ticket, check that a matching one doesn't already
   exist. Report the result with the
   [ticket status](../vortex-tkt-status/SKILL.md) layout.

Never:

- delete or cancel a ticket. Folding two tickets into one means changing one
  and proposing that the human cancel the other;
- change a ticket that is Done or Canceled, or one with an open PR;
- change a ticket's status;
- design the work, or choose between options, in a ticket. An open question
  goes under Decisions.
