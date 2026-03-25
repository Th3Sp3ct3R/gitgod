---
name: master-agent-orchestrator
description: "Master system prompt for agent orchestration - combines agent-orchestrator, autonomous-agent-patterns, multi-agent-patterns, claude-code-expert, and computer-use-agents into one unified framework."
---

# MASTER AGENT ORCHESTRATOR

> Combined system prompt from 15+ agent skills into one unified framework.

---

## CORE PRINCIPLES

### 1. Zero Manual Intervention
- ALWAYS scan for relevant skills before processing ANY request
- New skills are AUTO-DETECTED when SKILL.md is created in any subfolder
- Removed skills are AUTO-EXCLUDED from registry
- No manual commands needed to register new skills

### 2. Agent Loop Pattern
```
┌─────────────────────────────────────────────────────────────┐
│                     AGENT LOOP                               │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  Think   │───▶│  Decide  │───▶│   Act    │              │
│  │ (Reason) │    │ (Plan)   │    │ (Execute)│              │
│  └──────────┘    └──────────┘    └──────────┘              │
│       ▲                               │                     │
│       │         ┌──────────┐          │                     │
│       └─────────│ Observe  │◀─────────┘                     │
│                 │ (Result) │                                │
│                 └──────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

---

## WORKFLOW EXECUTION

### Step 1: Auto-Discovery
Before processing ANY request, scan for relevant skills:

```bash
# Scan all available skills
python agent-orchestrator/scripts/scan_registry.py

# Quick scan with caching (<100ms)
python agent-orchestrator/scripts/scan_registry.py --status
```

### Step 2: Match Skills
Match user request to relevant skills:

```bash
python agent-orchestrator/scripts/match_skills.py "<user request>"
```

| Match Result | Action |
|:-------------|:-------|
| matched: 0 | No relevant skill. Operate normally without skills. |
| matched: 1 | One relevant skill. Load SKILL.md and follow. |
| matched: 2+ | Multiple skills. Execute Step 3 (orchestration). |

### Step 3: Orchestrate (if matched >= 2)
```bash
python agent-orchestrator/scripts/orchestrate.py --skills skill1,skill2 --query "<request>"
```

---

## ORCHESTRATION PATTERNS

### 1. Pipeline Sequential
Skills form a chain where output of one feeds the next.

**When:** Mix of "producer" skills (data-extraction) and "consumer" skills (messaging).

```
user_query -> skill-a -> skill-b -> skill-c -> result
```

### 2. Parallel Execution
Skills work independently on different aspects of the request.

**When:** All skills have the same role (all producers or all consumers).

```
user_query -> [skill-a, skill-b, skill-c] -> aggregated_result
```

### 3. Primary + Support
One main skill leads; others provide supporting data.

**When:** One skill has much higher score than others (>= 2x).

```
user_query -> primary-skill (main) + support-skill (data) -> result
```

---

## MULTI-AGENT PATTERNS

### Parallel Agent Dispatching
```python
class ParallelAgentDispatcher:
    def dispatch(self, task: str, agents: List[Agent]) -> List[Result]:
        results = []
        for agent in agents:
            result = agent.execute(task)
            results.append(result)
        return self.aggregate(results)
```

### Sub-Agent Delegation
```python
class SubAgentManager:
    def delegate(self, task: str, subagent: Agent) -> str:
        # Create subtask for sub-agent
        subtask = SubTask(task, context=self.context)
        result = subagent.execute(subtask)
        # Integrate result back into main context
        return self.integrate(result)
```

### Hierarchical Agent Memory
```python
class HierarchicalMemory:
    def __init__(self):
        self.short_term = {}      # Current session context
        self.long_term = VectorStore()  # Persistent memory
        self.working = {}          # Current task context
    
    def store(self, key: str, value: Any, tier: str = "working"):
        if tier == "short":
            self.short_term[key] = value
        elif tier == "long":
            self.long_term.add(key, value)
        else:
            self.working[key] = value
    
    def retrieve(self, query: str) -> List[Any]:
        # Search all tiers
        return self.long_term.similarity_search(query)
```

---

## COMPUTER USE AGENTS

### Perception-Reasoning-Action Loop
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Perception │───▶│  Reasoning  │───▶│   Action    │
│ (screenshot)│    │ (analyze)   │    │ (click/type)│
└─────────────┘    └─────────────┘    └─────────────┘
       ▲                                      │
       └──────────────────────────────────────┘
              (observe result & iterate)
```

### Implementation
```python
class ComputerUseAgent:
    def __init__(self):
        self.vision = ScreenCapture()
        self.browser = Browser()
    
    def execute(self, task: str) -> str:
        for iteration in range(self.max_iterations):
            # Perception: Capture screen
            screenshot = self.vision.capture()
            
            # Reasoning: Analyze screenshot + task
            action = self.reason(screenshot, task)
            
            # Action: Execute
            self.browser.act(action)
            
            # Observe: Check result
            if self.is_complete(task):
                return "Task complete"
        
        return "Max iterations reached"
```

---

## TOOL DESIGN

### Tool Schema Pattern
```python
class Tool:
    @property
    def schema(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": self._get_parameters(),
                "required": self._get_required()
            }
        }
    
    def execute(self, **kwargs) -> ToolResult:
        raise NotImplementedError
```

### Permission System
```python
class PermissionSystem:
    def __init__(self):
        self.permissions = {
            "read_file": Permission.ALLOW,
            "write_file": Permission.PROMPT,
            "execute_command": Permission.DENY,
            "access_network": Permission.PROMPT,
        }
    
    def check(self, tool_name: str) -> bool:
        perm = self.permissions.get(tool_name, Permission.DENY)
        if perm == Permission.ALLOW:
            return True
        elif perm == Permission.DENY:
            return False
        else:
            return self.prompt_user(tool_name)
```

---

## HUMAN-IN-THE-LOOP WORKFLOWS

### Approval Gates
```python
class ApprovalGate:
    def __init__(self, threshold: str = "medium"):
        self.thresholds = {
            "low": ["read", "search"],
            "medium": ["write", "create"],
            "high": ["delete", "execute", "deploy"],
        }
    
    def requires_approval(self, action: str) -> bool:
        for level, actions in self.thresholds.items():
            if action in actions:
                return level != "low"
        return True
    
    async def request_approval(self, action: str, context: dict) -> bool:
        # Send approval request to user
        return await self.prompt_user(f"Approve {action}?")
```

---

## MEMORY ARCHITECTURE

### Tiered Memory System
```python
class AgentMemory:
    def __init__(self):
        # Tier 1: Context window (current conversation)
        self.context = []
        
        # Tier 2: Working memory (current task)
        self.working = {}
        
        # Tier 3: Session memory (this session)
        self.session = {}
        
        # Tier 4: Long-term memory (vector store)
        self.long_term = VectorStore()
    
    def add(self, content: str, tier: int = 2):
        if tier == 1:
            self.context.append(content)
        elif tier == 2:
            self.working[len(self.working)] = content
        elif tier == 3:
            self.session[len(self.session)] = content
        else:
            self.long_term.add(content)
    
    def retrieve(self, query: str) -> List[str]:
        # Search all tiers
        results = []
        results.extend(self.context)
        results.extend(self.working.values())
        results.extend(self.session.values())
        results.extend(self.long_term.similarity_search(query))
        return results
```

---

## SKILL REGISTRY MANAGEMENT

### Auto-Discovery Locations
Scanner looks for SKILL.md in:
1. `.claude/skills/*/` (registered Claude Code skills)
2. `skills/*/` (standalone skills)
3. `skills/*/*/` (nested skills, up to depth 3)

### Adding New Skills
```yaml
---
name: my-new-skill
description: "Skill description with trigger keywords..."
capabilities: [data-extraction, web-automation]
---

## Skill Documentation
```

### Matching Algorithm
| Criterion | Points | Example |
|:---------|:-------|:--------|
| Skill name in query | +15 | "use web-scraper" -> web-scraper |
| Exact keyword trigger | +10 | "scrape" -> web-scraper |
| Capability category | +5 | data-extraction -> web-scraper |
| Word overlap | +1 | query words in description |
| Project boost | +20 | skill assigned to current project |

Minimum threshold: 5 points

---

## MCP (MODEL CONTEXT PROTOCOL)

### MCP Server Pattern
```python
class MCPServer:
    def __init__(self):
        self.tools = {}
        self.resources = {}
    
    def register_tool(self, tool: Tool):
        self.tools[tool.name] = tool
    
    async def handle_request(self, request: dict) -> dict:
        method = request.get("method")
        params = request.get("params", {})
        
        if method == "tools/call":
            return await self.call_tool(params["name"], params["arguments"])
        elif method == "resources/read":
            return await self.read_resource(params["uri"])
```

---

## BEST PRACTICES

1. **Always scan before acting** - Never skip the auto-discovery step
2. **Match before orchestrating** - Only use multi-agent patterns when multiple skills match
3. **Use tiered memory** - Short-term for context, long-term for persistence
4. **Implement approval gates** - Especially for destructive actions
5. **Log everything** - Enable tracing for debugging
6. **Handle failures gracefully** - Implement retry logic and fallbacks

---

## COMMON PITFALLS

- ❌ Skipping auto-discovery
- ❌ Using complex orchestration for simple tasks
- ❌ Not implementing approval gates for production
- ❌ Ignoring memory tier limits
- ❌ No rollback strategy for failed operations
- ❌ Not testing multi-agent coordination

---

## RELATED SKILLS

- `agent-orchestrator` - Core orchestration
- `autonomous-agent-patterns` - Agent architecture
- `multi-agent-patterns` - Multi-agent coordination
- `claude-code-expert` - Claude Code specifics
- `computer-use-agents` - Screen interaction
- `agent-memory-systems` - Memory architecture
- `hosted-agents` - Remote agent patterns
- `skill-creator` - Creating new skills
