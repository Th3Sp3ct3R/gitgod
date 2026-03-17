---
name: workflow
description: |
  Run the full development workflow: CEO Review → Eng Review → Implement → Review → Ship → QA → Retro.
  Manages state across phases, prompts for approvals, and tracks progress.
version: 1.0.0
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
---

# /workflow

Run the portable workflow orchestrator that works in Claude Code, OpenCode, or standalone CLI.

## Usage

```bash
/workflow start <plan.md>                    # Start new workflow
/workflow resume                              # Resume current workflow
/workflow continue                            # Approve and continue to next phase
/workflow continue --reject                   # Reject and rollback
/workflow status                              # Show current status
/workflow pause "<reason>"                    # Pause workflow
/workflow reset                               # Clear all state
```

## Workflow Phases

1. **CEO Review** - Strategic review, 10x thinking, dream state mapping
2. **Eng Review** - Architecture, security, edge cases, performance
3. **Implementation** - Write code based on approved plan
4. **Review** - Code review for bugs and quality
5. **Ship** - Run tests, merge, create PR
6. **QA** - Test the shipped feature
7. **Retro** - Review what went well and improvements

## State Management

Workflow state is persisted in `.workflow/state.json`:
- Current phase
- Context (plan path, branch, decisions, notes)
- History of completed phases
- Pause/resume capability

## Quick Start

1. Create a plan document (e.g., `docs/FEATURE.md`)
2. Run: `/workflow start docs/FEATURE.md`
3. Follow prompts through each phase
4. Workflow auto-advances or waits for approval at gates

## Implementation

This skill wraps the `workflow-agent` CLI. The core logic is environment-agnostic
and works in Claude Code, OpenCode, or any terminal.
