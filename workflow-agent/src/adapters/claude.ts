/**
 * Claude Code adapter - uses native gstack skills
 */
import { BaseAdapter } from './base';
import { EnvironmentAdapter, PhaseResult, Environment } from '../types';

export class ClaudeAdapter extends BaseAdapter implements EnvironmentAdapter {
  name: Environment = 'claude';

  async detect(): Promise<boolean> {
    // Check if we're running inside Claude Code
    // Claude Code sets CLAUDE_CODE environment variable
    if (process.env.CLAUDE_CODE === '1' || process.env.CLAUDE_CODE === 'true') {
      return true;
    }
    
    // Check for experimental Claude Code flag
    if (process.env.CLAUDE_CODE_EXPERIMENTAL) {
      return true;
    }

    // Check if claude CLI is available
    const hasClaudeCLI = await this.checkCommandExists('claude');
    if (!hasClaudeCLI) {
      return false;
    }

    // Check for .claude directory indicating Claude Code project
    try {
      const { code } = await this.exec('test -d .claude');
      return code === 0;
    } catch {
      return false;
    }
  }

  async runSkill(skillName: string, args: Record<string, unknown>): Promise<PhaseResult> {
    this.log(`Running skill: ${skillName}`);

    // Map phase names to gstack skill names
    const skillMap: Record<string, string> = {
      ceo_review: 'plan-ceo-review',
      eng_review: 'plan-eng-review',
      review: 'review',
      ship: 'ship',
      qa: 'qa',
      retro: 'retro',
    };

    const gstackSkill = skillMap[skillName];
    if (!gstackSkill) {
      return {
        success: true,
        output: `Phase ${skillName} doesn't require a skill`,
      };
    }

    // Build skill invocation
    const skillArgs = Object.entries(args)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(' ');

    const command = `claude "/${gstackSkill} ${skillArgs}"`;
    
    this.log(`Executing: ${command}`);

    try {
      const { stdout, stderr, code } = await this.exec(command);
      
      if (code !== 0) {
        return {
          success: false,
          error: stderr || `Command failed with code ${code}`,
          output: stdout,
        };
      }

      return {
        success: true,
        output: stdout,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async askUser(question: string, options?: string[]): Promise<string> {
    // In Claude Code, we can use the native askUser question format
    // This will be displayed to the user in the Claude UI
    
    if (options && options.length > 0) {
      const optionsText = options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n');
      
      // Output in a format Claude can parse
      console.log(`\n🤖 WORKFLOW QUESTION:`);
      console.log(question);
      console.log(`\nOptions:`);
      console.log(optionsText);
      console.log(`\nRespond with A, B, C, etc.\n`);

      // In Claude Code, we'd ideally use the native askUserQuestion tool
      // For now, we'll return a placeholder that indicates we need user input
      return 'USER_INPUT_REQUIRED';
    }

    console.log(`\n🤖 WORKFLOW QUESTION: ${question}\n`);
    return 'USER_INPUT_REQUIRED';
  }
}
