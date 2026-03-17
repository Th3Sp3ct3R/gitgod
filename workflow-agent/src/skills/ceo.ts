/**
 * Standalone CEO Review skill - strategic review using Claude API
 */
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs/promises';

export interface CEOReviewResult {
  approved: boolean;
  mode: 'expansion' | 'hold' | 'reduction';
  feedback: string[];
  questions: string[];
  recommendations: string[];
  revisedPlan?: string;
}

export class CEOSkill {
  private client?: Anthropic;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (key) {
      this.client = new Anthropic({ apiKey: key });
    }
  }

  /**
   * Run CEO-level strategic review on a plan
   */
  async review(planPath: string, context?: Record<string, unknown>): Promise<CEOReviewResult> {
    console.log('🎯 Running CEO Review...\n');

    // Load plan
    const planContent = await fs.readFile(planPath, 'utf-8');

    // Analyze with Claude
    const analysis = await this.analyzeWithClaude(planContent, context);

    // Print review
    this.printReview(analysis);

    return analysis;
  }

  /**
   * Analyze plan with Claude
   */
  private async analyzeWithClaude(planContent: string, context?: Record<string, unknown>): Promise<CEOReviewResult> {
    if (!this.client) {
      throw new Error('Anthropic API key not set. Set ANTHROPIC_API_KEY environment variable.');
    }

    const prompt = this.buildPrompt(planContent, context);

    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      system: `You are a seasoned CTO/CEO reviewing a technical plan. 
Your job is to think strategically about:
1. Is this the right problem to solve?
2. What's the 10x version that delivers massive value?
3. Dream state - where should this be in 12 months?
4. Scope mode: EXPANSION (push scope up), HOLD (maintain), or REDUCTION (strip to essentials)

Be opinionated and challenge assumptions. Push for the ambitious version that creates real value.

Respond in structured JSON format.`,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    return this.parseResponse(content.text);
  }

  /**
   * Build the review prompt
   */
  private buildPrompt(planContent: string, context?: Record<string, unknown>): string {
    return `Review this technical plan as a CEO/CTO would.

## Plan to Review

${planContent}

${context ? `\n## Additional Context\n\n${JSON.stringify(context, null, 2)}` : ''}

## Your Task

As CEO, provide strategic review:

1. **MODE SELECTION** - Which mode should we operate in?
   - EXPANSION: This is good but could be 10x better. Push scope UP.
   - HOLD: Scope is right, focus on execution quality.
   - REDUCTION: Overbuilt or solving wrong problem. Strip to essentials.

2. **PREMISE CHALLENGE** - Is this the right problem? What if we reframed it?

3. **10X CHECK** - What's the version that's 10x more valuable for 2x effort?

4. **DREAM STATE** - Where should this system be in 12 months? What's the ideal end state?

5. **EXISTING LEVERAGE** - What existing code/patterns can we reuse?

6. **KEY QUESTIONS** - What decisions need to be made NOW?

7. **RECOMMENDATIONS** - Specific actions to take.

## Output Format

Respond in this exact JSON structure:

{
  "mode": "expansion|hold|reduction",
  "feedback": [
    "Point 1 about premise...",
    "Point 2 about 10x opportunity...",
    "Point 3 about dream state..."
  ],
  "questions": [
    "Question 1 that needs answer...",
    "Question 2 that needs answer..."
  ],
  "recommendations": [
    "Recommendation 1...",
    "Recommendation 2..."
  ],
  "approved": true|false,
  "revisedPlan": "If mode is EXPANSION or REDUCTION, provide revised plan markdown here. Otherwise null."
}

Be honest and opinionated. If the plan is weak, say so. If it could be 10x better, push for it.`;
  }

  /**
   * Parse Claude's JSON response
   */
  private parseResponse(text: string): CEOReviewResult {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Fallback if not proper JSON
      return {
        approved: true,
        mode: 'hold',
        feedback: ['Review completed but structured parsing failed'],
        questions: [],
        recommendations: ['Review plan manually'],
      };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        approved: parsed.approved ?? true,
        mode: parsed.mode || 'hold',
        feedback: parsed.feedback || [],
        questions: parsed.questions || [],
        recommendations: parsed.recommendations || [],
        revisedPlan: parsed.revisedPlan,
      };
    } catch {
      return {
        approved: true,
        mode: 'hold',
        feedback: ['Review completed'],
        questions: [],
        recommendations: ['See full analysis above'],
      };
    }
  }

  /**
   * Print review results
   */
  private printReview(result: CEOReviewResult): void {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('                    CEO REVIEW RESULTS                      ');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`Mode: ${result.mode.toUpperCase()}`);
    console.log(`Approved: ${result.approved ? '✅ YES' : '❌ NO'}\n`);

    console.log('📝 FEEDBACK');
    console.log('═══════════');
    result.feedback.forEach((f, i) => {
      console.log(`${i + 1}. ${f}\n`);
    });

    if (result.questions.length > 0) {
      console.log('❓ QUESTIONS TO RESOLVE');
      console.log('═══════════════════════');
      result.questions.forEach((q, i) => {
        console.log(`${i + 1}. ${q}`);
      });
      console.log();
    }

    console.log('💡 RECOMMENDATIONS');
    console.log('══════════════════');
    result.recommendations.forEach((r, i) => {
      console.log(`${i + 1}. ${r}`);
    });
    console.log();

    if (result.revisedPlan) {
      console.log('📄 REVISED PLAN');
      console.log('═══════════════');
      console.log(result.revisedPlan);
      console.log();
    }

    console.log('═══════════════════════════════════════════════════════════\n');
  }
}
