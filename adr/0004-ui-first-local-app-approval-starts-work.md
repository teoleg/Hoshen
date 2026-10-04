---
id: ADR-0004
title: Hoshen is a local UI-first app where approving an ADR starts the work
status: proposed
date: 2026-10-04
deciders: [teoleg]
supersedes: [ADR-0003]
amends: []
depends_on: [ADR-0001, ADR-0002]
constraints:
  - id: ADR-0004.C1
    rule: Hoshen v1 is a local app started in the user's project; its web UI is the main surface and its server listens on 127.0.0.1 only.
  - id: ADR-0004.C2
    rule: Approving an ADR in the UI is the only thing that starts implementation work, and each run implements exactly one approved ADR.
  - id: ADR-0004.C3
    rule: Runs use the Claude Agent SDK authenticated with the user's own API key or cloud provider credentials, never a claude.ai login.
  - id: ADR-0004.C4
    rule: Each run works on its own branch hoshen/adr-NNNN; nothing reaches the main branch until the user accepts it in the UI.
  - id: ADR-0004.C5
    rule: A run that changes an existing ADR file fails; agents add new ADRs only as proposed, through Hoshen's propose tool.
  - id: ADR-0004.C6
    rule: The UI reads and writes ADR files in the repository, keeps no other store of ADR state, and validates every change before writing it.
history:
  - status: proposed
    date: 2026-10-04
    by: claude
    reason: Owner chose the UI-first experience (model B) over ADR-0003's terminal-first plugin.
---

# ADR-0004: Hoshen is a local UI-first app where approving an ADR starts the work

## Context

ADR-0003 made Hoshen a Claude Code plugin with a UI on the side. Walking
through the user experience showed that this was not the owner's idea: there,
the developer still works in the Claude Code terminal and prompts freely, and
the ADR-only rule is an honor system.

The owner's idea is development driven only by ADRs, with Claude Code as the
engine underneath. The owner chose that experience (model B) on 2026-10-04.

Facts from the Claude Agent SDK docs, checked on 2026-10-04
(code.claude.com/docs/en/agent-sdk):

- **Authentication:** "Unless previously approved, Anthropic does not allow
  third party developers to offer claude.ai login or rate limits for their
  products, including agents built on the Claude Agent SDK." Allowed: API key,
  Amazon Bedrock, Google Vertex, Microsoft Foundry, Claude Platform on AWS.
- The SDK bundles the Claude Code binary; no separate install is needed.
- With `settingSources` including `"project"`, a run loads the project's
  `CLAUDE.md`, rules, skills, hooks and settings.
- A run streams progress messages, can be restricted to set tools
  (`allowedTools`, `disallowedTools`, `canUseTool`), takes a `cwd`, a permission
  mode and programmatic hooks, and can be stopped with `interrupt()`.

## Decision

### 1. The user experience

1. **Start.** In a project folder the user runs `npx hoshen`. Hoshen opens
   `http://127.0.0.1:<port>` in the browser. A project with no `adr/` folder
   gets one, with the generated index and constraints files.
2. **See.** The main view is the ADR graph: nodes are ADRs coloured by state,
   edges are `supersedes`, `amends` and `depends_on`. Selecting a node shows the
   ADR, its constraints, its history and its runs.
3. **Write.** "New ADR" opens an editor with a Claude panel that helps draft
   context, options, decision and constraints. Saving creates the file as
   `proposed`.
4. **Decide.** The user approves, rejects, suspends or resumes. Each action
   writes the status and a history entry to the file.
5. **Run.** Approving an ADR starts a run (section 2). Its node shows the run
   state and a live log.
6. **Review.** When a run finishes, the UI shows the changes, the check
   results and the link back to the ADR. The user accepts the run, or rejects
   it (the branch is kept; the ADR stays `approved` for another run or a
   decision).
7. **Complete.** Accepting merges the branch into the main branch and runs the
   project's checks. If they pass, Hoshen (as `system`) sets the ADR to
   `completed`.

The user never types prompts into Claude Code. The only way to start
development is to approve an ADR.

### 2. Runs

- Hoshen's local server starts a run with the Claude Agent SDK, `cwd` set to
  the project, and `settingSources: ["project"]` so the project's `CLAUDE.md`
  and the constraints in force are loaded.
- The prompt is built from the ADR (full text) and the ADRs it depends on.
- The run works on a branch `hoshen/adr-NNNN` in its own git worktree, so the
  user's working copy is not touched.
- One run at a time per project in v1.
- Suspending an ADR interrupts its running run.
- A run that ends in error leaves the ADR `approved` and shows the failure.

### 3. Keeping agents inside the rules

- Runs cannot edit existing ADR files: Hoshen's `canUseTool` and PreToolUse
  checks refuse edits under `adr/`, and after the run Hoshen compares the
  branch with its base and fails the run if any existing ADR file changed.
  The second check also catches changes made through the shell.
- Agents propose new ADRs only through a Hoshen tool that writes them as
  `proposed` and validates them.
- Status changes come only from the UI, made by a person, or from Hoshen as
  `system` for `completed`.

This closes, for runs, the gap ADR-0003 recorded as a known limit.

### 4. Checks

A project lists its check commands (for example `npm test`) in a Hoshen
config file in the repository. "Checks pass" for `completed` means all of
them exit with success after the merge. The file format is set by the stack
ADR.

### 5. Authentication and cost

Users provide their own Anthropic API key, or Bedrock, Vertex or Foundry
credentials. Hoshen never offers claude.ai login. Usage is billed to the
user's account per token; the UI shows the cost of each run.

### 6. Distribution

Other projects use Hoshen by running it in their folder (`npx hoshen`); it is
published as an npm package. A Claude Code plugin with ADR skills, for people
who also work in Claude Code directly, is optional and left for a later ADR.

## Consequences

- The product is the UI. The stack ADR must cover the UI, the local server,
  run management with the Agent SDK, and the ADR engine (today's
  `tools/adr.mjs`).
- **Users cannot use their Claude Pro or Max subscription** for Hoshen runs;
  they pay API rates. This is the largest product consequence of this ADR.
- Runs execute on the user's machine with a shell and the user's file
  permissions, like their own Claude Code would. Worktrees separate the files,
  not the machine. Stronger isolation (containers) needs its own ADR.
- The ADR rules become enforced by the product, not only written in
  `CLAUDE.md`, for everything Hoshen starts. A user who opens Claude Code
  in the project directly is outside Hoshen's control; the constraints in
  `CLAUDE.md` still apply there.
- ADR-0003 stays `approved` and is superseded once this ADR is approved; its
  constraints then leave `CONSTRAINTS.md`.

## Alternatives considered

- **Keep ADR-0003 (terminal-first plugin):** smaller to build, but the ADR-only
  rule is optional, which is not the product the owner wants.
- **Hosted platform running agents for users:** works without installing
  anything, but needs hosting, sandboxing, key storage and tenancy before the
  core loop is proven. Still deferred.
- **Driving the Claude Code CLI (`claude -p`) instead of the SDK:** the SDK
  gives streaming, tool control, hooks and interrupt as an API, which Hoshen
  needs to enforce the rules. The CLI would mean parsing output.
- **Using the user's claude.ai login:** not allowed for third-party products
  without Anthropic's approval.

## Open questions

- Should Hoshen ask Anthropic for approval to offer claude.ai login later,
  so subscription users can use it?
- Run permissions: which tools a run may use by default (shell, network), and
  whether the user can change that per project.
