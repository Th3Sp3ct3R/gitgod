/**
 * LLM-powered plan generation using Claude
 */
import Anthropic from '@anthropic-ai/sdk';
import { CodebaseContext } from '../analyzer';

export interface GeneratedPlan {
  title: string;
  description: string;
  goals: string[];
  scope: {
    in: string[];
    out: string[];
  };
  phases: Array<{
    name: string;
    tasks: string[];
    estimatedHours: number;
  }>;
  risks: string[];
  successCriteria: string[];
  markdown: string;
}

export class PlanGenerator {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Generate a plan based on codebase analysis
   */
  async generatePlan(context: CodebaseContext): Promise<GeneratedPlan> {
    const prompt = this.buildPrompt(context);
    
    console.log('🤖 Asking Claude to generate plan...\n');

    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      system: `You are an expert software architect and product manager. 
Your job is to analyze a codebase and suggest the next most valuable feature to build.

Be specific and actionable. Consider:
- What's already built vs what's missing
- Technical debt that needs addressing
- User-facing features that would add value
- Infrastructure improvements

Output a structured plan in the exact format requested.`,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    return this.parsePlan(content.text);
  }

  /**
   * Build the prompt for Claude
   */
  private buildPrompt(context: CodebaseContext): string {
    return `Analyze this codebase and suggest the next feature to build.

## Codebase Context

**Summary:** ${context.summary}

**Languages:** ${Object.entries(context.codeStructure.languages).map(([l, c]) => `${l}(${c} files)`).join(', ')}

**Entry Points:** ${context.codeStructure.mainEntryPoints.join(', ') || 'None'}

**Key Modules:** ${context.codeStructure.keyModules.join(', ') || 'None'}

**Existing Plans:**
${context.existingPlans.map(p => `- ${p.path}: ${p.title}`).join('\n') || 'None'}

**TODOs Found:**
${context.todos.slice(0, 10).map(t => `- [${t.type}] ${t.file}:${t.line} - ${t.text}`).join('\n') || 'None'}

**Recent Commits:**
${context.recentCommits.slice(0, 5).map(c => `- ${c.hash}: ${c.message}`).join('\n') || 'None'}

**Gaps Identified:**
${context.gaps.map(g => `- ${g}`).join('\n') || 'None'}

## Task

Based on this analysis, suggest ONE specific feature or improvement that should be built next. 

Consider:
1. What's the most impactful next step?
2. What builds on recent work?
3. What addresses identified gaps?
4. What's achievable in 1-2 weeks?

## Output Format

Provide your response in this exact format:

TITLE: <Concise feature name>

DESCRIPTION: <2-3 sentence description of what this feature does and why it matters>

GOALS:
- <Goal 1>
- <Goal 2>
- <Goal 3>

SCOPE_IN:
- <What's included>
- <Specific deliverables>

SCOPE_OUT:
- <What's NOT included>
- <Future work>

PHASES:
1. <Phase name> (<estimated hours>h)
   - <Task 1>
   - <Task 2>
2. <Phase name> (<estimated hours>h)
   - <Task 1>
   - <Task 2>
3. <Phase name> (<estimated hours>h)
   - <Task 1>

RISKS:
- <Risk 1 and mitigation>
- <Risk 2 and mitigation>

SUCCESS_CRITERIA:
- <Criterion 1>
- <Criterion 2>
- <Criterion 3>

Be specific and actionable. This plan will go through CEO Review → Eng Review → Implementation.`;
  }

  /**
   * Parse Claude's response into structured plan
   */
  private parsePlan(text: string): GeneratedPlan {
    const lines = text.split('\n');
    
    let title = '';
    let description = '';
    const goals: string[] = [];
    const scopeIn: string[] = [];
    const scopeOut: string[] = [];
    const phases: GeneratedPlan['phases'] = [];
    const risks: string[] = [];
    const successCriteria: string[] = [];

    let currentSection: string | null = null;
    let currentPhase: { name: string; tasks: string[]; estimatedHours: number } | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Parse title
      if (trimmed.startsWith('TITLE:')) {
        title = trimmed.replace('TITLE:', '').trim();
        continue;
      }

      // Parse description
      if (trimmed.startsWith('DESCRIPTION:')) {
        description = trimmed.replace('DESCRIPTION:', '').trim();
        continue;
      }

      // Detect sections
      if (trimmed === 'GOALS:') {
        currentSection = 'goals';
        continue;
      }
      if (trimmed === 'SCOPE_IN:') {
        currentSection = 'scope_in';
        continue;
      }
      if (trimmed === 'SCOPE_OUT:') {
        currentSection = 'scope_out';
        continue;
      }
      if (trimmed === 'PHASES:') {
        currentSection = 'phases';
        continue;
      }
      if (trimmed === 'RISKS:') {
        currentSection = 'risks';
        currentPhase = null;
        continue;
      }
      if (trimmed === 'SUCCESS_CRITERIA:') {
        currentSection = 'success';
        currentPhase = null;
        continue;
      }

      // Skip empty lines
      if (!trimmed) continue;

      // Parse list items
      if (trimmed.startsWith('- ')) {
        const content = trimmed.substring(2);
        
        switch (currentSection) {
          case 'goals':
            goals.push(content);
            break;
          case 'scope_in':
            scopeIn.push(content);
            break;
          case 'scope_out':
            scopeOut.push(content);
            break;
          case 'phases':
            if (currentPhase) {
              currentPhase.tasks.push(content);
            }
            break;
          case 'risks':
            risks.push(content);
            break;
          case 'success':
            successCriteria.push(content);
            break;
        }
        continue;
      }

      // Parse phase headers
      const phaseMatch = trimmed.match(/^(\d+)\.\s+(.+?)\s+\((\d+)h\)$/);
      if (phaseMatch && currentSection === 'phases') {
        if (currentPhase) {
          phases.push(currentPhase);
        }
        currentPhase = {
          name: phaseMatch[2],
          tasks: [],
          estimatedHours: parseInt(phaseMatch[3], 10),
        };
      }
    }

    // Don't forget the last phase
    if (currentPhase) {
      phases.push(currentPhase);
    }

    // Build markdown
    const markdown = this.buildMarkdown({
      title,
      description,
      goals,
      scope: { in: scopeIn, out: scopeOut },
      phases,
      risks,
      successCriteria,
    });

    return {
      title,
      description,
      goals,
      scope: { in: scopeIn, out: scopeOut },
      phases,
      risks,
      successCriteria,
      markdown,
    };
  }

  /**
   * Build markdown document from plan
   */
  private buildMarkdown(plan: Omit<GeneratedPlan, 'markdown'>): string {
    return `# ${plan.title}

## Overview

${plan.description}

## Goals

${plan.goals.map(g => `- ${g}`).join('\n')}

## Scope

### In Scope

${plan.scope.in.map(s => `- ${s}`).join('\n')}

### Out of Scope (Future Work)

${plan.scope.out.map(s => `- ${s}`).join('\n')}

## Implementation Phases

${plan.phases.map((p, i) => `
### Phase ${i + 1}: ${p.name} (~${p.estimatedHours}h)

${p.tasks.map(t => `- ${t}`).join('\n')}
`).join('\n')}

## Risks and Mitigations

${plan.risks.map(r => `- ${r}`).join('\n')}

## Success Criteria

${plan.successCriteria.map(s => `- [ ] ${s}`).join('\n')}

---

*Generated by gitgodreview workflow agent*
`;
  }
}
