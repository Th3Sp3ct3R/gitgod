---
name: multi-agent-patterns-master
description: "Master prompt for multi-agent coordination, parallel execution, and swarm patterns"
---

# MULTI-AGENT PATTERNS - MASTER

> Comprehensive guide to coordinating multiple AI agents for complex tasks

---

## CORE ARCHITECTURES

### 1. Supervisor Pattern
```
┌─────────────┐
│  Supervisor │──────────────┐
│   (router)  │              │
└─────────────┘              ▼
                     ┌─────────────┐
              ┌─────│  Worker 1  │
              │     └─────────────┘
              ▼
         ┌─────────────┐
         │  Worker 2  │
         └─────────────┘
```

```python
class SupervisorAgent:
    def __init__(self, workers: List[Agent]):
        self.workers = {w.specialty: w for w in workers}
    
    async def route(self, task: str) -> str:
        # Analyze task
        required_skills = self.analyze(task)
        
        # Route to appropriate worker
        worker = self.select_worker(required_skills)
        
        # Execute
        return await worker.execute(task)
    
    def select_worker(self, skills: List[str]) -> Agent:
        for skill in skills:
            if skill in self.workers:
                return self.workers[skill]
        return self.workers["general"]
```

### 2. Round Robin Pattern
```
Task A ──┐
Task B ──┼──▶ [Agent Pool] ──▶ Results
Task C ──┘         │
              ┌────▼────┐
              │ Round   │
              │ Robin   │
              └─────────┘
```

```python
class RoundRobinDispatcher:
    def __init__(self, agents: List[Agent]):
        self.agents = agents
        self.current = 0
    
    async def dispatch(self, task: str) -> str:
        agent = self.agents[self.current]
        self.current = (self.current + 1) % len(self.agents)
        return await agent.execute(task)
    
    async def dispatch_batch(self, tasks: List[str]) -> List[str]:
        return await asyncio.gather(*[
            self.dispatch(task) for task in tasks
        ])
```

### 3. Hierarchical Pattern
```
        ┌──────────────┐
        │   Manager    │
        │   (level 1)  │
        └──────┬───────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌───────┐ ┌───────┐ ┌───────┐
│Lead 1 │ │Lead 2 │ │Lead 3 │
│(lvl2) │ │(lvl2) │ │(lvl2) │
└───┬───┘ └───┬───┘ └───┬───┘
    │         │         │
 ┌──▼──┐   ┌──▼──┐   ┌──▼──┐
 │Wrkrs│   │Wrkrs│   │Wrkrs│
 └─────┘   └─────┘   └─────┘
```

```python
class HierarchicalAgent:
    def __init__(self, managers: List[Agent], workers: List[Agent]):
        self.managers = managers
        self.workers = workers
    
    async def execute(self, task: str) -> str:
        # Manager decomposes task
        subtasks = await self.managers[0].decompose(task)
        
        # Workers execute in parallel
        results = await asyncio.gather(*[
            self.select_worker(st).execute(st) 
            for st in subtasks
        ])
        
        # Manager aggregates
        return await self.managers[0].aggregate(results)
```

---

## COORDINATION PATTERNS

### Sequential Pipeline
```
A → B → C → D
```

```python
async def sequential_pipeline(tasks: List[Task], agents: List[Agent]) -> Any:
    result = None
    for i, task in enumerate(tasks):
        result = await agents[i].execute(task, context=result)
    return result
```

### Parallel Fan-Out/Fan-In
```
        ┌──▶ Agent A ──┐
Task ───┤──▶ Agent B ──┼──▶ Aggregate
        └──▶ Agent C ──┘
```

```python
async def fan_out_fan_in(task: str, agents: List[Agent]) -> str:
    # Fan out: all agents work in parallel
    results = await asyncio.gather(*[
        agent.execute(task) for agent in agents
    ])
    
    # Fan in: aggregate results
    return aggregate(results)
```

### Map-Reduce
```
Map:     Task → [Chunk1, Chunk2, Chunk3]
              ↓      ↓       ↓
         [Agent1] [Agent2] [Agent3]
              ↓      ↓       ↓
         [Res1]  [Res2]   [Res3]
              ↓      ↓       ↓
Reduce:  [Res1, Res2, Res3] → Final Result
```

```python
async def map_reduce(task: str, agents: List[Agent]) -> str:
    # Split task into chunks
    chunks = split_task(task, len(agents))
    
    # Map: parallel execution
    map_results = await asyncio.gather(*[
        agent.execute(chunk) for agent, chunk in zip(agents, chunks)
    ])
    
    # Reduce: aggregate
    return reduce_results(map_results)
```

### Debate Pattern
```
         ┌───────▲───────┐
         │    Debate    │
    ┌────┴───┐     ┌────┴───┐
    │ Agent │     │ Agent │
    │   A   │     │   B   │
    └────┬───┘     └────┬───┘
         │             │
         └───────▼─────┘
           Consensus
```

```python
class DebateAgent:
    def __init__(self, agents: List[Agent], rounds: int = 3):
        self.agents = agents
        self.rounds = rounds
    
    async def debate(self, topic: str) -> str:
        proposals = [None] * len(self.agents)
        
        for round in range(self.rounds):
            for i, agent in enumerate(self.agents):
                # Consider other proposals
                context = self.build_context(proposals, i)
                proposals[i] = await agent.execute(f"{topic}\n{context}")
        
        # Final consensus
        return self.consensus(proposals)
```

---

## COMMUNICATION PROTOCOLS

### Message Passing
```python
class MessageBus:
    def __init__(self):
        self.queue = asyncio.Queue()
        self.subscribers = {}
    
    async def publish(self, topic: str, message: Any):
        await self.queue.put((topic, message))
    
    async def subscribe(self, topic: str, agent: Agent):
        if topic not in self.subscribers:
            self.subscribers[topic] = []
        self.subscribers[topic].append(agent)
    
    async def run(self):
        while True:
            topic, message = await self.queue.get()
            for agent in self.subscribers.get(topic, []):
                await agent.receive(topic, message)
```

### Shared Context
```python
class SharedContext:
    def __init__(self):
        self.data = {}
        self.lock = asyncio.Lock()
    
    async def write(self, key: str, value: Any):
        async with self.lock:
            self.data[key] = value
    
    async def read(self, key: str) -> Any:
        async with self.lock:
            return self.data.get(key)
    
    async def update(self, key: str, updater: callable):
        async with self.lock:
            self.data[key] = updater(self.data.get(key))
```

---

## ERROR HANDLING

### Circuit Breaker
```python
class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, timeout: int = 60):
        self.failures = 0
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.state = "closed"  # closed, open, half-open
    
    async def call(self, func, *args):
        if self.state == "open":
            raise CircuitOpenError()
        
        try:
            result = await func(*args)
            self.failures = 0
            return result
        except Exception as e:
            self.failures += 1
            if self.failures >= self.failure_threshold:
                self.state = "open"
                asyncio.create_task(self.reset_after_timeout())
            raise
```

---

## TOOL SHARING

### Shared Tool Registry
```python
class ToolRegistry:
    def __init__(self):
        self.tools = {}
    
    def register(self, agent_id: str, tool: Tool):
        key = f"{agent_id}:{tool.name}"
        self.tools[key] = tool
    
    def get(self, agent_id: str, tool_name: str) -> Tool:
        return self.tools.get(f"{agent_id}:{tool_name}")
    
    def share(self, from_agent: str, to_agent: str, tool_name: str):
        tool = self.get(from_agent, tool_name)
        if tool:
            self.register(to_agent, tool)
```
