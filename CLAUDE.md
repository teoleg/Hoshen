# CLAUDE.md — Hoshen

Hoshen is an ADR-driven agentic development platform built on Claude Code.
Architecture Decision Records are the only driver of work: people decide in
ADRs, agents build only what an approved ADR says, and a UI shows the ADRs as
a graph.

## How we work

- No work without an approved ADR (ADR-0001). If a task has no approved ADR
  behind it, draft one as `proposed` and stop for the owner's decision.
- ADRs live in `adr/`, one file each: `NNNN-short-slug.md`, YAML frontmatter
  as defined in ADR-0001 and ADR-0002. Overview: `adr/README.md`.
- `adr/README.md` and `adr/CONSTRAINTS.md` are generated. Never edit them by
  hand; run the generator.
- Write commit messages to a file and use `git commit -F`.

## Commands

```bash
node tools/adr.mjs generate   # rebuild adr/README.md and adr/CONSTRAINTS.md
node tools/adr.mjs check      # validate ADRs; fails if generated files are stale
```

## Constraints in force

Generated from the approved and completed ADRs (ADR-0002):

@adr/CONSTRAINTS.md
