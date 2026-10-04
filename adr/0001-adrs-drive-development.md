---
id: ADR-0001
title: ADRs are the only driver of development
status: approved
date: 2026-10-04
deciders: [teoleg]
supersedes: []
amends: []
depends_on: []
history:
  - status: proposed
    date: 2026-10-04
    by: claude
    reason: Founding decision drafted from the owner's brief.
  - status: approved
    date: 2026-10-04
    by: teoleg
    reason: Approved by the owner in the design session.
---

# ADR-0001: ADRs are the only driver of development

## Context

Hoshen is an agentic development platform built on Claude Code. Its premise is
that every piece of work traces back to a recorded decision. A person reads and
edits decisions in a UI and sees them as a graph; agents only build what an
approved decision tells them to build.

For that to hold, the decision record needs a fixed shape, a fixed lifecycle
and clear rules about what agents may do in each state. This ADR defines all
three. It applies to Hoshen itself as well as to projects Hoshen runs.

## Decision

### 1. ADRs drive all work

- Work (code, config, tests, infrastructure) starts only from an ADR in the
  `approved` state.
- Agents may read ADRs in any state, and may draft new ADRs as `proposed`.
  They never approve, reject, suspend or resume.
- An ADR in `completed` or `rejected` is never edited in substance. A change of
  mind is a new ADR that links to the old one (see section 4).

### 2. Storage and format

- ADRs live in the project's git repository under `adr/`, one Markdown file
  each, named `NNNN-short-slug.md`. The repository is the source of truth;
  any database is only an index of it.
- Each file starts with YAML frontmatter:

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | `ADR-NNNN`, unique, never reused |
| `title` | yes | The decision, as a short statement |
| `status` | yes | One of the five states below |
| `date` | yes | Date first proposed (ISO 8601) |
| `deciders` | yes | Who can move it out of `proposed` |
| `supersedes` | no | ADR ids this one replaces |
| `amends` | no | ADR ids this one changes in part |
| `depends_on` | no | ADR ids that must be `approved` or `completed` first |
| `history` | yes | Every state change: `status`, `date`, `by`, `reason` |

- The body has these sections: Context, Decision, Consequences,
  Alternatives considered, and optionally Open questions.

### 3. Lifecycle

Five states:

| State | Meaning | Agents may implement it? |
|---|---|---|
| `proposed` | Drafted, awaiting a decision | No, read and comment only |
| `approved` | Decided; work may start | Yes, the only state that starts work |
| `suspended` | Paused; running agent work is stopped | No |
| `rejected` | Decided against. Final | No |
| `completed` | Implemented and verified. Final | No |

Allowed transitions:

| From | To | Who |
|---|---|---|
| `proposed` | `approved`, `rejected`, `suspended` | A decider |
| `approved` | `suspended` | A decider |
| `approved` | `completed` | The system, when the ADR's work is merged and its checks pass |
| `suspended` | `approved` (default) or `proposed` (needs re-review) | A decider |
| `suspended` | `rejected` | A decider |
| `rejected`, `completed` | none | Final |

Every transition appends an entry to `history` with who made it, when and why.
A transition not in this table is invalid and must be refused.

### 4. Links, not extra states

- Replacing a decision is a link, not a state: the new ADR lists the old one in
  `supersedes`. The old ADR keeps its state and the graph draws the edge.
- Agent execution (queued, running, failed) is the status of a *run*, shown on
  the ADR's node. It is not an ADR state.
- `supersedes`, `amends` and `depends_on` are the edges of the ADR graph.

## Consequences

- The graph can be built from the files alone: nodes are ADRs, edges are the
  three link fields, colour is the state.
- `completed` can be trusted because no person sets it by hand. This needs
  a definition of "checks pass" per project, which a later ADR sets.
- Even small changes need an ADR to point to; see Open questions.
- Hoshen's own tooling will validate frontmatter and transitions. Until it
  exists, this ADR is followed by hand.

## Alternatives considered

- **Standard ADR statuses** (proposed, accepted, deprecated, superseded):
  they describe decisions, but not whether the work is done or paused. Hoshen
  drives work, so it needs `suspended` and `completed`.
- **A `superseded` state:** loses the old ADR's real outcome (was it built?).
  A link keeps both facts.
- **An `in-progress` state:** mixes the state of the decision with the state of
  its execution, and goes stale when a run dies. Run status covers it.
- **ADRs stored only in a database:** they'd drift away from the code and be
  unreadable without Hoshen running. Files in git avoid both.

## Open questions

- **Small changes:** must every typo fix or dependency bump point to its own
  ADR, or is there a lightweight amendment path under an existing one?
- **Human sign-off on `completed`:** is passing checks enough, or should a
  decider confirm?
- **Tenancy:** one isolated sandbox per user, or several users sharing one
  deployment. Separate ADR.
