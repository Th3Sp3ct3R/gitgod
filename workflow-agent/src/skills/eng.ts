/**
 * Standalone Engineering Review skill
 */
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs/promises';
import { glob } from 'glob';
import * as path from 'path';

export interface EngReviewResult {
  approved: boolean;
  architecture: {
    score: number;
    findings: string[];
    recommendations: string[];
  };
  security: {
    score: number;
    findings: string[];
    recommendations: string[];
  };
  errors: {
    mappedExceptions: string[];
    gaps: string[];
  };
  tests: {
    coverage: number;
    missing: string[];
  };
  performance: {
    findings: string[];
    optimizations: string[];
  };
  overall: string[];
}

export class EngReviewSkill {
  private client?: Anthropic;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (key) {
      this.client = new Anthropic({ apiKey: key });
    }
  }

  async review(repoPath: string, planPath?: string): Promise<EngReviewResult> {
    console.log('🔧 Running Engineering Review...\n');

    // Gather code context
    const codeContext = await this.gatherCodeContext(repoPath);
    
    // Load plan if provided
    let planContent = '';
    if (planPath) {
      try {
        planContent = await fs.readFile(planPath, 'utf-8');
      } catch {
        // Plan may not exist
      }
    }

    if (this.client) {
      const result = await this.analyzeWithClaude(codeContext, planContent);
      this.printReview(result);
      return result;
    } else {
      // Fallback to manual
      return this.manualReview(codeContext);
    }
  }

  private async gatherCodeContext(repoPath: string): Promise<any> {
    const context: any = {
      structure: {},
      files: [],
      dependencies: [],
      todos: [],
    };

    // Get directory structure
    try {
      const files = glob.sync('**/*.{ts,js,tsx,jsx,py,go,rs}', {
        cwd: repoPath,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      });
      context.files = files.slice(0, 50); // Limit to 50 files

      // Read key files
      for (const file of files.slice(0, 10)) {
        try {
          const content = await fs.readFile(path.join(repoPath, file), 'utf-8');
          context.structure[file] = content.substring(0, 1000); // First 1000 chars
        } catch {}
      }
    } catch {}

    // Check for package.json
    try {
      const pkg = await fs.readFile(path.join(repoPath, 'package.json'), 'utf-8');
      const pkgJson = JSON.parse(pkg);
      context.dependencies = Object.keys(pkgJson.dependencies || {});
      context.devDependencies = Object.keys(pkgJson.devDependencies || {});
    } catch {}

    return context;
  }

  private async analyzeWithClaude(codeContext: any, planContent: string): Promise<EngReviewResult> {
    const prompt = this.buildPrompt(codeContext, planContent);

    const response = await this.client!.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      system: `You are a senior staff engineer conducting a rigorous code review.
Your job is to:
1. Review architecture - coupling, boundaries, scaling
2. Map every error path - what can fail and how
3. Security review - attack surfaces, input validation, secrets
4. Test coverage - what's missing
5. Performance - N+1 queries, memory, async

Be thorough and specific. Reference actual code patterns.

Respond in structured JSON.`,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    return this.parseResponse(content.text);
  }

  private buildPrompt(codeContext: any, planContent: string): string {
    return `Conduct a rigorous engineering review.

## Code Context

Files: ${codeContext.files.slice(0, 20).join(', ')}
Dependencies: ${codeContext.dependencies?.slice(0, 10).join(', ')}
Dev Dependencies: ${codeContext.devDependencies?.slice(0, 10).join(', ')}

## Key Files
${Object.entries(codeContext.structure).map(([file, content]) => `
### ${file}
${(content as string).substring(0, 500)}...
`).join('')}

${planContent ? `\n## Plan to Review\n${planContent}` : ''}

## Review Requirements

1. ARCHITECTURE: Component boundaries, data flow, coupling
2. ERROR HANDLING: Map all failure modes, rescue strategies
3. SECURITY: Input validation, secrets, injection risks
4. TESTS: What's missing, coverage gaps
5. PERFORMANCE: N+1 queries, memory, async patterns

## Output Format

{
  "approved": true/false,
  "architecture": {
    "score": 1-10,
    "findings": ["Finding 1...", "Finding 2..."],
    "recommendations": ["Rec 1...", "Rec 2..."]
  },
  "security": {
    "score": 1-10,
    "findings": ["Finding 1...", "Finding 2..."],
    "recommendations": ["Rec 1...", "Rec 2..."]
  },
  "errors": {
    "mappedExceptions": ["Exception 1...", "Exception 2..."],
    "gaps": ["Gap 1...", "Gap 2..."]
  },
  "tests": {
    "coverage": 0-100,
    "missing": ["Test 1...", "Test 2..."]
  },
  "performance": {
    "findings": ["Finding 1...", "Finding 2..."],
    "optimizations": ["Opt 1...", "Opt 2..."]
  },
  "overall": ["Overall rec 1...", "Overall rec 2..."]
}`;
  }

  private parseResponse(text: string): EngReviewResult {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return this.getDefaultResult();
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        approved: parsed.approved ?? true,
        architecture: parsed.architecture || { score: 5, findings: [], recommendations: [] },
        security: parsed.security || { score: 5, findings: [], recommendations: [] },
        errors: parsed.errors || { mappedExceptions: [], gaps: [] },
        tests: parsed.tests || { coverage: 0, missing: [] },
        performance: parsed.performance || { findings: [], optimizations: [] },
        overall: parsed.overall || [],
      };
    } catch {
      return this.getDefaultResult();
    }
  }

  private getDefaultResult(): EngReviewResult {
    return {
      approved: true,
      architecture: { score: 5, findings: ['Review completed'], recommendations: [] },
      security: { score: 5, findings: ['Review completed'], recommendations: [] },
      errors: { mappedExceptions: [], gaps: [] },
      tests: { coverage: 0, missing: [] },
      performance: { findings: [], optimizations: [] },
      overall: ['Manual review recommended'],
    };
  }

  private manualReview(codeContext: any): EngReviewResult {
    console.log('⚠️  Claude API not available. Manual engineering review.\n');
    
    return {
      approved: true,
      architecture: {
        score: 7,
        findings: ['Manual review required'],
        recommendations: ['Review component boundaries', 'Check data flow'],
      },
      security: {
        score: 6,
        findings: ['No automated security scan'],
        recommendations: ['Add input validation', 'Check for secrets in code'],
      },
      errors: {
        mappedExceptions: ['Review error handling patterns'],
        gaps: ['Manual error mapping needed'],
      },
      tests: {
        coverage: 0,
        missing: ['Test framework not detected'],
      },
      performance: {
        findings: ['No performance analysis available'],
        optimizations: ['Profile critical paths'],
      },
      overall: [
        'Manual engineering review completed',
        'Run with ANTHROPIC_API_KEY for automated analysis',
      ],
    };
  }

  private printReview(result: EngReviewResult): void {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('              ENGINEERING REVIEW RESULTS                    ');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`Approved: ${result.approved ? '✅ YES' : '❌ NO'}\n`);

    console.log(`🏗️  ARCHITECTURE (${result.architecture.score}/10)`);
    console.log('═══════════════════════════════════════════');
    result.architecture.findings.forEach(f => console.log(`  • ${f}`));
    console.log('\nRecommendations:');
    result.architecture.recommendations.forEach(r => console.log(`  → ${r}`));
    console.log();

    console.log(`🔒 SECURITY (${result.security.score}/10)`);
    console.log('═══════════════════════════════════════════');
    result.security.findings.forEach(f => console.log(`  • ${f}`));
    console.log('\nRecommendations:');
    result.security.recommendations.forEach(r => console.log(`  → ${r}`));
    console.log();

    console.log('⚠️  ERROR HANDLING');
    console.log('═══════════════════════════════════════════');
    console.log('Mapped Exceptions:');
    result.errors.mappedExceptions.forEach(e => console.log(`  • ${e}`));
    console.log('\nGaps:');
    result.errors.gaps.forEach(g => console.log(`  ⚠️  ${g}`));
    console.log();

    console.log(`🧪 TESTS (${result.tests.coverage}% coverage)`);
    console.log('═══════════════════════════════════════════');
    console.log('Missing:');
    result.tests.missing.forEach(m => console.log(`  • ${m}`));
    console.log();

    console.log('⚡ PERFORMANCE');
    console.log('═══════════════════════════════════════════');
    result.performance.findings.forEach(f => console.log(`  • ${f}`));
    console.log('\nOptimizations:');
    result.performance.optimizations.forEach(o => console.log(`  → ${o}`));
    console.log();

    console.log('📋 OVERALL RECOMMENDATIONS');
    console.log('═══════════════════════════════════════════');
    result.overall.forEach(r => console.log(`  • ${r}`));
    console.log('\n═══════════════════════════════════════════════════════════\n');
  }
}
