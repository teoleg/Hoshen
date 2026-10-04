---
id: ADR-0002
title: Generated ADR index and shared constraints loaded into every Claude session
status: approved
date: 2026-10-04
deciders: [teoleg]
supersedes: []
amends: [ADR-0001]
depends_on: [ADR-0001]
constraints:
  - id: ADR-0002.C1
    rule: Declare each constraint in the frontmatter of the ADR that imposes it, with an id ADR-NNNN.Cn that is never reused.
  - id: ADR-0002.C2
    rule: Never edit adr/README.md or adr/CONSTRAINTS.md by hand; regenerate them with node tools/adr.mjs generate.
  - id: ADR-0002.C3
    rule: After changing any ADR, run node tools/adr.mjs check and commit only when it passes.
history:
  - status: proposed
    date: 2026-10-04
    by: claude
    reason: Drafted from the owner's request for an ADR table and a shared constraints file.
  - status: approved
    date: 2026-10-04
    by: teoleg
    reason: Approved by the owner, including that constraints of suspended ADRs are not in force.
---

# ADR-0002: Generated ADR index and shared constraints loaded into every Claude session

## Context

Decisions only steer agents if the agents see them. Reading every ADR in full
on every task does not scale, and people need a quick overview of all
decisions and their states.

The owner asked for two things:

1. A README with a table of all ADRs.
2. A constraints file that collects the rules ADRs impose and is part of every
   prompt Claude works from.

Claude Code has a built-in way to keep text in context: the project
`CLAUDE.md` is loaded at session start and re-read from disk after `/compact`.
It can pull in other files with `@path` imports (relative to the importing
file, up to 4 levels deep). Source: code.claude.com/docs/en/memory.

## Decision

### 1. Constraints are declared in the ADR that imposes them

ADR frontmatter (defined in ADR-0001) gains an optional `constraints` field:
a list of short, testable rules, each with a stable id.

```yaml
constraints:
  - id: ADR-0001.C1
    rule: Start implementation work only from an ADR whose status is approved.
```

- Ids are `ADR-NNNN.Cn` and are never reused.
- A rule is one imperative sentence an agent can follow without reading the
  whole ADR.
- The ADR stays the source of truth; the constraint links back to it.

### 2. Two generated files

| File | Contents |
|---|---|
| `adr/README.md` | Table of every ADR: id, title, status, date, links (supersedes, amends, depends_on) |
| `adr/CONSTRAINTS.md` | Every constraint currently in force, grouped by ADR, each linking to its ADR |

A constraint is **in force** when its ADR is `approved` or `completed` and no
`approved` or `completed` ADR supersedes it. Constraints of `proposed`,
`suspended` and `rejected` ADRs are left out.

Both files are generated from the ADR frontmatter by a script and are never
edited by hand. A check fails when either file is out of date with the ADRs.
The root `README.md` links to `adr/README.md`.

### 3. Loaded through `CLAUDE.md`

The project `CLAUDE.md` imports the constraints file:

```
@adr/CONSTRAINTS.md
```

This puts the constraints in context for the whole session and after every
compaction, without repeating them on each message.

## Consequences

- One source of truth: the ADR. The table and the constraints list cannot
  drift, because they are generated and checked.
- Every Claude Code session in the repo, including agents Hoshen runs, starts
  with the constraints in force.
- `CONSTRAINTS.md` costs context on every session, so rules must stay short.
  If it grows large, a later ADR can split constraints into path-scoped
  `.claude/rules/` files.
- Writing an ADR now includes writing its constraints. An ADR with none is
  allowed; it then steers only by its text.
- The generator and check are the first code Hoshen needs. Its language follows
  the stack ADR.

## Alternatives considered

- **Hand-maintained table and constraints file:** simplest, but drifts from the
  ADRs within weeks, and then agents follow stale rules.
- **A `UserPromptSubmit` hook that injects constraints on every message:**
  repeats the same text each turn, is capped at 10,000 characters, and adds
  nothing `CLAUDE.md` does not already give. Kept in reserve for per-prompt
  context that `CLAUDE.md` cannot provide.
- **Constraints written straight into `CLAUDE.md`:** mixes project
  instructions with generated content, and makes generation harder.
- **Path-scoped `.claude/rules/` files from the start:** useful once there are
  many constraints tied to parts of the code. Premature with two ADRs.

## Resolved questions

- Constraints of a `suspended` ADR are not in force while it is paused
  (owner, 2026-10-04).
- Until the stack ADR exists, the generator is plain Node with no
  dependencies, so it does not wait on that decision.
