---
name: vortex-tkt-status
description: The status of a ticket and of all its sub-tickets, one line each. Use on /vortex-tkt-status <ticket>, or when asked for a ticket's status.
---

<!-- Vortex platform skill. This file is overwritten by `vortex repo profile apply`. Don't edit. -->

# Ticket status

The ticket is: $ARGUMENTS

1. If no ticket was given, ask which ticket, and stop.
2. Read the ticket from Linear: its identifier, status and title.
3. Find its sub-tickets in Linear (the issues whose parent is this ticket), and
   theirs in turn, until there are none left.
4. Print one line per ticket: the identifier, the status, and a short
   description of a few words. The ticket comes first, then its sub-tickets
   indented under it. Nothing else.

Example:

```
OPS-100  In Progress  Move the build to new runners
  OPS-101  Done         Runner images
  OPS-102  In Review    Switch the workflows over
```
