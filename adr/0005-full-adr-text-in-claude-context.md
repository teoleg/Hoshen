---
id: ADR-0005
title: The full text of ADRs in force is loaded into every Claude session
status: proposed
date: 2026-10-04
deciders: [teoleg]
supersedes: []
amends: [ADR-0002]
depends_on: [ADR-0002]
constraints:
  - id: ADR-0005.C1
    rule: Never edit adr/CONTEXT.md by hand; it is generated with adr/README.md and adr/CONSTRAINTS.md.
  - id: ADR-0005.C2
    rule: When the ADRs in force and a decision in a task disagree, follow the ADRs and draft a proposed ADR for the change instead of working around them.
history:
  - status: proposed
    date: 2026-10-04
    by: claude
    reason: Owner asked for ADR content, not only constraints, to be part of every session's context.
---

# ADR-0005: The full text of ADRs in force is loaded into every Claude session

## Context

ADR-0002 loads only the constraints of ADRs in force into Claude's context,
through `CLAUDE.md`. Constraints are short rules; they leave out the reasoning,
the decision in full and the alternatives already rejected. Without those, an
agent can follow the letter of a rule and miss its intent, or propose again
an option an ADR already turned down.

The owner asked for the ADR content itself to be included.

Context has a cost. Everything `CLAUDE.md` imports is loaded at the start of
every session and after every compaction. On 2026-10-04 the four ADRs are
23,571 characters in total, about 6,000 characters (roughly 1,500 tokens) each.
At that rate, 13 ADRs reach 80,000 characters.

## Decision

### 1. A third generated file: `adr/CONTEXT.md`

The generator (ADR-0002) also writes `adr/CONTEXT.md`: the full text (body,
without frontmatter) of every ADR **in force**, in id order, each under a
heading with its id, title, status and links.

"In force" is the same as for constraints: `approved` or `completed`, and not
superseded by an `approved` or `completed` ADR. Proposed, suspended and
rejected ADRs are left out; the index lists them.

### 2. `CLAUDE.md` loads three files

```
@adr/README.md        # every ADR and its status
@adr/CONSTRAINTS.md   # the rules in force
@adr/CONTEXT.md       # the full text of the ADRs in force
```

### 3. Runs get their ADR in full

A run (ADR-0004) also gets, in its prompt, the full text of the ADR it
implements and of every ADR that ADR depends on or amends. This matters most
for the target ADR: it is `approved`, so it is in `CONTEXT.md` too, but the
prompt names it as the task.

### 4. Size budget

`node tools/adr.mjs check` warns when `adr/CONTEXT.md` is over 80,000
characters (about 20,000 tokens). The warning does not fail the check. When it
appears, a new ADR must decide how to load less, for example:

- path-scoped `.claude/rules/` files, so an ADR loads only when Claude works on
  the files it governs, or
- loading only the Decision section of older ADRs, with the full file read on
  demand.

## Consequences

- Agents see why each decision was made and which options were rejected.
- Every session costs more context. At 4 ADRs that is about 6,000 tokens; it
  grows with every ADR approved.
- Large instruction files can lower how closely Claude follows any single
  instruction. The budget is there to force the scaling decision before that
  happens, not after.
- Superseded ADRs leave `CONTEXT.md` automatically, which keeps old decisions
  from steering new work.

## Alternatives considered

- **Constraints only (ADR-0002 as it was):** cheapest, but loses the reasoning.
- **Index plus constraints, ADRs read on demand:** cheap and scales, but relies
  on the agent choosing to read the right ADR. The owner wants the content
  present, not optional.
- **All ADRs, including proposed and rejected:** shows the most history, but
  puts undecided and refused options in front of the agent as if they were
  guidance.
- **Path-scoped rules from the start:** scales best, but needs every ADR to
  declare which files it governs. Kept as the first option once the budget is
  reached.
