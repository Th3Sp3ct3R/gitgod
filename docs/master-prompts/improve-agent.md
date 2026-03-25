---
name: improve-agent
description: "Master prompt for improving and optimizing existing agents"
---

# AGENT IMPROVEMENT MASTER PROMPT

> Systematic approach to improving existing agents through performance analysis, prompt engineering, and continuous iteration.

---

## IMPROVEMENT WORKFLOW

### Phase 1: Performance Analysis

```python
class AgentImprover:
    def analyze(self, agent: Agent) -> AnalysisReport:
        # 1. Review conversation logs
        logs = self.fetch_logs(agent.id)
        
        # 2. Identify failure patterns
        failures = self.identify_failures(logs)
        
        # 3. Measure success rates
        success_rate = self.calculate_success_rate(logs)
        
        # 4. Identify bottlenecks
        bottlenecks = self.find_bottlenecks(logs)
        
        return AnalysisReport(
            failures=failures,
            success_rate=success_rate,
            bottlenecks=bottlenecks
        )
```

### Phase 2: Prompt Engineering

```python
def improve_prompt(current_prompt: str, issues: List[str]) -> str:
    improvements = []
    
    for issue in issues:
        if "unclear" in issue:
            improvements.append("Add explicit output format examples")
        if "incomplete" in issue:
            improvements.append("Add step-by-step checklist")
        if "incorrect" in issue:
            improvements.append("Add validation rules")
        if "too slow" in issue:
            improvements.append("Optimize for efficiency")
    
    return apply_improvements(current_prompt, improvements)
```

### Phase 3: Testing & Validation

```python
class AgentTester:
    def test(self, agent: Agent, test_cases: List[TestCase]) -> TestReport:
        results = []
        
        for test in test_cases:
            result = agent.execute(test.input)
            passed = self.validate(result, test.expected)
            results.append(TestResult(test, result, passed))
        
        return TestReport(results)
```

---

## COMMON IMPROVEMENT PATTERNS

### 1. Add Context Windowing
```python
# Before: No context management
def execute(self, task):
    return self.llm.chat(task)

# After: Context windowing
def execute(self, task):
    context = self.get_relevant_context(task)
    return self.llm.chat(f"Context: {context}\nTask: {task}")
```

### 2. Add Tool Validation
```python
# Before: Blind tool execution
def execute_tool(self, tool_name, args):
    return self.tools[tool_name].execute(**args)

# After: Validated execution
def execute_tool(self, tool_name, args):
    if not self.validate_args(tool_name, args):
        raise ValidationError(f"Invalid args for {tool_name}")
    return self.tools[tool_name].execute(**args)
```

### 3. Add Retry Logic
```python
async def execute_with_retry(self, task, max_retries=3):
    for attempt in range(max_retries):
        try:
            return await self.execute(task)
        except RetryableError as e:
            if attempt == max_retries - 1:
                raise
            await self.backoff(attempt)
```

### 4. Add Human-in-the-Loop
```python
async def execute_with_approval(self, task):
    plan = await self.plan(task)
    
    if self.requires_approval(plan):
        approved = await self.request_approval(plan)
        if not approved:
            return "Operation cancelled by user"
    
    return await self.execute_plan(plan)
```

---

## ITERATION CYCLE

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Analyze   │────▶│  Improve     │────▶│    Test      │
│  (logs)     │     │  (prompt)    │     │  (cases)     │
└──────────────┘     └──────────────┘     └──────────────┘
       ▲                                           │
       │                                           ▼
       │            ┌──────────────┐     ┌──────────────┐
       └────────────│  Deploy     │◀────│   Monitor    │
                    │  (rollback) │     │  (production)│
                    └──────────────┘     └──────────────┘
```

---

## METRICS TO TRACK

| Metric | Target | How to Measure |
|:-------|:-------|:---------------|
| Success Rate | >90% | tasks completed / total tasks |
| Latency | <5s | average execution time |
| Token Usage | optimize | tokens per task |
| Error Rate | <5% | errors / total executions |
| User Satisfaction | >4/5 | feedback surveys |

---

## ROLLBACK STRATEGY

```python
class RollbackManager:
    def __init__(self):
        self.versions = []
    
    def save_version(self, agent: Agent):
        self.versions.append({
            "version": len(self.versions) + 1,
            "prompt": agent.prompt,
            "config": agent.config,
            "timestamp": datetime.now()
        })
    
    def rollback(self, version: int):
        v = self.versions[version]
        self.agent.prompt = v["prompt"]
        self.agent.config = v["config"]
```
