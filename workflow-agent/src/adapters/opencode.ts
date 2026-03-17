/**
 * OpenCode adapter - uses Task tool to spawn agents
 */
import { BaseAdapter } from './base';
import { EnvironmentAdapter, PhaseResult, Environment } from '../types';

export class OpenCodeAdapter extends BaseAdapter implements EnvironmentAdapter {
  name: Environment = 'opencode';

  async detect(): Promise<boolean> {
    // Check if we're running inside OpenCode
    // OpenCode-specific environment variables
    if (process.env.OPENCODE === '1' || process.env.OPENCODE === 'true') {
      return true;
    }

    // Check for .opencode directory
    try {
      const { code } = await this.exec('test -d .opencode');
      if (code === 0) return true;
    } catch {
      // Continue checking
    }

    // Check if opencode CLI is available
    return await this.checkCommandExists('opencode');
  }

  async runSkill(skillName: string, args: Record<string, unknown>): Promise<PhaseResult> {
    this.log(`Running phase: ${skillName} via OpenCode Task tool`);

    // In OpenCode, we use the Task tool to spawn specialized agents
    // Each phase gets its own agent with appropriate instructions

    const taskDescriptions: Record<string, string> = {
      ceo_review: 'Run CEO/founder-level strategic review on the plan',
      eng_review: 'Run engineering review: architecture, security, edge cases',
      implementing: 'Implement the approved plan by writing code',
      review: 'Review the implementation for bugs and quality issues',
      ship: 'Run tests, merge changes, and create PR',
      qa: 'Test the shipped feature thoroughly',
      retro: 'Run retrospective on the completed work',
    };

    const description = taskDescriptions[skillName] || `Execute ${skillName} phase`;

    // In actual OpenCode, this would use the Task tool
    // For now, we'll simulate by executing a command
    const argsJson = JSON.stringify(args);
    const command = `opencode task "${description}" --args '${argsJson}'`;

    this.log(`Would execute: ${command}`);

    try {
      // Since we can't actually use Task tool here, we simulate
      // In real usage, this would call OpenCode's Task tool
      return {
        success: true,
        output: `OpenCode Task: ${description}\nArgs: ${argsJson}\n\nNote: In real OpenCode, this would spawn a Task agent.`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async askUser(question: string, options?: string[]): Promise<string> {
    // Similar to Claude adapter, but formatted for OpenCode
    if (options && options.length > 0) {
      const optionsText = options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n');
      
      console.log(`\n🤖 WORKFLOW QUESTION:`);
      console.log(question);
      console.log(`\nOptions:`);
      console.log(optionsText);
      console.log(`\nRespond with A, B, C, etc.\n`);

      return 'USER_INPUT_REQUIRED';
    }

    console.log(`\n🤖 WORKFLOW QUESTION: ${question}\n`);
    return 'USER_INPUT_REQUIRED';
  }
}
