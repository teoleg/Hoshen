---
id: ADR-0003
title: Hoshen ships as a Claude Code plugin with a local web UI
status: approved
date: 2026-10-04
deciders: [teoleg]
supersedes: []
amends: []
depends_on: [ADR-0001, ADR-0002]
constraints:
  - id: ADR-0003.C1
    rule: Hoshen v1 is a Claude Code plugin; the user's own Claude Code session does the agent work, so do not build a server that runs agents.
  - id: ADR-0003.C2
    rule: The UI reads and writes ADR files in the project's repository and keeps no other store of ADR state.
  - id: ADR-0003.C3
    rule: Every ADR change made through the UI or the plugin passes the same validation as node tools/adr.mjs check before it is written.
  - id: ADR-0003.C4
    rule: The local UI server listens on 127.0.0.1 only.
history:
  - status: proposed
    date: 2026-10-04
    by: claude
    reason: Drafted after the owner asked for Hoshen to be offered as an agent for other projects.
  - status: approved
    date: 2026-10-04
    by: teoleg
    reason: Owner agreed to plugin-first with a local UI and static export, hosted app later.
---

# ADR-0003: Hoshen ships as a Claude Code plugin with a local web UI

## Context

The owner wants Hoshen offered as an agent that other projects can use, and
needs a way to reach Hoshen's visual UI (the ADR graph, editing, approving)
while working in Claude Code.

Two product shapes were possible:

- **Platform-first:** Hoshen runs its own backend that starts agents
  (Claude Agent SDK) against users' repositories.
- **Plugin-first:** Hoshen is installed into a project as a Claude Code plugin,
  and the developer's own Claude Code session is the agent.

ADR-0001 says agents never approve, reject, suspend or resume ADRs, so
people need a place outside the agent conversation to make those decisions.

## Decision

### 1. Distribution: a Claude Code plugin

Hoshen v1 is a Claude Code plugin that any project can install. It bundles:

- **Skills** for writing ADRs and their constraints, and for implementing an
  approved ADR.
- **Commands** such as `/hoshen:new-adr`, `/hoshen:status`, `/hoshen:ui`.
- **Hooks** that run the ADR check and keep work tied to approved ADRs.
- **An MCP server** with ADR tools (list, read, propose, graph).
- **The UI** (below).

The ADR rules (ADR-0001, ADR-0002) apply to every project that installs it:
ADRs live in that project's `adr/` folder.

### 2. UI: a local web app, plus a static export

- **Local web UI.** `/hoshen:ui` starts a small server on the developer's
  machine and prints its address (for example `http://127.0.0.1:4747`). The UI
  shows the ADR graph and lets a person edit, approve, reject, suspend and
  resume ADRs. Each action writes the ADR file (status and history) in the
  repository.
- **Static export.** A command renders the graph and the ADR table to one
  self-contained HTML file. It is read-only and works where the local UI cannot
  be reached, such as cloud sessions, or for sharing.

Roles: **people decide in the UI, agents build in Claude Code, and the git
repository connects the two.**

### 3. Later, not now

- A **hosted Hoshen web app** that connects to repositories on GitHub, for teams
  and cloud sessions. It brings logins, repository access and tenancy, and gets
  its own ADR when needed.
- **In-chat UI** (MCP Apps): see Open questions.

## Consequences

- No agent backend in v1: no service to host, no API keys held by Hoshen,
  and each developer pays for their own Claude usage.
- The tech stack ADR covers the plugin, the MCP server and the UI only.
- The local UI only works where Claude Code runs on the developer's own
  machine. Cloud sessions get the read-only static export until the hosted
  app exists.
- **Known limit: the human-only approval rule is not yet enforced.** An agent
  with file and shell access can edit an ADR's status or call the local UI's
  API directly. Until a later ADR adds enforcement (for example a hook that
  refuses agent edits to `status` and `history`), the rule rests on the
  constraints in `CLAUDE.md`.

## Alternatives considered

- **Platform-first (Hoshen backend runs agents):** more control over runs and
  isolation, but needs hosting, sandboxing, key handling and tenancy before the
  core loop can be proven. Deferred, not rejected.
- **Hosted web app as the only UI:** works everywhere, but forces running a
  service and handling logins from day one.
- **Terminal-only UI:** no service at all, but a graph of decisions is hard to
  read and impossible to click in a terminal.

## Open questions

- **In-chat UI (MCP Apps).** Checked against the docs on 2026-10-04: Claude
  Code "calls the tool as text and doesn't render the UI"; the Claude desktop
  app and claude.ai do render MCP Apps
  (claude.com/docs/connectors/building/mcp-apps/quickstart). So it cannot be
  the main UI for Claude Code users. The same MCP server could later offer an
  MCP App view for desktop and claude.ai users; that needs its own ADR.
- **How the UI server runs.** Plugins can run background processes for the
  session as "monitors" (code.claude.com/docs/en/plugins/components), or
  `/hoshen:ui` can start the server itself. The stack ADR decides.
- How the human-only approval rule gets enforced (see Consequences).
