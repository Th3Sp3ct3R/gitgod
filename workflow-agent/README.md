# Workflow Agent

Portable workflow orchestrator for the complete development lifecycle:

**CEO Review → Eng Review → Implement → Review → Ship → QA → Retro**

Works everywhere: Claude Code, OpenCode, or standalone CLI.

## Features

- **🔄 Full Lifecycle Management** - Tracks progress through all 7 phases
- **📊 State Persistence** - Resume workflows across sessions
- **🚦 Human Gates** - Pause for approval at critical checkpoints
- **🌐 Environment Agnostic** - Same CLI works in Claude, OpenCode, or terminal
- **↩️ Rollback Support** - Reject phases and roll back to fix issues
- **📈 Progress Tracking** - See phase history and timing

## Installation

```bash
# Clone or download
npm install
npm run build

# Link globally (optional)
npm link
```

## Usage

### Start a Workflow

```bash
workflow start docs/FEATURE.md
workflow start docs/FEATURE.md --branch feat/user-auth
```

### Commands

| Command | Description |
|---------|-------------|
| `workflow start <plan>` | Start new workflow from plan document |
| `workflow resume` | Resume current workflow |
| `workflow continue` | Approve current phase and advance |
| `workflow continue --reject` | Reject phase and rollback |
| `workflow status` | Show current status and history |
| `workflow pause "<reason>"` | Pause workflow for later |
| `workflow reset` | Clear all workflow state |
| `workflow run <phase>` | Run specific phase directly |

### Workflow Phases

1. **CEO Review** - Strategic review with 10x thinking and dream state mapping
2. **Eng Review** - Architecture, security, error mapping, performance
3. **Implementation** - Code based on approved plan
4. **Review** - Quality review for bugs and issues
5. **Ship** - Tests, merge, PR creation
6. **QA** - Feature testing
7. **Retro** - What went well, improvements, action items

## State File

Workflow state is stored in `.workflow/state.json`:

```json
{
  "version": "1.0.0",
  "currentPhase": "eng_review",
  "context": {
    "planPath": "docs/FEATURE.md",
    "branchName": "feat/user-auth",
    "ceoFeedback": ["Add mobile section"]
  },
  "history": [
    { "phase": "ceo_review", "startedAt": "...", "completedAt": "..." }
  ]
}
```

## Environment Detection

The orchestrator automatically detects your environment:

- **Claude Code** - Uses native gstack skills (`/plan-ceo-review`, `/review`, etc.)
- **OpenCode** - Spawns Task agents for each phase
- **Standalone** - Interactive CLI with prompts

## Integration with gstack

When running in Claude Code with gstack installed:

```bash
# Native skill integration
/workflow start docs/FEATURE.md
# Runs: /plan-ceo-review → /plan-eng-review → /review → /ship → /qa → /retro
```

## Configuration

Create `.workflow/config.yaml` to customize:

```yaml
defaults:
  autoApprove: false
  timeoutMinutes: 30

phases:
  ceo_review:
    requiresApproval: true
  implementing:
    timeoutMinutes: 120
```

## Development

```bash
npm install
npm run dev -- start docs/test.md
npm run typecheck
npm test
```

## Architecture

```
┌─────────────────────────────────────────┐
│  CLI Entry (src/cli.ts)                 │
├─────────────────────────────────────────┤
│  WorkflowOrchestrator                   │
│  - Phase management                     │
│  - State transitions                    │
│  - Approval gates                       │
├─────────────────────────────────────────┤
│  Adapters                               │
│  - Claude: gstack skills                │
│  - OpenCode: Task tool                  │
│  - Standalone: Interactive CLI          │
├─────────────────────────────────────────┤
│  StateManager (src/state.ts)            │
│  - Persistence                          │
│  - Migration                            │
└─────────────────────────────────────────┘
```

## License

MIT
