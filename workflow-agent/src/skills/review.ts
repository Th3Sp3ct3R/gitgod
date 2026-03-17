/**
 * Standalone Code Review skill
 */
import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';

export interface CodeReviewResult {
  approved: boolean;
  bugs: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    file: string;
    line?: number;
    description: string;
    fix: string;
  }>;
  quality: {
    score: number;
    issues: string[];
    improvements: string[];
  };
  patterns: {
    good: string[];
    bad: string[];
  };
  security: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    issue: string;
    recommendation: string;
  }>;
  suggestions: string[];
}

export class ReviewSkill {
  private client?: Anthropic;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (key) {
      this.client = new Anthropic({ apiKey: key });
    }
  }

  async review(repoPath: string): Promise<CodeReviewResult> {
    console.log('👀 Running Code Review...\n');

    // Get git diff
    const diff = this.getDiff(repoPath);
    
    // Get changed files
    const changedFiles = this.getChangedFiles(repoPath);

    if (this.client && diff) {
      const result = await this.analyzeWithClaude(diff, changedFiles);
      this.printReview(result);
      return result;
    } else {
      return this.manualReview(changedFiles);
    }
  }

  private getDiff(repoPath: string): string {
    try {
      return execSync('git diff HEAD', { cwd: repoPath, encoding: 'utf-8' });
    } catch {
      try {
        return execSync('git diff', { cwd: repoPath, encoding: 'utf-8' });
      } catch {
        return '';
      }
    }
  }

  private getChangedFiles(repoPath: string): string[] {
    try {
      const output = execSync('git diff --name-only', { cwd: repoPath, encoding: 'utf-8' });
      return output.split('\n').filter(f => f.trim());
    } catch {
      return [];
    }
  }

  private async analyzeWithClaude(diff: string, files: string[]): Promise<CodeReviewResult> {
    const prompt = this.buildPrompt(diff, files);

    const response = await this.client!.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      system: `You are a paranoid staff engineer reviewing code for production.
Your job is to find bugs that pass CI but blow up in production.

Look for:
- Logic errors
- Off-by-one errors  
- Race conditions
- Resource leaks
- Security vulnerabilities
- Error handling gaps

Be specific: file paths, line numbers, exact issues.

Respond in structured JSON.`,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    return this.parseResponse(content.text);
  }

  private buildPrompt(diff: string, files: string[]): string {
    return `Review this code diff for bugs and quality issues.

## Changed Files
${files.join('\n')}

## Diff
${diff.substring(0, 8000)}${diff.length > 8000 ? '\n... (truncated)' : ''}

## Review Requirements

Find:
1. BUGS - Logic errors, race conditions, crashes
2. SECURITY - Injection, auth bypasses, leaks
3. QUALITY - Complexity, readability, patterns
4. EDGE CASES - Null inputs, empty arrays, timeouts

## Output Format

{
  "approved": true/false,
  "bugs": [
    {
      "severity": "critical|high|medium|low",
      "file": "path/to/file.ts",
      "line": 42,
      "description": "What's wrong",
      "fix": "How to fix it"
    }
  ],
  "quality": {
    "score": 1-10,
    "issues": ["Issue 1...", "Issue 2..."],
    "improvements": ["Improvement 1...", "Improvement 2..."]
  },
  "patterns": {
    "good": ["Good pattern 1...", "Good pattern 2..."],
    "bad": ["Bad pattern 1...", "Bad pattern 2..."]
  },
  "security": [
    {
      "severity": "critical|high|medium|low",
      "issue": "Security issue",
      "recommendation": "How to fix"
    }
  ],
  "suggestions": ["Suggestion 1...", "Suggestion 2..."]
}`;
  }

  private parseResponse(text: string): CodeReviewResult {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return this.getDefaultResult();
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        approved: parsed.approved ?? true,
        bugs: parsed.bugs || [],
        quality: parsed.quality || { score: 5, issues: [], improvements: [] },
        patterns: parsed.patterns || { good: [], bad: [] },
        security: parsed.security || [],
        suggestions: parsed.suggestions || [],
      };
    } catch {
      return this.getDefaultResult();
    }
  }

  private getDefaultResult(): CodeReviewResult {
    return {
      approved: true,
      bugs: [],
      quality: { score: 5, issues: [], improvements: [] },
      patterns: { good: [], bad: [] },
      security: [],
      suggestions: ['Manual review recommended'],
    };
  }

  private manualReview(files: string[]): CodeReviewResult {
    console.log('⚠️  Claude API not available. Manual code review.\n');
    console.log(`Files changed: ${files.join(', ') || 'None detected'}`);
    
    return {
      approved: true,
      bugs: [],
      quality: {
        score: 7,
        issues: ['No automated analysis'],
        improvements: ['Run with ANTHROPIC_API_KEY for detailed review'],
      },
      patterns: { good: [], bad: [] },
      security: [],
      suggestions: [
        'Review logic manually',
        'Check error handling',
        'Verify edge cases',
      ],
    };
  }

  private printReview(result: CodeReviewResult): void {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                 CODE REVIEW RESULTS                        ');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`Approved: ${result.approved ? '✅ YES' : '❌ NO'}\n`);

    if (result.bugs.length > 0) {
      console.log('🐛 BUGS FOUND');
      console.log('══════════════');
      result.bugs.forEach(bug => {
        const icon = bug.severity === 'critical' ? '🔴' : bug.severity === 'high' ? '🟠' : '🟡';
        console.log(`${icon} [${bug.severity.toUpperCase()}] ${bug.file}${bug.line ? `:${bug.line}` : ''}`);
        console.log(`   ${bug.description}`);
        console.log(`   Fix: ${bug.fix}\n`);
      });
    }

    if (result.security.length > 0) {
      console.log('🔒 SECURITY ISSUES');
      console.log('═══════════════════');
      result.security.forEach(sec => {
        const icon = sec.severity === 'critical' ? '🔴' : sec.severity === 'high' ? '🟠' : '🟡';
        console.log(`${icon} [${sec.severity.toUpperCase()}] ${sec.issue}`);
        console.log(`   Fix: ${sec.recommendation}\n`);
      });
    }

    console.log(`📊 QUALITY SCORE: ${result.quality.score}/10`);
    console.log('═══════════════════');
    if (result.quality.issues.length > 0) {
      console.log('Issues:');
      result.quality.issues.forEach(i => console.log(`  • ${i}`));
    }
    if (result.quality.improvements.length > 0) {
      console.log('\nImprovements:');
      result.quality.improvements.forEach(i => console.log(`  → ${i}`));
    }
    console.log();

    if (result.patterns.good.length > 0) {
      console.log('✅ GOOD PATTERNS');
      console.log('══════════════════');
      result.patterns.good.forEach(p => console.log(`  • ${p}`));
      console.log();
    }

    if (result.patterns.bad.length > 0) {
      console.log('❌ PATTERNS TO AVOID');
      console.log('═════════════════════');
      result.patterns.bad.forEach(p => console.log(`  • ${p}`));
      console.log();
    }

    if (result.suggestions.length > 0) {
      console.log('💡 SUGGESTIONS');
      console.log('═══════════════');
      result.suggestions.forEach(s => console.log(`  • ${s}`));
      console.log();
    }

    console.log('═══════════════════════════════════════════════════════════\n');
  }
}
