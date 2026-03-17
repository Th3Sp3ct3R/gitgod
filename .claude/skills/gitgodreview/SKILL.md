---
name: gitgodreview
description: |
  Run the complete GitGod development workflow: CEO Review → Eng Review → Implement → Review → Ship → QA → Retro.
  Uses Claude API for intelligent analysis. Works in Claude Code, OpenCode, or terminal.
version: 1.1.0
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
---

# /gitgodreview

Intelligent workflow orchestrator that analyzes repos and runs the full development lifecycle using Claude API.

## Usage

```bash
/gitgodreview analyze [path]              # Analyze repo and generate plan
/gitgodreview start <plan.md>             # Start workflow from plan
/gitgodreview resume                       # Resume current workflow  
/gitgodreview continue                     # Approve and continue
/gitgodreview continue --reject            # Reject and rollback
/gitgodreview status                       # Show current status
/gitgodreview patterns                     # Show GitGod pattern database
/gitgodreview pause "<reason>"             # Pause workflow
/gitgodreview reset                        # Clear all state
```

## Commands

### Analyze Repository
Intelligently analyzes a repository using GitGod's pattern database of 273+ tools:

```bash
/gitgodreview analyze .                    # Analyze current repo
/gitgodreview analyze . -o plan.md         # Save plan to file
```

**What it does:**
1. Scans codebase structure
2. Compares against 273 similar tools in GitGod database
3. Identifies gaps (missing CI/CD, tests, docs, etc.)
4. Generates interactive questions
5. Creates customized improvement plan

### Start Workflow
Runs the full 7-phase workflow:

```bash
/gitgodreview start docs/plan.md
```

**Phases:**

1. **CEO Review** — Claude analyzes plan strategically
   - 10x thinking: What's the ambitious version?
   - Dream state: Where in 12 months?
   - Mode: EXPANSION / HOLD / REDUCTION
   - Generates feedback and revised plan if needed

2. **Eng Review** — Claude reviews architecture
   - Architecture score (1-10)
   - Security analysis
   - Error mapping (all failure modes)
   - Test coverage assessment
   - Performance review

3. **Implementation** — Write code (manual or assisted)

4. **Code Review** — Claude finds bugs
   - Quality score (1-10)
   - Bug detection (critical/high/medium/low)
   - Security vulnerabilities
   - Pattern analysis

5. **Ship** — Automated checks
   - Run tests
   - Type checking
   - Linting
   - Build verification
   - Git status

6. **QA** — Validation
   - Test coverage check
   - Documentation check
   - Script configuration
   - Code quality

7. **Retro** — Review completion
   - What went well
   - Improvements for next time
   - Action items
   - Metrics (duration, phases completed)

## Workflow Phases (Detailed)

### Phase 1: CEO Review
Uses Claude 3.5 Sonnet to conduct strategic review:
- **Premise Challenge**: Is this the right problem?
- **10x Check**: What's the version that delivers 10x value?
- **Dream State**: Where should this be in 12 months?
- **Mode Selection**: 
  - EXPANSION: Push scope up, build the cathedral
  - HOLD: Scope is right, focus on quality
  - REDUCTION: Strip to essentials

**Output**: Mode, feedback, questions, recommendations, optionally revised plan

### Phase 2: Engineering Review
Claude analyzes codebase for:
- **Architecture** (score 1-10): Component boundaries, coupling, data flow
- **Security** (score 1-10): Input validation, secrets, injection risks
- **Error Handling**: Maps all exceptions and failure modes
- **Tests**: Coverage gaps, missing test cases
- **Performance**: N+1 queries, memory leaks, async patterns

**Output**: Scores, findings, specific recommendations

### Phase 3: Implementation
Write code based on approved plan. Can be:
- Manual implementation
- Claude-assisted coding
- Automated code generation

### Phase 4: Code Review
Claude reviews git diff for:
- **Bugs**: Logic errors, race conditions, off-by-one
- **Security**: Vulnerabilities, auth issues, leaks
- **Quality**: Complexity, readability, patterns
- **Edge Cases**: Null inputs, empty arrays, timeouts

**Output**: Quality score, bugs (with file/line), security issues, suggestions

### Phase 5: Ship
Automated validation:
- ✅ Run `npm test`
- ✅ Type check with `tsc --noEmit`
- ✅ Lint check
- ✅ Build with `npm run build`
- ✅ Check git status

### Phase 6: QA
Final validation:
- ✅ Test files present
- ✅ README.md exists
- ✅ Package.json scripts configured
- ✅ Linting passes

### Phase 7: Retro
Analyzes workflow completion:
- Phases completed vs failed
- Duration metrics
- What went well
- Improvements for next iteration
- Action items

## Pattern Database

GitGod has analyzed 273+ tools:

```bash
/gitgodreview patterns
```

**Shows:**
- Tools by category (Cloud & Integrations: 36, Dev Tools: 27, etc.)
- Common tags (API: 14, Automation: 14, CLI: 8, etc.)
- Feature patterns (UI/UX: 36, Integration: 19, Security: 9, etc.)
- Architecture patterns

Used to compare your repo against similar tools and identify gaps.

## State Management

Workflow state persisted in `.gitgodreview/state.json`:
```json
{
  "currentPhase": "eng_review",
  "context": {
    "planPath": "docs/plan.md",
    "branchName": "feat/12345",
    "ceoFeedback": [...],
    "engDecisions": [...]
  },
  "history": [...],
  "environment": "claude"
}
```

## Requirements

- Node.js 18+
- `ANTHROPIC_API_KEY` environment variable for Claude API access
- Or runs in manual fallback mode without API

## Environment Support

**Claude Code**: Detects `.claude/skills/` and uses native integration  
**OpenCode**: Uses standalone skills with Claude API  
**Terminal**: Full standalone operation anywhere

## Quick Start

```bash
# 1. Analyze your repo
/gitgodreview analyze .

# 2. Review the generated plan
# (Saved to docs/improve-{repo-name}.md)

# 3. Start workflow
/gitgodreview start docs/improve-{repo-name}.md

# 4. Approve phases as prompted
# Each phase asks: "Approve and continue? [Y/n]"

# 5. Complete all 7 phases
# CEO → Eng → Implement → Review → Ship → QA → Retro
```

## Example Output

```
🚀 Starting intelligent repo analysis...

📊 REPO ANALYSIS RESULTS
========================
Repository: my-project
Detected Category: CLI Tools (80% confidence)

💡 INSIGHTS
• This project resembles 5 highly-rated tools
• Modular architecture with 4 key modules
• 3 high-priority improvements identified

🛠️ SIMILAR TOOLS
• Vercel CLI (5/5 relevance)
• GitHub CLI (5/5 relevance)

⚠️ GAPS IDENTIFIED
🔴 [HIGH] No CI/CD pipeline
🔴 [HIGH] Documentation missing
🟡 [MEDIUM] 15 TODOs in code

📋 GENERATED PLAN
# Improve my-project - 3 Key Enhancements
...
```

## Implementation Notes

- **CEO/Eng/Review phases** use Claude 3.5 Sonnet for intelligent analysis
- **Ship/QA phases** run actual commands (npm test, tsc, etc.)
- **Retro phase** analyzes workflow history automatically
- All phases have **manual fallback** if Claude API unavailable
- **Pattern database** loaded from `data/clawhub-ai/` (273 tools analyzed)
