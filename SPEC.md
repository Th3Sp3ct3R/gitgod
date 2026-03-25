# gitgod Monorepo Specification

> **Version:** 1.0.0  
> **Status:** Active Development  
> **Last Updated:** 2026-03-24  
> **Audience:** Internal Development Team

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Architecture Overview](#2-architecture-overview)
3. [workflow-agent Reference Architecture](#3-workflow-agent-reference-architecture)
4. [Agent Skills Taxonomy](#4-agent-skills-taxonomy)
5. [Multi-Agent Patterns](#5-multi-agent-patterns)
6. [Memory Architecture](#6-memory-architecture)
7. [MCP Server Patterns](#7-mcp-server-patterns)
8. [Autonomous Agent Patterns](#8-autonomous-agent-patterns)
9. [Hosted Agent Infrastructure](#9-hosted-agent-infrastructure)
10. [Computer Use Agents](#10-computer-use-agents)
11. [Skill Creation and Discovery](#11-skill-creation-and-discovery)
12. [Design and Brainstorming Orchestration](#12-design-and-brainstorming-orchestration)
13. [Subagent Development Patterns](#13-subagent-development-patterns)
14. [CI/CD and Quality Gates](#14-cicd-and-quality-gates)
15. [Planned Integrations](#16-planned-integrations)
16. [Decision Log](#17-decision-log)
17. [Appendices](#18-appendices)

---

## 1. Introduction

### 1.1 Purpose

This document is the authoritative reference for the gitgod monorepo: a collection of AI agent frameworks, skills, workflows, and infrastructure tooling designed to supercharge software development productivity. It serves as the comprehensive internal specification covering all submodules equally, providing architecture guidance, tooling conventions, and operational patterns for the entire monorepo.

### 1.2 Scope

The monorepo contains:

| Submodule | Purpose | Primary Language | Status |
|-----------|---------|-----------------|--------|
| `workflow-agent/` | 7-phase orchestrator with approval gates | TypeScript | Primary Reference |
| `agent-frameworks/` | 34 agent framework implementations | Mixed | Reference |
| `docs/` | Master prompts and agent specifications | Markdown | Documentation |
| `.github/workflows/` | CI/CD automation | YAML | Infrastructure |
| Planned: `cli-anything` | Unified CLI integration boundary | TBD | Planned |

### 1.3 Design Principles

1. **Adapter Pattern**: Environment-agnostic core with platform-specific adapters
2. **State Persistence**: Durable workflow state enabling pause/resume across sessions
3. **Approval Gates**: Human-in-the-loop checkpoints for critical phases
4. **Skill Composition**: Modular skills that can be invoked individually or chained
5. **Tiered Memory**: Hierarchical memory architecture from context window to long-term storage
6. **Agent Interoperability**: Standard patterns for multi-agent communication

### 1.4 Key Abbreviations

| Abbreviation | Full Form |
|--------------|-----------|
| MCP | Model Context Protocol |
| CLI | Command Line Interface |
| CI/CD | Continuous Integration / Continuous Deployment |
| SPA | Single Page Application |
| RAG | Retrieval-Augmented Generation |
| LLM | Large Language Model |
| API | Application Programming Interface |
| SDK | Software Development Kit |

---

## 2. Architecture Overview

### 2.1 Monorepo Structure

```
~/gitgod/
├── SPEC.md                          # This document
├── SYNTHESIS_REPORT.md              # Prior analysis output
├── workflow-agent/                  # Primary orchestrator (TypeScript)
│   ├── src/
│   │   ├── cli.ts                 # Commander.js CLI entry point
│   │   ├── orchestrator.ts        # Workflow orchestration engine
│   │   ├── state.ts               # StateManager with JSON persistence
│   │   ├── types.ts               # Phase and type definitions
│   │   ├── adapters/              # Environment adapters
│   │   ├── skills/               # Domain-specific skills
│   │   ├── patterns/             # Pattern extraction and analysis
│   │   └── analyzer/             # Codebase analysis tools
│   ├── dist/                     # Compiled JavaScript
│   └── .claude/                  # Claude Code settings
├── agent-frameworks/              # 34 framework implementations
│   ├── agents/
│   ├── antigravity-awesome-skills/
│   ├── anything-llm/
│   ├── awesome-agent-skills/
│   ├── browser-use/
│   ├── crewAI/
│   ├── dify/
│   ├── firecrawl/
│   ├── goose/
│   ├── langchain/
│   ├── langgraph/
│   ├── lobehub/
│   ├── mem0/
│   ├── n8n/
│   ├── nanoclaw/
│   ├── open-webui/
│   ├── ragflow/
│   └── [24 more...]
├── docs/
│   ├── agent-system-prompts.md     # Agent skill specifications
│   ├── ci-cd-pipeline.md         # Pipeline documentation
│   ├── agent-skills-breakdown.md   # Skills taxonomy
│   ├── gitgod-plan.md            # Project planning
│   ├── gitgod-improvements.md    # Improvement tracking
│   └── master-prompts/           # Master prompt templates
│       ├── agent-memory-master.md
│       ├── claude-code-expert-master.md
│       ├── computer-use-agents-master.md
│       ├── hosted-agents-master.md
│       ├── improve-agent.md
│       ├── master-agent-orchestrator.md
│       ├── mcp-master.md
│       ├── multi-agent-patterns-master.md
│       └── skill-creator-master.md
├── .github/workflows/
│   └── ci.yml                   # Node.js 22 pipeline
└── [other directories]
```

### 2.2 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 22.x |
| Language | TypeScript | 5.x |
| CLI Framework | Commander.js | Latest |
| State Persistence | JSON (file-based) | — |
| Package Manager | npm | 10.x |
| CI/CD | GitHub Actions | Latest |
| Testing | Jest/Playwright | Latest |

### 2.3 Environment Detection Priority

The orchestrator detects available environments in priority order:

1. **Claude** (when `CLAUDE_CODE` env var is set)
   - Invokes skills via `/<skill>` slash commands
   - Rich skill mapping system
2. **OpenCode** (when `OPENCODE` env var is set)
   - Uses Task tool for subagent execution
3. **Standalone** (fallback)
   - Inquirer.js for interactive prompts
   - Direct skill execution

---

## 3. workflow-agent Reference Architecture

> **Note**: This module serves as the **primary reference implementation** for the monorepo. All other modules should align with its patterns.

### 3.1 Core Components

#### 3.1.1 CLI Entry Point (`cli.ts`)

The Command Line Interface is built with Commander.js and supports 11 commands:

```typescript
interface CLICommand {
  name: string;
  description: string;
  action: () => Promise<void>;
}
```

**Available Commands:**

| Command | Description |
|---------|-------------|
| `start [plan]` | Start new workflow from plan |
| `continue` | Continue paused workflow |
| `resume` | Resume from saved state |
| `pause` | Pause current workflow |
| `advance` | Advance to next phase |
| `status` | Show current state |
| `review` | Run review phase |
| `ship` | Run ship phase |
| `qa` | Run QA phase |
| `retro` | Run retrospective |
| `clear` | Clear saved state |

**Environment Detection Flow:**

```
CLI Initialize
    │
    ▼
Check CLAUDE_CODE env var
    │
    ├─ YES → Use ClaudeAdapter
    │              │
    │              ▼
    │         Check OPENCODE env var
    │              │
    │              ├─ YES → Use OpenCodeAdapter
    │              │
    │              └─ NO → Stay with ClaudeAdapter
    │
    └─ NO → Check OPENCODE env var
                │
                ├─ YES → Use OpenCodeAdapter
                │
                └─ NO → Use StandaloneAdapter
```

#### 3.1.2 WorkflowOrchestrator (`orchestrator.ts`)

The central orchestration engine managing workflow execution.

```typescript
class WorkflowOrchestrator {
  private state: StateManager;
  private adapter: EnvironmentAdapter;
  private currentPhase: Phase;

  async start(plan: Plan): Promise<ExecutionResult>;
  async resume(): Promise<ExecutionResult>;
  async continue(): Promise<ExecutionResult>;
  async pause(): Promise<void>;
  async advance(): Promise<PhaseTransition>;
}
```

**Key Methods:**

| Method | Signature | Purpose |
|--------|-----------|---------|
| `start` | `(plan: Plan) => Promise<ExecutionResult>` | Initialize new workflow |
| `resume` | `() => Promise<ExecutionResult>` | Resume from `.gitgodreview/state.json` |
| `continue` | `() => Promise<ExecutionResult>` | Continue current phase |
| `pause` | `() => Promise<void>` | Save state and pause |
| `advance` | `() => Promise<PhaseTransition>` | Move to next phase |

**Approval Gates:**

Critical phases require human approval before proceeding:

```
Phase Transition Logic:
    │
    ▼
Current Phase has approval requirement?
    │
    ├─ YES → Wait for human approval
    │          │
    │          ▼
    │      Approval received?
    │          │
    │          ├─ YES → Execute transition
    │          └─ NO → Remain in current phase
    │
    └─ NO → Execute transition immediately
```

#### 3.1.3 StateManager (`state.ts`)

Durable state persistence enabling workflow pause/resume across sessions.

```typescript
class StateManager {
  private statePath: string = '.gitgodreview/state.json';

  createWorkflow(plan: Plan): WorkflowState;
  transition(to: Phase, metadata?: PhaseMetadata): WorkflowState;
  resume(): WorkflowState;
  pause(): void;
  clear(): void;
}
```

**State File Location:** `.gitgodreview/state.json`

**WorkflowState Structure:**

```typescript
interface WorkflowState {
  id: string;
  currentPhase: Phase;
  phaseHistory: PhaseTransition[];
  plan: Plan;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

### 3.2 Phase State Machine

#### 3.2.1 Phase Definitions

The workflow defines 12 distinct phases:

```typescript
enum Phase {
  IDLE = 'idle',
  CEO_REVIEW = 'ceo_review',
  CEO_APPROVED = 'ceo_approved',
  ENG_REVIEW = 'eng_review',
  ENG_APPROVED = 'eng_approved',
  IMPLEMENTING = 'implementing',
  REVIEW = 'review',
  SHIP = 'ship',
  QA = 'qa',
  RETRO = 'retro',
  COMPLETE = 'complete',
  FAILED = 'failed'
}
```

#### 3.2.2 Phase Metadata

Each phase carries metadata for rollback and audit:

```typescript
interface PhaseMetadata {
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  rollbackTarget?: Phase;
  error?: string;
}
```

#### 3.2.3 Phase Transitions

**Transition Diagram:**

```
                    ┌──────────────────────────────────────────────┐
                    │                                              │
                    ▼                                              │
idle ──► ceo_review ──► ceo_approved ──► eng_review ──► eng_approved
                                                               │
                                                               ▼
                                                        implementing ──► review ──► ship ──► qa ──► retro ──► complete
                                                               │
                                                               │
                                                               ▼
                                                            failed
```

**Rollback Targets:**

| Phase | Default Rollback Target |
|-------|----------------------|
| `implementing` | `eng_review` |
| `review` | `implementing` |
| `ship` | `review` |
| `qa` | `ship` |
| `retro` | `qa` |

### 3.3 Adapter System

#### 3.3.1 Base Adapter

Abstract base class defining the adapter interface:

```typescript
abstract class BaseAdapter {
  abstract log(message: string, level?: LogLevel): void;
  abstract readFile(path: string): Promise<string>;
  abstract writeFile(path: string, content: string): Promise<void>;
  abstract exec(command: string): Promise<ExecResult>;
  abstract checkCommandExists(command: string): Promise<boolean>;
}
```

**File Operations:**

All adapters implement file operations with consistent semantics:

| Method | Semantics |
|--------|----------|
| `readFile` | UTF-8 decode, throw on missing |
| `writeFile` | Atomic write (temp + rename) |
| `exec` | Capture stdout/stderr, return exit code |

#### 3.3.2 Claude Adapter

Environment detection: `CLAUDE_CODE` env var must be set.

**Skill Invocation:**

Skills are invoked using slash commands:

```typescript
// Skill mapping for Claude environment
const SKILL_COMMANDS: Record<string, string> = {
  'ceo': '/<skill>ceo-review',
  'eng': '/<skill>eng-review', 
  'review': '/<skill>review',
  'ship': '/<skill>ship-qa-retro',
  'qa': '/<skill>ship-qa-retro',
  'retro': '/<skill>ship-qa-retro'
};
```

**Execution Flow:**

```
Skill command detected
    │
    ▼
Parse skill name from command
    │
    ▼
Load skill module
    │
    ▼
Execute skill with current context
    │
    ▼
Return result to orchestrator
```

#### 3.3.3 OpenCode Adapter

Environment detection: `OPENCODE` env var must be set.

**Subagent Execution:**

Uses the Task tool for parallel execution:

```typescript
interface TaskDefinition {
  description: string;
  instructions: string;
  additionalContext?: Record<string, unknown>;
}
```

**Task Execution Model:**

```
Task created
    │
    ▼
Task dispatched to OpenCode agent
    │
    ▼
Result captured
    │
    ▼
Returned to orchestrator
```

#### 3.3.4 Standalone Adapter

Fallback adapter when neither Claude nor OpenCode is detected.

**Interactive Prompts:**

Uses Inquirer.js for user interaction:

```typescript
interface PromptDefinition {
  type: 'input' | 'confirm' | 'list' | 'editor';
  name: string;
  message: string;
  choices?: string[];
  default?: unknown;
}
```

### 3.4 Skill System

#### 3.4.1 CEO Skill (`ceo.ts`)

Strategic review skill with three operational modes:

```typescript
interface CEOSkillConfig {
  mode: 'expansion' | 'hold' | 'reduction';
  plan: Plan;
  context: WorkflowContext;
}
```

**Modes:**

| Mode | Purpose | Use Case |
|------|---------|----------|
| `expansion` | Expand scope, dream big | Feature requests, new initiatives |
| `hold` | Maintain current scope | Steady development |
| `reduction` | Strip to essentials | Critical bug fixes, minimal viable changes |

**Decision Output:**

```typescript
interface CEODecision {
  mode: 'expansion' | 'hold' | 'reduction';
  approved: boolean;
  notes?: string;
  scopeChanges?: ScopeChange[];
}
```

#### 3.4.2 Engineering Skill (`eng.ts`)

Technical architecture review with quantitative scoring:

```typescript
interface ArchitectureReview {
  score: number;           // 1-10 scale
  security: SecurityReview;
  errorHandling: number;    // 1-10
  testCoverage: number;     // 1-10
  findings: Finding[];
  recommendations: Recommendation[];
}
```

**Scoring Criteria:**

| Dimension | Weight | Assessment Focus |
|-----------|--------|-----------------|
| Architecture | 30% | Modularity, separation of concerns |
| Security | 25% | OWASP Top 10, input validation |
| Error Handling | 20% | Graceful degradation, retry logic |
| Test Coverage | 15% | Path coverage, edge cases |
| Performance | 10% | Algorithmic complexity, caching |

#### 3.4.3 Review Skill (`review.ts`)

Git diff analysis and quality assessment:

```typescript
interface ReviewResult {
  changes: Change[];
  bugs: Bug[];
  qualityScore: number;      // 0-100
  severityCounts: Record<BugSeverity, number>;
  filesReviewed: number;
  linesChanged: number;
}

enum BugSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}
```

#### 3.4.4 Ship QA Retro Skill (`ship-qa-retro.ts`)

Combined skill for deployment and post-deployment activities:

```typescript
interface DeploymentChecklist {
  tests: TestResult;
  types: TypeCheckResult;
  lint: LintResult;
  build: BuildResult;
  coverage: CoverageResult;
}
```

**Checklist Items:**

```
Pre-Ship Validation:
    │
    ├─ □ All tests passing
    ├─ □ TypeScript compilation clean
    ├─ □ Lint errors resolved
    ├─ □ Build succeeds
    └─ □ Coverage threshold met (80% minimum)
```

---

## 4. Agent Skills Taxonomy

### 4.1 Overview

The monorepo encompasses **84 skills** organized into **12 categories** as documented in `docs/agent-skills-breakdown.md`.

### 4.2 Category Map

| Category | Count | Examples |
|----------|-------|----------|
| Agent Orchestration | 15+ | `agent-orchestration-improve-agent`, `agent-orchestration-multi-agent-optimize` |
| Autonomous Patterns | 8+ | `autonomous-agent-patterns`, `autonomous-agents` |
| Design & Brainstorming | 5+ | `design-orchestration`, `multi-agent-brainstorming` |
| Multi-Agent Patterns | 6+ | `multi-agent-patterns`, `dispatching-parallel-agents` |
| Workflow Orchestration | 5+ | `workflow-orchestration-patterns`, `subagent-driven-development` |
| Memory Systems | 4+ | `agent-memory-systems`, `conversation-memory` |
| MCP Servers | 4+ | `mcp-builder`, `mcp-integration` |
| Skill Creation | 3+ | `skill-creator`, `skill-writer` |
| Computer Use | 3+ | `computer-use-agents`, `browser-automation` |
| Hosted Agents | 3+ | `hosted-agents`, `agent-manager-skill` |
| Code Review | 4+ | `code-review-ai-ai-review`, `receiveing-code-review` |
| Security | 5+ | `security-auditor`, `cc-skill-security-review` |

### 4.3 Core Skill Specifications

#### 4.3.1 Agent Orchestration Skills

**`agent-orchestration-improve-agent`**

Purpose: Iterative performance optimization of agent systems.

```typescript
interface OptimizationTarget {
  agentId: string;
  metrics: {
    latency: number;      // ms per task
    accuracy: number;      // 0-1
    costPerTask: number;   // USD
    errorRate: number;     // 0-1
  };
  baselineMetrics: Metrics;
  targetMetrics: Metrics;
}
```

Process:
1. Establish baseline metrics
2. Identify bottleneck (latency/cost/accuracy/error)
3. Apply targeted optimization
4. Measure improvement
5. Iterate until target or plateau

**`agent-orchestration-multi-agent-optimize`**

Purpose: Optimize multi-agent workloads.

```typescript
interface WorkloadDistribution {
  agentCount: number;
  tasksPerAgent: number;
  estimatedDuration: number;
  costEstimate: number;
  parallelismFactor: number;
}
```

Key Metrics:
- Throughput (tasks/hour)
- Resource utilization
- Inter-agent communication overhead
- Cost per task

#### 4.3.2 Autonomous Pattern Skills

**`autonomous-agents`**

Core Philosophy: Autonomy is **earned not granted**.

```typescript
enum AutonomyLevel {
  STEALTH = 'stealth',       // Fully autonomous, no oversight
  APPROVAL = 'approval',     // Confirm critical actions
  ASSISTED = 'assisted',     // Human in loop always
  SUPERVISED = 'supervised'  // Human directs all actions
}
```

**Reliability Targets:**

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Task Completion Rate | >95% | <90% |
| False Positive Rate | <2% | >5% |
| Recovery Rate | >80% | <60% |
| Context Drift | <10% | >20% |

#### 4.3.3 Memory System Skills

**`agent-memory-systems`**

4-Tier Memory Architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                     Long-Term Memory                        │
│         (Vector Store, Persistent, Queryable)            │
├─────────────────────────────────────────────────────────────┤
│                     Session Memory                         │
│         (Per-Session, Summary on Close)                    │
├─────────────────────────────────────────────────────────────┤
│                     Working Memory                         │
│           (Active Context, Sub-800 Token Budget)          │
├─────────────────────────────────────────────────────────────┤
│                     Context Window                        │
│         (Current Turn, Pre-Injection Synthesis)            │
└─────────────────────────────────────────────────────────────┘
```

**Memory Operations:**

| Operation | Description |
|-----------|-------------|
| Store | Commit working memory to session |
| Query | Semantic search over long-term |
| Summarize | Compress working memory |
| Evict | Remove low-value memories |

---

## 5. Multi-Agent Patterns

### 5.1 Pattern Taxonomy

| Pattern | Use Case | Complexity |
|---------|----------|------------|
| Supervisor | Task delegation, hierarchical | Medium |
| Orchestrator | Complex coordination | High |
| Peer-to-Peer | Equal collaboration | Medium |
| Swarm | Emergent collective behavior | Very High |
| Hierarchical | Multi-level oversight | Medium |
| Map-Reduce | Parallel processing, aggregation | Low |
| Debate | Two-sided reasoning | Medium |

### 5.2 Supervisor Pattern

```typescript
interface SupervisorConfig {
  agents: Agent[];
  routingStrategy: 'round_robin' | 'load_balanced' | 'capability_matched';
  maxConcurrent: number;
  timeout: number;
}
```

**Flow:**

```
User Request
      │
      ▼
┌─────────────┐
│ Supervisor   │
└─────────────┘
      │
      ▼
┌─────────────┐     ┌─────────────┐
│  Agent A    │     │  Agent B    │
└─────────────┘     └─────────────┘
      │                   │
      └─────────┬─────────┘
                ▼
         Result Aggregation
                │
                ▼
         User Response
```

### 5.3 Context Isolation

Critical for preventing telephone game degradation:

```typescript
interface AgentContext {
  agentId: string;
  systemPrompt: string;
  sharedTools: Tool[];
  privateMemory: MemorySegment;
  messageHistory: Message[];
}
```

**Isolation Guarantees:**

1. Each agent has isolated message history
2. Shared tools require explicit forwarding
3. Memory segments are not automatically propagated
4. Context injection is explicit and auditable

### 5.4 Token Economics

| Agent Type | Context Budget | Optimization |
|------------|---------------|--------------|
| Supervisor | 50K tokens | Minimal history |
| Worker | 30K tokens | Focused context |
| Specialist | 20K tokens | Domain-only |

**Cost Optimization Strategies:**

1. **Context compression**: Summarize older messages
2. **Selective forwarding**: Only relevant messages forwarded
3. **Tool sharing**: Common tools at supervisor level
4. **Batch operations**: Group similar tasks

### 5.5 Telephone Game Problem

**The Problem:**

Multi-agent chains degrade: `A → B → C → D` each adds ~3% noise.

**The Fix: `forward_message`**

```typescript
interface ForwardedMessage {
  originalSender: string;
  content: string;
  fidelity: 'exact' | 'summarized' | 'interpreted';
  verificationRequested: boolean;
}

async function forwardMessage(
  from: Agent,
  to: Agent,
  message: Message,
  options: { verify?: boolean }
): Promise<ForwardedMessage>;
```

---

## 6. Memory Architecture

### 6.1 Tier Specifications

#### Context Window (Tier 0)

- **Capacity**: Current turn only
- **Latency**: Immediate
- **Persistence**: None

```typescript
interface ContextWindow {
  systemPrompt: string;
  recentMessages: Message[];  // Last N messages
  synthesis: string;            // Pre-injection summary
}
```

#### Working Memory (Tier 1)

- **Capacity**: ~800 tokens
- **Latency**: <10ms
- **Strategy**: LRU eviction

```typescript
interface WorkingMemory {
  id: string;
  content: string;
  importance: number;  // 0-1
  accessCount: number;
  lastAccessed: string;
}
```

#### Session Memory (Tier 2)

- **Capacity**: Full session
- **Latency**: ~100ms
- **Persistence**: Session duration

```typescript
interface SessionMemory {
  sessionId: string;
  agentId: string;
  events: Event[];
  summaries: Summary[];
  checkpoints: Checkpoint[];
}
```

#### Long-Term Memory (Tier 3)

- **Capacity**: Unlimited
- **Latency**: ~1s (vector search)
- **Persistence**: Permanent until evicted

```typescript
interface LongTermMemory {
  vectorStore: 'chroma' | 'pinecone' | 'pgvector';
  namespace: string;
  documents: MemoryDocument[];
  indexConfig: IndexConfig;
}
```

### 6.2 Vector Store Implementations

| Store | Best For | Limitations |
|-------|----------|-------------|
| ChromaDB | Local dev, small scale | Single-node only |
| Pinecone | Production, global scale | Cost at scale |
| pgvector | Postgres shops | Requires PG extension |
| Qdrant | High dimensional | Operational complexity |

### 6.3 Compression Strategies

```typescript
interface CompressionConfig {
  strategy: 'summary' | 'extract' | 'full';
  targetTokens: number;
  preserve: ('entities' | 'relationships' | 'key_events')[];
}
```

---

## 7. MCP Server Patterns

### 7.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LLM (Claude/GPT-4)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                    Tool Call / Resource Access
                              │
┌─────────────────────────────────────────────────────────────┐
│                    MCP Client SDK                            │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  Tool A  │  │  Tool B  │  │Resource A│
        └──────────┘  └──────────┘  └──────────┘
```

### 7.2 Transport Protocols

| Transport | Use Case | Bidirectional |
|----------|----------|--------------|
| `stdio` | Local processes | No |
| `Streamable HTTP` | Web clients | Yes |
| `WebSocket` | Real-time apps | Yes |

### 7.3 Tool Definition Schema

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
  annotations?: {
    openWorldHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
  };
}
```

### 7.4 Agent Memory MCP Server

Specialized MCP server for persistent agent memory:

```typescript
interface MemoryMCPConfig {
  vectorStore: VectorStoreConfig;
  namespace: string;
  memoryTiers: TierConfig[];
  compression: CompressionConfig;
}
```

**Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/memory/store` | POST | Add memory |
| `/memory/query` | POST | Semantic search |
| `/memory/summarize` | POST | Generate summary |
| `/memory/evict` | POST | Remove memory |

---

## 8. Autonomous Agent Patterns

### 8.1 Loop Patterns

#### 8.1.1 ReAct (Reasoning + Acting)

```
┌─────────────────────────────────────────────────────────┐
│                     Think                                │
│  Reason about current state, plan next action          │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                     Act                                 │
│  Execute tool call, observe result                     │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                     Observe                            │
│  Process feedback, update state                         │
└─────────────────────────────────────────────────────────┘
                        │
                        └──────────────┐
                                       ▼
                              Loop until complete
```

#### 8.1.2 Plan-Execute

```
┌─────────────────────────────────────────────────────────┐
│                      Plan                               │
│  Decompose task into steps                             │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
              ┌─────────────────────┐
              │  Execute Step 1    │
              └─────────────────────┘
                        │
                        ▼
              ┌─────────────────────┐
              │  Execute Step 2    │
              └─────────────────────┘
                        │
                        ▼
                      ... until done
```

#### 8.1.3 Reflection

```
┌─────────────────────────────────────────────────────────┐
│                    Generate                            │
│  Produce initial response                             │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Critique                            │
│  Identify weaknesses and errors                       │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Revise                             │
│  Incorporate feedback, improve                        │
└─────────────────────────────────────────────────────────┘
                        │
                        └──────────────┐
                                       ▼
                              Loop N times or converged
```

### 8.2 Guardrails

```typescript
interface GuardrailConfig {
  preToolUse: PreToolGuard[];
  postToolUse: PostToolGuard[];
  output: OutputGuard[];
}

interface Guard {
  name: string;
  check: (input: unknown) => GuardResult;
  action: 'block' | 'warn' | 'log';
}
```

### 8.3 Anti-Patterns

| Anti-Pattern | Description | Prevention |
|--------------|-------------|------------|
| Infinite Loop | Agent never terminates | Max iterations + early exit |
| Hallucination | Confident but wrong | Verification tools |
| Context Overflow | Context grows unbounded | Memory management |
| Tool Loop | Calling same tool repeatedly | Tool use tracking |
| Prompt Injection | User input manipulates behavior | Input sanitization |

---

## 9. Hosted Agent Infrastructure

### 9.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                             │
│              (REST / WebSocket / gRPC)                    │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Sandbox Manager                          │
│     (Lifecycle, Snapshot/Restore, Warm Pool)              │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │Sandbox A │   │Sandbox B │   │Sandbox C │
        │ (warm)   │   │ (warm)   │   │ (cold)   │
        └──────────┘   └──────────┘   └──────────┘
```

### 9.2 Lifecycle Management

| State | Description | Latency |
|-------|-------------|---------|
| Cold | Not running | 5-30s |
| Warm | Running, idle | 100-500ms |
| Active | Processing | Immediate |

### 9.3 Warm Pool Strategy

```typescript
interface WarmPoolConfig {
  minInstances: number;
  maxInstances: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  idleTimeout: number;
}
```

### 9.4 Snapshot/Restore

```typescript
interface Snapshot {
  id: string;
  sandboxId: string;
  createdAt: string;
  state: {
    filesystem: string;      // Snapshot ID
    memory: string;         // Snapshot ID
    network: NetworkState;
  };
}
```

**Restore Flow:**

```
Restore Request
      │
      ▼
Allocate Sandbox (warm or cold)
      │
      ▼
Fetch Snapshot
      │
      ▼
Restore Filesystem
      │
      ▼
Restore Memory
      │
      ▼
Restore Network State
      │
      ▼
Sandbox Ready
```

---

## 10. Computer Use Agents

### 10.1 Perception-Reasoning-Action Loop

```
┌─────────────────────────────────────────────────────────┐
│                   PERCEPTION                             │
│  • Screen capture / DOM parsing                         │
│  • Element detection (OCR, bounding boxes)             │
│  • State observation                                  │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                   REASONING                             │
│  • Plan next action                                   │
│  • Predict outcome                                   │
│  • Validate safety                                   │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    ACTION                               │
│  • Mouse movements                                   │
│  • Keyboard input                                    │
│  • Wait for render                                  │
└─────────────────────────────────────────────────────────┘
                        │
                        └──────────────┐
                                       ▼
                              Loop until goal complete
```

### 10.2 Provider Support

| Provider | Capability | Best For |
|----------|------------|----------|
| Anthropic Computer Use | HAIMO model | General automation |
| OpenAI Operator | CUA model | Browser tasks |
| Custom | Custom | Specialized needs |

### 10.3 Sandbox Requirements

**Minimum Requirements:**

- Chromium-based browser (Chrome/Edge)
- Isolated filesystem
- Network isolation (optional)
- Resource limits (CPU, memory, time)

**Security Boundaries:**

```typescript
interface SandboxPolicy {
  allowClipboard: boolean;
  allowDownloads: boolean;
  allowUploads: boolean;
  maxRuntime: number;        // seconds
  maxNetworkRequests: number;
  allowedDomains?: string[];
}
```

---

## 11. Skill Creation and Discovery

### 11.1 Skill Anatomy

```yaml
---
name: skill-name
description: What this skill does
triggers:
  - "skill name"
  - "do something"
inputs:
  - name: input_name
    type: string
    required: true
outputs:
  - name: output_name
    type: string
risk_level: low|medium|high|critical
author: team-name
version: 1.0.0
---
```

### 11.2 Risk Levels

| Level | Meaning | Example |
|-------|---------|---------|
| `low` | Read-only operations | Code analysis |
| `medium` | Local file modifications | File creation |
| `high` | System changes | Git commits |
| `critical` | Irreversible actions | Data deletion |

### 11.3 Discovery Mechanism

```typescript
interface SkillRegistry {
  skills: Map<string, SkillMetadata>;
  
  register(skill: Skill): void;
  discover(query: string): Skill[];
  get(name: string): Skill | null;
}
```

### 11.4 Validation Workflow

```
Skill Created
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│              Frontmatter Validation                     │
│  • Required fields present                           │
│  • Types correct                                    │
│  • Risk level appropriate                           │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                Functional Testing                       │
│  • Smoke test in isolated env                        │
│  • Input validation                                 │
│  • Error handling                                   │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Security Review                           │
│  • Prompt injection test                             │
│  • Permission escalation test                        │
│  • Data exfiltration test                           │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
        ┌─────────────────┐
        │  Installation   │
        │  & Registration │
        └─────────────────┘
```

---

## 12. Design and Brainstorming Orchestration

### 12.1 Design Orchestration Pattern

```typescript
interface DesignSession {
  mode: 'brainstorm' | 'primary_support' | 'sequential';
  participants: Agent[];
  iterations: number;
  convergenceThreshold: number;
}
```

**Flow:**

```
┌─────────────────────────────────────────────────────────┐
│              Brainstorming Phase                        │
│  • Generate diverse ideas                            │
│  • No criticism allowed                              │
│  • Quantity over quality                            │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Multi-Agent Review                        │
│  • Architectural review                              │
│  • Security review                                   │
│  • Performance review                                │
│  • UX review                                        │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Execution Planning                        │
│  • Task decomposition                                │
│  • Dependency analysis                               │
│  • Resource allocation                               │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Implementation                           │
│  • Agent dispatch                                    │
│  • Progress tracking                                │
│  • Quality gates                                    │
└─────────────────────────────────────────────────────────┘
```

### 12.2 Risk Classification

| Risk Level | Criteria | Review Requirement |
|-------------|----------|-------------------|
| Low | No external impact | Self-review |
| Medium | Local environment | Peer review |
| High | System-level changes | Team review |
| Critical | Production impact | External review |

---

## 13. Subagent Development Patterns

### 13.1 Two-Stage Review Pattern

```typescript
interface TwoStageReview {
  stage1: {
    agent: Agent;
    task: string;
    output: unknown;
  };
  stage2: {
    reviewer: Agent;
    feedback: string;
    approved: boolean;
  };
}
```

**Flow:**

```
Task Dispatched
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│                    Stage 1: Work                         │
│  Subagent performs task                               │
│  Produces deliverable                                │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Stage 2: Review                      │
│  Reviewer agent evaluates                            │
│  Provides feedback                                   │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
              ┌─────────────────────┐
              │ Approved?          │
              └─────────────────────┘
              │            │
             YES           NO
              │            │
              ▼            ▼
          Deliver    ┌───────────────────┐
                      │ Revise & Retry   │
                      │ (back to Stage 1)│
                      └───────────────────┘
```

### 13.2 Agent Spawning

```typescript
interface SpawnConfig {
  name: string;
  systemPrompt: string;
  tools: Tool[];
  maxIterations?: number;
  timeout?: number;
  restartable?: boolean;
}
```

---

## 14. CI/CD and Quality Gates

### 14.1 Quality Gates Overview

All code entering the main branch must pass through these gates:

| Gate | Tool | Pass Criteria |
|------|------|--------------|
| Type Check | TypeScript compiler | 0 errors |
| Lint | ESLint + custom rules | 0 errors |
| Test | Jest/Playwright | 100% pass |
| Build | tsc + bundler | Success |
| Coverage | Istanbul/ coverage tools | >80% |

### 14.2 Pipeline Intent

The CI pipeline (`.github/workflows/ci.yml`) implements:

```yaml
# See: .github/workflows/ci.yml
trigger:
  - push to main
  - pull_request to main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup-node (version: 22, cache: npm)
      - npm ci
      - npm run build
      - npm test
```

**Key Points:**

1. **Node.js 22** for runtime compatibility
2. **npm ci** for reproducible installs
3. **Sequential build/test** for fast feedback
4. **No deployment on PR** (merge required)

### 14.3 Quality Gate Details

#### Type Checking

```bash
npm run typecheck  # or: npx tsc --noEmit
```

#### Linting

```bash
npm run lint  # or: npx eslint src/ --ext .ts,.tsx
```

#### Testing

```bash
npm test  # Jest with coverage report
```

#### Build

```bash
npm run build  # tsc + bundler output to dist/
```

### 14.4 Coverage Requirements

| Module Type | Minimum Coverage |
|-------------|-----------------|
| Core modules | 90% |
| Adapters | 85% |
| Skills | 80% |
| Utilities | 70% |

---

## 15. Planned Integrations

### 15.1 cli-anything (Planned)

> **Status:** Planned - Not yet implemented

`cli-anything` is a planned integration boundary for unified CLI operations across the monorepo.

**Submodule Path:** `cli-anything/` (to be created)

**Integration Model:**

| Approach | When to Use | Tradeoffs |
|----------|-------------|-----------|
| **Subprocess** | One-shot commands | Simpler, less overhead |
| **Agent Plugin** | Interactive sessions | Rich context, slower |
| **Hybrid** | Mixed use cases | Flexible, complex |

**Fallback Behavior:**

If `cli-anything` is not present in the tree:

```typescript
const cliFallback: CLIBoundary = {
  invoke: async (command: string, args: string[]) => {
    // Detect if cli-anything exists
    const exists = await checkModuleExists('cli-anything');
    
    if (!exists) {
      // Fallback to direct implementation
      return directImplementation(command, args);
    }
    
    // Otherwise delegate
    return moduleProxy(command, args);
  }
};
```

**Implementation Notes:**

- Will be placed in monorepo root or `tools/` directory
- Will use subprocess for standard CLI operations
- Will use agent plugin pattern for complex workflows
- Will maintain compatibility with existing workflow-agent patterns

---

## 16. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-24 | Use adapter pattern for environment detection | Enables Claude/OpenCode/Standalone interoperability |
| 2026-03-24 | Phase approval gates for critical transitions | Human oversight for high-impact changes |
| 2026-03-24 | JSON file persistence for workflow state | Simple, debuggable, version-control friendly |
| 2026-03-24 | 4-tier memory architecture | Balances speed, capacity, and cost |
| 2026-03-24 | Minimal CI/CD (no deployment) | Focus on code quality, not delivery automation |
| 2026-03-24 | `cli-anything` as planned integration | Clear boundary for future CLI consolidation |

---

## 17. Appendices

### Appendix A: File Paths Reference

| Path | Purpose |
|------|---------|
| `.gitgodreview/state.json` | Workflow state persistence |
| `.github/workflows/ci.yml` | CI/CD pipeline definition |
| `workflow-agent/dist/` | Compiled output |
| `workflow-agent/.claude/` | Claude Code settings |

### Appendix B: Environment Variables

| Variable | Used By | Purpose |
|----------|---------|---------|
| `CLAUDE_CODE` | ClaudeAdapter | Claude environment detection |
| `OPENCODE` | OpenCodeAdapter | OpenCode environment detection |
| `NODE_ENV` | All | Runtime mode (development/production) |
| `GITHUB_TOKEN` | CI/CD | GitHub API access |

### Appendix C: Glossary

| Term | Definition |
|------|------------|
| Adapter Pattern | Software design pattern enabling interface translation |
| Approval Gate | Checkpoint requiring human authorization |
| Context Window | Available space for current LLM prompt |
| Determinism | Property of producing same output for same input |
| Fidelity | Accuracy of message transmission in multi-agent chain |
| Phase | Discrete workflow stage with defined entry/exit criteria |
| Skill | Modular capability callable by agents |
| State Machine | Mathematical model for workflow transitions |
| Vector Store | Database optimized for similarity search |

### Appendix D: Bibliography

| Document | Location | Purpose |
|---------|----------|---------|
| workflow-agent README | `workflow-agent/README.md` | Primary reference |
| Agent System Prompts | `docs/agent-system-prompts.md` | Skill specifications |
| Master Prompts | `docs/master-prompts/*.md` | 9 detailed skill guides |
| CI/CD Pipeline | `docs/ci-cd-pipeline.md` | Pipeline design |
| Agent Skills Breakdown | `docs/agent-skills-breakdown.md` | 84-skill taxonomy |

### Appendix E: Minimal CI Workflow Reference

```yaml
# .github/workflows/ci.yml
# Full implementation: see actual file in repository

name: CI
on:
  - push to main
  - pull_request to main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm test
```

---

*End of Specification*
