---
name: skill-creator-master
description: "Master prompt for creating new CLI skills following Anthropic's official best practices"
---

# SKILL CREATOR - MASTER

> Complete guide to creating new CLI skills following Anthropic's official standards

---

## WHAT IS A SKILL?

A skill is a specialized instruction set that teaches an AI agent how to perform specific tasks. It's like an SOP (Standard Operating Procedure) for AI.

```
Skill Structure:
├── SKILL.md          # Required: Main definition
├── examples/         # Optional: Example files
├── scripts/          # Optional: Helper scripts
├── templates/        # Optional: Code templates
└── references/      # Optional: Reference docs
```

---

## SKILL ANATOMY

### Required: SKILL.md

```yaml
---
name: my-skill-name
description: "Brief description of what this skill does"
---

# Skill Title

## Overview
A brief explanation of what this skill does and why it exists.

## When to Use This Skill
- Use when you need [scenario 1]
- Use when working with [scenario 2]

## How It Works

### Step 1: [Action]
Detailed instructions...

### Step 2: [Action]
More instructions...

## Examples

### Example 1: [Use Case]
\`\`\`javascript
// Example code
\`\`\`

## Best Practices
- ✅ Do this
- ✅ Also do this
- ❌ Don't do this
```

---

## CREATION WORKFLOW

### Phase 1: Discovery

Before starting, gather runtime information:

```bash
# Detect available platforms
CLAUDE_INSTALLED=false
COPILOT_INSTALLED=false
CODEX_INSTALLED=false

if [[ -d "$HOME/.claude" ]]; then
    CLAUDE_INSTALLED=true
fi

# Get user info
AUTHOR=$(git config user.name || echo "Unknown")
EMAIL=$(git config user.email || echo "")

# Determine working directory
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
```

### Phase 2: Brainstorming

**Key Information Needed:**
- Which platforms to target (Claude, Copilot, Codex, or all)
- Installation preference (local, global, or both)
- Skill name and purpose
- Skill type (general, code, documentation, analysis)

### Phase 3: Template Selection

Choose the right template:

| Template | Use For |
|:---------|:--------|
| **basic** | Simple skills with clear steps |
| **workflow** | Multi-step processes |
| **code** | Code generation/analysis |
| **analysis** | Review and evaluation |

### Phase 4: Implementation

#### Frontmatter (YAML)

```yaml
---
name: my-skill-name
description: "What this skill does in one sentence"
version: "1.0.0"
author: "Your Name"
tags: ["tag1", "tag2"]
risk: "safe"  # safe, unknown, dangerous
source: "community"  # community, official
---

# OR

---
name: skill-name
description: "Description with trigger keywords..."
capabilities: [capability1, capability2]
---
```

#### Content Structure

```markdown
# Skill Name

## Overview
2-4 sentences explaining the skill.

## When to Use This Skill
- Use when [specific scenario]
- Use when [another scenario]

## Do Not Use This Skill When
- Task is unrelated to this domain
- Simpler tool can handle the request

## How It Works

### Step 1: [Action Name]
Detailed instructions...

### Step 2: [Action Name]
More instructions...

## Examples

### Example 1: [Use Case]
\`\`\`
Example input/output
\`\`\`

## Best Practices
- ✅ Do this
- ✅ Also do this
- ❌ Don't do this

## Common Pitfalls
- Mistake 1
- Mistake 2

## Related Skills
- `related-skill-1` - Brief description
- `related-skill-2` - Brief description
```

### Phase 5: Validation

```bash
# Validate YAML frontmatter
python -c "import yaml; yaml.safe_load(open('SKILL.md'))"

# Check required fields
grep -q "^name:" SKILL.md || echo "ERROR: Missing name"
grep -q "^description:" SKILL.md || echo "ERROR: Missing description"
```

### Phase 6: Installation

```bash
# Local installation (project-specific)
mkdir -p .claude/skills/my-skill
cp SKILL.md .claude/skills/my-skill/

# Global installation
cp -r . ~/.claude/skills/my-skill/
```

---

## PROGRESS TRACKING

Display progress throughout the workflow:

```
[████████████░░░░░░] 60% - Step 3/5: Creating SKILL.md
```

**Format:**
- 20 characters wide (█ = filled, ░ = empty)
- Percentage based on current step
- Brief description of current phase

---

## VALIDATION RULES

### Frontmatter Requirements

| Field | Required | Format |
|:------|:---------|:-------|
| name | ✅ | lowercase-with-hyphens |
| description | ✅ | String, < 150 chars |
| version | ❌ | Semantic version |
| author | ❌ | String |
| tags | ❌ | Array of strings |
| risk | ❌ | safe/unknown/dangerous |
| source | ❌ | community/official |

### Content Requirements

- ✅ Must have H1 title
- ✅ Should have "When to Use" section
- ✅ Should have "How It Works" section
- ✅ Should have examples
- ❌ No excessive jargon
- ❌ No assumptions about user knowledge

---

## SKILL REGISTRATION

### For Claude Code

```bash
# Install to .claude/skills/
mkdir -p .claude/skills/<skill-name>
cp SKILL.md .claude/skills/<skill-name>/

# Also works in subdirectories
mkdir -p .claude/skills/<category>/<skill-name>
cp SKILL.md .claude/skills/<category>/<skill-name>/
```

### Structure for Auto-Discovery

```
.claude/skills/
├── skill-orchestrator/     # Top-level skills
│   └── SKILL.md
├── coding/
│   ├── javascript/
│   │   └── SKILL.md
│   └── python/
│       └── SKILL.md
└── workflow/
    └── SKILL.md
```

---

## BEST PRACTICES

### 1. Keep Descriptions Concise
```yaml
# ✅ Good
description: "Create REST APIs with Express"

# ❌ Bad
description: "This skill helps you create REST APIs using the Express.js framework for Node.js applications"
```

### 2. Use Clear Trigger Keywords
```yaml
description: "Build REST APIs - create endpoints, handle CRUD operations, add middleware"
```
Triggers: "build API", "create endpoint", "REST", "CRUD"

### 3. Progressive Disclosure
```markdown
## Overview
Brief summary...

## Detailed Guide
For complex skills, put advanced details in references/
```

### 4. Include Examples
```markdown
## Examples

### Create a simple endpoint
\`\`\`javascript
app.get('/users', (req, res) => {
  res.json(users);
});
\`\`\`
```

### 5. Set Appropriate Risk Level

| Risk Level | When to Use |
|:-----------|:------------|
| **safe** | Read-only, no system modifications |
| **unknown** | May modify files, run commands |
| **dangerous** | System changes, network access |

---

## COMMON PATTERNS

### Code Generation Skill

```yaml
---
name: skill-name
description: "Generate [specific code type] for [use case]"
risk: safe
---

# Steps
1. Understand requirements
2. Apply template
3. Validate output
```

### Analysis Skill

```yaml
---
name: skill-name  
description: "Analyze [code/docs] for [issues/improvements]"
risk: safe
---

# Steps
1. Scan target
2. Identify patterns
3. Generate report
```

### Workflow Skill

```yaml
---
name: skill-name
description: "Complete [process] from start to finish"
risk: unknown
---

# Steps
1. [Step 1]
2. [Step 2]
3. [Step 3]
```

---

## TESTING YOUR SKILL

```bash
# Test loading
claude "Use @skill-name to [task]"

# Test various scenarios
claude "Use @skill-name with [edge case]"

# Check output quality
claude "Use @skill-name to [complex task]"
```

---

## DISTRIBUTION

### Package for Distribution

```json
{
  "name": "your-skill-name",
  "version": "1.0.0",
  "description": "Skill description",
  "files": [
    "SKILL.md",
    "examples/",
    "scripts/"
  ],
  "repository": "https://github.com/you/your-skill"
}
```

### Share via Awesome List

Submit to:
- antigravity-awesome-skills
- awesome-claude-code
- awesome-agentic-skills
