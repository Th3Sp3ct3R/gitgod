/**
 * Standalone adapter - works in any terminal with interactive prompts
 */
import * as inquirer from 'inquirer';
import { BaseAdapter } from './base';
import { EnvironmentAdapter, PhaseResult, Environment } from '../types';
import { CEOSkill, EngReviewSkill, ReviewSkill, ShipQARetroSkill } from '../skills';

export class StandaloneAdapter extends BaseAdapter implements EnvironmentAdapter {
  name: Environment = 'standalone';

  async detect(): Promise<boolean> {
    // Standalone is the fallback - it always "detects" if no other adapter does
    // But we give other adapters priority by checking them first
    return true;
  }

  async runSkill(skillName: string, args: Record<string, unknown>): Promise<PhaseResult> {
    this.log(`Running phase: ${skillName} (standalone mode)`);

    // In standalone mode, we need to implement each phase ourselves
    // or shell out to appropriate tools

    switch (skillName) {
      case 'ceo_review':
        return this.runCEOReview(args);
      case 'eng_review':
        return this.runEngReview(args);
      case 'implementing':
        return this.runImplementation(args);
      case 'review':
        return this.runReview(args);
      case 'ship':
        return this.runShip(args);
      case 'qa':
        return this.runQA(args);
      case 'retro':
        return this.runRetro(args);
      default:
        return {
          success: true,
          output: `Phase ${skillName} completed (no-op in standalone mode)`,
        };
    }
  }

  async askUser(question: string, options?: string[]): Promise<string> {
    if (options && options.length > 0) {
      const { answer } = await inquirer.prompt([
        {
          type: 'list',
          name: 'answer',
          message: question,
          choices: options.map((opt, i) => ({
            name: `${String.fromCharCode(65 + i)}) ${opt}`,
            value: String.fromCharCode(65 + i),
          })),
        },
      ]);
      return answer;
    }

    const { answer } = await inquirer.prompt([
      {
        type: 'input',
        name: 'answer',
        message: question,
      },
    ]);
    return answer;
  }

  private async runCEOReview(args: Record<string, unknown>): Promise<PhaseResult> {
    this.log('Starting CEO Review with Claude API');
    
    const planPath = args.planPath as string;
    if (!planPath) {
      return {
        success: false,
        error: 'No plan path provided for CEO review',
      };
    }

    try {
      const ceoSkill = new CEOSkill();
      const result = await ceoSkill.review(planPath, args);

      // Ask user if they approve
      const { approved } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'approved',
          message: `CEO Review mode: ${result.mode.toUpperCase()}. Do you approve this plan?`,
          default: result.approved,
        },
      ]);

      if (!approved) {
        return {
          success: false,
          error: 'CEO Review rejected',
          artifacts: {
            feedback: result.feedback.join('\n'),
            recommendations: result.recommendations.join('\n'),
          },
        };
      }

      // If there's a revised plan and mode is expansion/reduction, save it
      if (result.revisedPlan && (result.mode === 'expansion' || result.mode === 'reduction')) {
        const { useRevised } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'useRevised',
            message: 'Use the revised plan?',
            default: true,
          },
        ]);

        if (useRevised) {
          const fs = require('fs').promises;
          const path = require('path');
          const revisedPath = planPath.replace('.md', '-ceo-approved.md');
          await fs.writeFile(revisedPath, result.revisedPlan, 'utf-8');
          
          return {
            success: true,
            output: 'CEO Review completed with revised plan',
            artifacts: {
              approvedPlanPath: revisedPath,
              mode: result.mode,
              feedback: result.feedback.join('\n'),
            },
          };
        }
      }

      return {
        success: true,
        output: 'CEO Review completed',
        artifacts: {
          mode: result.mode,
          feedback: result.feedback.join('\n'),
          recommendations: result.recommendations.join('\n'),
        },
      };
    } catch (error) {
      this.log(`CEO Review error: ${error}`, 'error');
      
      // Fallback to manual review
      console.log('\n⚠️  Claude API failed. Falling back to manual CEO review.\n');
      
      const { notes } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'notes',
          message: 'Enter CEO review notes manually:',
        },
      ]);

      return {
        success: true,
        output: 'CEO Review completed (manual fallback)',
        artifacts: { notes },
      };
    }
  }

  private async runEngReview(args: Record<string, unknown>): Promise<PhaseResult> {
    this.log('Starting Engineering Review with Claude API');
    
    const repoPath = (args.repoPath as string) || process.cwd();
    const planPath = args.planPath as string;

    try {
      const engSkill = new EngReviewSkill();
      const result = await engSkill.review(repoPath, planPath);

      // Ask for approval
      const { approved } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'approved',
          message: `Engineering Review complete. Architecture score: ${result.architecture.score}/10, Security: ${result.security.score}/10. Approve?`,
          default: result.approved,
        },
      ]);

      if (!approved) {
        return {
          success: false,
          error: 'Engineering Review rejected',
          artifacts: {
            architectureScore: String(result.architecture.score),
            securityScore: String(result.security.score),
            overall: result.overall.join('\n'),
          },
        };
      }

      return {
        success: true,
        output: 'Engineering Review completed',
        artifacts: {
          architectureScore: String(result.architecture.score),
          securityScore: String(result.security.score),
          testCoverage: String(result.tests.coverage),
        },
      };
    } catch (error) {
      this.log(`Engineering Review error: ${error}`, 'error');
      
      // Fallback
      console.log('\n⚠️  Claude API failed. Manual engineering review.\n');
      
      const { notes } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'notes',
          message: 'Enter engineering review notes:',
        },
      ]);

      return {
        success: true,
        output: 'Engineering Review completed (manual fallback)',
        artifacts: { notes },
      };
    }
  }

  private async runImplementation(args: Record<string, unknown>): Promise<PhaseResult> {
    this.log('Starting Implementation (standalone)');
    
    console.log('\n💻 IMPLEMENTATION PHASE');
    console.log('In standalone mode, implementation is manual.');
    console.log('Please implement the approved plan, then run: workflow continue\n');

    return {
      success: true,
      output: 'Implementation phase started (manual)',
      shouldPause: true,
      pauseReason: 'Manual implementation required',
    };
  }

  private async runReview(args: Record<string, unknown>): Promise<PhaseResult> {
    this.log('Starting Code Review with Claude API');
    
    const repoPath = (args.repoPath as string) || process.cwd();

    try {
      const reviewSkill = new ReviewSkill();
      const result = await reviewSkill.review(repoPath);

      // Ask for approval
      const { approved } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'approved',
          message: `Code Review complete. Quality score: ${result.quality.score}/10, Bugs: ${result.bugs.length}. Approve?`,
          default: result.approved && result.bugs.filter(b => b.severity === 'critical').length === 0,
        },
      ]);

      if (!approved) {
        return {
          success: false,
          error: 'Code Review rejected - fix issues before proceeding',
          artifacts: {
            qualityScore: String(result.quality.score),
            bugs: String(result.bugs.length),
            suggestions: result.suggestions.join('\n'),
          },
        };
      }

      return {
        success: true,
        output: 'Code Review completed',
        artifacts: {
          qualityScore: String(result.quality.score),
          bugs: String(result.bugs.length),
          securityIssues: String(result.security.length),
        },
      };
    } catch (error) {
      this.log(`Code Review error: ${error}`, 'error');
      
      // Fallback
      console.log('\n⚠️  Claude API failed. Manual code review.\n');
      
      try {
        const { stdout } = await this.exec('git diff --stat');
        if (stdout) console.log(stdout);
      } catch {
        console.log('(No git changes)');
      }

      const { notes } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'notes',
          message: 'Enter code review findings:',
        },
      ]);

      return {
        success: true,
        output: 'Code Review completed (manual fallback)',
        artifacts: { notes },
      };
    }
  }

  private async runShip(args: Record<string, unknown>): Promise<PhaseResult> {
    this.log('Starting Ship phase');
    
    const repoPath = (args.repoPath as string) || process.cwd();

    try {
      const shipSkill = new ShipQARetroSkill();
      const result = await shipSkill.ship(repoPath);

      if (!result.success) {
        const failedSteps = result.steps.filter(s => s.status === 'failed').map(s => s.name).join(', ');
        return {
          success: false,
          error: `Ship phase failed: ${failedSteps}. Fix issues before shipping.`,
          artifacts: {
            summary: result.summary,
            failedSteps,
          },
        };
      }

      console.log(`\n✅ ${result.summary}\n`);

      return {
        success: true,
        output: result.summary,
        artifacts: {
          stepsCompleted: String(result.steps.filter(s => s.status === 'passed').length),
        },
      };
    } catch (error) {
      this.log(`Ship phase error: ${error}`, 'error');
      return {
        success: false,
        error: 'Ship phase failed unexpectedly',
      };
    }
  }

  private async runQA(args: Record<string, unknown>): Promise<PhaseResult> {
    this.log('Starting QA phase');
    
    const repoPath = (args.repoPath as string) || process.cwd();

    try {
      const qaSkill = new ShipQARetroSkill();
      const result = await qaSkill.qa(repoPath);

      if (!result.passed) {
        return {
          success: false,
          error: `QA failed: ${result.findings.length} issues found`,
          artifacts: {
            findings: result.findings.join('\n'),
            recommendations: result.recommendations.join('\n'),
          },
        };
      }

      return {
        success: true,
        output: 'QA phase completed successfully',
        artifacts: {
          testsPassed: String(result.tests.filter(t => t.status === 'passed').length),
          findings: result.findings.join('\n'),
        },
      };
    } catch (error) {
      this.log(`QA phase error: ${error}`, 'error');
      
      // Fallback
      console.log('\n⚠️  Automated QA failed. Manual QA checklist.\n');
      console.log('- [ ] Happy path works');
      console.log('- [ ] Edge cases handled');
      console.log('- [ ] Error states tested');
      console.log('- [ ] Performance acceptable');
      console.log('- [ ] No console errors\n');

      const { notes } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'notes',
          message: 'Enter QA results:',
        },
      ]);

      return {
        success: true,
        output: 'QA phase completed (manual fallback)',
        artifacts: { notes },
      };
    }
  }

  private async runRetro(args: Record<string, unknown>): Promise<PhaseResult> {
    this.log('Starting Retrospective');
    
    const workflowState = args.workflowState as any;

    try {
      const retroSkill = new ShipQARetroSkill();
      const result = await retroSkill.retro(workflowState);

      return {
        success: true,
        output: 'Retrospective completed',
        artifacts: {
          wentWell: result.wentWell.join('\n'),
          improvements: result.improvements.join('\n'),
          actionItems: result.actionItems.map(a => a.task).join('\n'),
          duration: result.metrics.duration,
        },
      };
    } catch (error) {
      this.log(`Retrospective error: ${error}`, 'error');
      
      // Fallback
      console.log('\n⚠️  Automated retro failed. Manual retrospective.\n');
      
      const { wentWell } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'wentWell',
          message: 'What went well?',
        },
      ]);

      const { improvements } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'improvements',
          message: 'What could be improved?',
        },
      ]);

      const { actionItems } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'actionItems',
          message: 'Action items:',
        },
      ]);

      return {
        success: true,
        output: 'Retrospective completed (manual fallback)',
        artifacts: { wentWell, improvements, actionItems },
      };
    }
  }
}
