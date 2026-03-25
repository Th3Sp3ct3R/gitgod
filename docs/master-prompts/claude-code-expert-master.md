---
name: claude-code-expert-master
description: "Comprehensive Claude Code expert system prompt"
---

# CLAUDE CODE EXPERT - MASTER

> Complete guide to maximizing productivity with Claude Code

---

## FUNDAMENTALS

Claude Code is Anthropic's CLI for using Claude as a coding agent directly in the terminal. Unlike Claude.ai web, Claude Code:

- Accesses your filesystem directly
- Executes bash, git, npm, etc.
- Persists context via CLAUDE.md and memory files
- Supports MCP servers (tool extensions)
- Supports hooks (pre/post-action automations)
- Can create and orchestrate sub-agents via Task tool

---

## INSTALLATION & SETUP

```bash
npm install -g @anthropic-ai/claude-code
claude                    # start interactive session
claude "your task"       # non-interactive mode
claude --help            # see all flags
```

### Essential Flags

```bash
claude -p "prompt"              # print mode, ideal for scripts
claude --model claude-opus-4    # specify model
claude --max-tokens 8192        # token limit
claude --no-stream              # no streaming
claude --output-format json     # JSON output
claude --allowed-tools "Bash,Read,Write"  # limit tools
claude --dangerously-skip-permissions     # skip confirmations (careful!)
claude --max-turns 50                     # max autonomous turns
```

---

## CLAUDE.MD - PROJECT BRAIN

The CLAUDE.md file in project root is loaded automatically in EVERY session. It's the most powerful way to give persistent context.

### Hierarchy

1. `~/.claude/CLAUDE.md` - global, loaded in every project
2. `/project/CLAUDE.md` - project level
3. `/project/subfolder/CLAUDE.md` - subfolder level, loaded when navigating

### Recommended Structure

```markdown
# Project Context
- What this project is
- Technologies used
- Architecture overview

# Essential Commands
- npm install
- npm run dev
- npm test

# Code Patterns
- How to structure code
- Testing approach
- Common patterns

# Important Files
- src/main.ts
- tests/*.test.ts

# DON'T
- Don't modify the database directly
- Always run tests before committing
```

---

## HOOKS SYSTEM

Hooks run automatically before/after actions.

### Hook Types

| Hook | When | Use Case |
|:-----|:-----|:---------|
| PreToolUse | Before tool execution | Validate, transform args |
| PostToolUse | After tool execution | Log, notify, transform result |
| Notification | Async notifications | Slack, email alerts |

### Example Hook

```javascript
// claude hooks.json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "echo 'Running: ${tool_name} ${JSON.stringify(tool_input)}'"
        }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [{
          "type": "command", 
          "command": "eslint ${tool_input.path} --fix"
        }]
      }
    ]
  }
}
```

---

## MCP (MODEL CONTEXT PROTOCOL)

MCP extends Claude's capabilities with custom tools.

### Installation

```bash
# Install an MCP server
npx @modelcontextprotocol/server-filesystem /path/to/dir

# Add to claude config
claude config add-mcp /path/to/server.js
```

### Common MCP Servers

- **filesystem** - Read/write local files
- **github** - GitHub API operations
- **gitlab** - GitLab integration
- **slack** - Slack messaging
- **postgres** - Database queries
- **memory** - Persistent memory

---

## SUB-AGENTS

Create and orchestrate sub-agents for parallel tasks.

### Task Tool

```bash
# Create sub-agent task
Task: "Review the authentication code in src/auth/"
```

### Parallel Execution

```python
# Multiple sub-agents in parallel
Task: "Review src/api/ handler"
Task: "Review src/database/ queries"
Task: "Review src/utils/ helpers"
```

### Sub-Agent Patterns

```python
class SubAgentManager:
    def create_subagent(self, task: str, context: dict):
        return {
            "task": task,
            "context": context,
            "tools": self.default_tools,
            "model": "claude-3-sonnet"
        }
    
    def orchestrate(self, tasks: List[str]) -> List[Result]:
        results = []
        for task in tasks:
            result = self.execute_subagent(task)
            results.append(result)
        return self.aggregate(results)
```

---

## MEMORY SYSTEMS

### CLAUDE.md (Persistent Context)

```markdown
# Memory
- Last worked on: User authentication
- User prefers: TypeScript over JavaScript
- Current goal: Build MVP by Friday
```

### Memory Files

```bash
# Create memory file
claude memory create "project-context"

# Add to memory
claude memory add "Remember that the API uses v2 endpoints"

# Search memory
claude memory search "authentication"
```

### Vector Memory (MCP)

```python
class VectorMemory:
    def __init__(self):
        self.store = Chroma()
    
    def add(self, content: str, metadata: dict = {}):
        embedding = self.embed(content)
        self.store.add(embedding, content, metadata)
    
    def search(self, query: str, k: int = 5):
        query_embedding = self.embed(query)
        return self.store.search(query_embedding, k)
```

---

## WORKFLOWS

### Recommended Workflow Patterns

1. **Quick Task**: Direct command
   ```bash
   claude "fix the login bug"
   ```

2. **Complex Task**: Interactive mode
   ```bash
   claude
   # Then describe your task
   ```

3. **Scripted**: Print mode
   ```bash
   claude -p "Review src/auth.ts and list security issues" > review.md
   ```

4. **Agent Loop**: Max turns
   ```bash
   claude --max-turns 50 "Build a full REST API"
   ```

---

## PRODUCTIVITY TIPS

| Tip | Description |
|:----|:------------|
| Use CLAUDE.md | Project context persists across sessions |
| Chain commands | `claude "do X" && claude "do Y"` |
| Use Task tool | Parallel sub-agents |
| Limit tools | `--allowed-tools` for safety |
| Set max-turns | Control autonomy level |
| MCP servers | Extend capabilities |
| Hooks | Automate repetitive tasks |

---

## DEBUGGING

### View Logs

```bash
claude logs --recent
claude logs --errors
```

### Verbose Mode

```bash
claude --verbose "your task"
```

### Check Config

```bash
claude config list
claude config get hooks
```
