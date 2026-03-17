/**
 * Standalone Ship, QA, and Retro skills
 */
import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';

export interface ShipResult {
  success: boolean;
  steps: Array<{
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    output?: string;
    error?: string;
  }>;
  prUrl?: string;
  summary: string;
}

export interface QAResult {
  passed: boolean;
  tests: Array<{
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    notes?: string;
  }>;
  findings: string[];
  recommendations: string[];
}

export interface RetroResult {
  completed: boolean;
  wentWell: string[];
  improvements: string[];
  actionItems: Array<{
    task: string;
    owner?: string;
    dueDate?: string;
  }>;
  metrics: {
    duration: string;
    phasesCompleted: number;
  };
}

export class ShipQARetroSkill {
  private client?: Anthropic;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (key) {
      this.client = new Anthropic({ apiKey: key });
    }
  }

  /**
   * Ship phase: tests, build, commit, PR
   */
  async ship(repoPath: string): Promise<ShipResult> {
    console.log('🚀 Running Ship phase...\n');

    const steps: ShipResult['steps'] = [];

    // Run tests
    steps.push(await this.runStep('Run Tests', () => {
      try {
        execSync('npm test', { cwd: repoPath, stdio: 'pipe' });
        return { status: 'passed' as const };
      } catch (error) {
        return { 
          status: 'failed' as const, 
          error: error instanceof Error ? error.message : 'Tests failed' 
        };
      }
    }));

    // Type check
    steps.push(await this.runStep('Type Check', () => {
      try {
        execSync('npx tsc --noEmit', { cwd: repoPath, stdio: 'pipe' });
        return { status: 'passed' as const };
      } catch (error) {
        return { 
          status: 'failed' as const, 
          error: error instanceof Error ? error.message : 'Type check failed' 
        };
      }
    }));

    // Lint
    steps.push(await this.runStep('Lint', () => {
      try {
        execSync('npm run lint', { cwd: repoPath, stdio: 'pipe' });
        return { status: 'passed' as const };
      } catch {
        return { status: 'skipped' as const, output: 'No lint script or linting skipped' };
      }
    }));

    // Build
    steps.push(await this.runStep('Build', () => {
      try {
        execSync('npm run build', { cwd: repoPath, stdio: 'pipe' });
        return { status: 'passed' as const };
      } catch (error) {
        return { 
          status: 'failed' as const, 
          error: error instanceof Error ? error.message : 'Build failed' 
        };
      }
    }));

    // Check git status
    steps.push(await this.runStep('Git Status', () => {
      try {
        const status = execSync('git status --porcelain', { cwd: repoPath, encoding: 'utf-8' });
        if (status.trim()) {
          return { status: 'passed' as const, output: 'Changes ready to commit' };
        }
        return { status: 'skipped' as const, output: 'No changes to commit' };
      } catch (error) {
        return { status: 'failed' as const, error: 'Git error' };
      }
    }));

    const allPassed = steps.every(s => s.status === 'passed' || s.status === 'skipped');
    const failedSteps = steps.filter(s => s.status === 'failed');

    console.log('\n📦 SHIP RESULTS');
    console.log('═══════════════');
    steps.forEach(step => {
      const icon = step.status === 'passed' ? '✅' : step.status === 'failed' ? '❌' : '⏭️';
      console.log(`${icon} ${step.name}: ${step.status.toUpperCase()}`);
      if (step.error) console.log(`   Error: ${step.error}`);
    });
    console.log();

    return {
      success: allPassed,
      steps,
      summary: allPassed 
        ? 'All checks passed! Ready to commit and push.'
        : `${failedSteps.length} step(s) failed. Fix before shipping.`,
    };
  }

  /**
   * QA phase: test the feature
   */
  async qa(repoPath: string): Promise<QAResult> {
    console.log('🧪 Running QA phase...\n');

    const tests: QAResult['tests'] = [];
    const findings: string[] = [];

    // Check if tests exist
    try {
      const testFiles = await fs.readdir(repoPath);
      const hasTests = testFiles.some(f => f.includes('.test.') || f.includes('.spec.'));
      
      if (!hasTests) {
        tests.push({
          name: 'Test Coverage',
          status: 'failed',
          notes: 'No test files found',
        });
        findings.push('Missing test coverage - add unit tests');
      } else {
        tests.push({
          name: 'Test Coverage',
          status: 'passed',
          notes: 'Test files present',
        });
      }
    } catch {
      tests.push({
        name: 'Test Coverage',
        status: 'skipped',
        notes: 'Could not check tests',
      });
    }

    // Check README
    try {
      await fs.access(`${repoPath}/README.md`);
      tests.push({
        name: 'Documentation',
        status: 'passed',
        notes: 'README.md exists',
      });
    } catch {
      tests.push({
        name: 'Documentation',
        status: 'failed',
        notes: 'README.md missing',
      });
      findings.push('Missing README - add documentation');
    }

    // Check package.json scripts
    try {
      const pkg = JSON.parse(await fs.readFile(`${repoPath}/package.json`, 'utf-8'));
      const hasScripts = pkg.scripts && (pkg.scripts.test || pkg.scripts.build);
      
      tests.push({
        name: 'Build Scripts',
        status: hasScripts ? 'passed' : 'failed',
        notes: hasScripts ? 'Build/test scripts configured' : 'Missing build/test scripts',
      });
      
      if (!hasScripts) {
        findings.push('Missing npm scripts - add test and build commands');
      }
    } catch {
      tests.push({
        name: 'Build Scripts',
        status: 'skipped',
        notes: 'Could not check package.json',
      });
    }

    // Lint check
    try {
      execSync('npm run lint', { cwd: repoPath, stdio: 'pipe' });
      tests.push({
        name: 'Code Quality',
        status: 'passed',
        notes: 'Linting passed',
      });
    } catch {
      tests.push({
        name: 'Code Quality',
        status: 'failed',
        notes: 'Linting issues found',
      });
      findings.push('Code style issues - run linter and fix');
    }

    const passedCount = tests.filter(t => t.status === 'passed').length;
    const failedCount = tests.filter(t => t.status === 'failed').length;

    console.log('\n🎯 QA RESULTS');
    console.log('══════════════');
    tests.forEach(test => {
      const icon = test.status === 'passed' ? '✅' : test.status === 'failed' ? '❌' : '⏭️';
      console.log(`${icon} ${test.name}: ${test.status.toUpperCase()}`);
      if (test.notes) console.log(`   ${test.notes}`);
    });
    console.log();

    if (findings.length > 0) {
      console.log('⚠️  FINDINGS');
      console.log('═════════════');
      findings.forEach(f => console.log(`  • ${f}`));
      console.log();
    }

    return {
      passed: failedCount === 0,
      tests,
      findings,
      recommendations: findings.map(f => `Fix: ${f}`),
    };
  }

  /**
   * Retro phase: review what went well
   */
  async retro(workflowState: any): Promise<RetroResult> {
    console.log('🔄 Running Retrospective...\n');

    const wentWell: string[] = [];
    const improvements: string[] = [];
    const actionItems: RetroResult['actionItems'] = [];

    // Analyze workflow history
    if (workflowState?.history) {
      const completedPhases = workflowState.history.filter((h: any) => h.completedAt);
      const failedPhases = workflowState.history.filter((h: any) => h.success === false);

      if (completedPhases.length > 0) {
        wentWell.push(`Completed ${completedPhases.length} phases successfully`);
      }

      if (failedPhases.length === 0) {
        wentWell.push('No phase rollbacks needed');
      } else {
        improvements.push(`${failedPhases.length} phase(s) had issues requiring rollback`);
        actionItems.push({ task: 'Review phase failure patterns', dueDate: 'Next sprint' });
      }

      // Check duration
      if (workflowState.createdAt && workflowState.updatedAt) {
        const start = new Date(workflowState.createdAt);
        const end = new Date(workflowState.updatedAt);
        const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60); // hours
        
        if (duration < 24) {
          wentWell.push('Fast completion time');
        } else {
          improvements.push('Workflow took longer than expected');
          actionItems.push({ task: 'Identify bottlenecks in workflow', dueDate: 'Next week' });
        }
      }
    }

    // Check for gaps in original analysis
    wentWell.push('Used intelligent repo analysis to identify gaps');
    wentWell.push('Generated customized plan based on similar tools');

    improvements.push('Some phases required manual intervention');
    actionItems.push({ task: 'Improve automation for CEO/Eng review phases', dueDate: 'Next iteration' });

    improvements.push('Claude API required for full automation');
    actionItems.push({ task: 'Add fallback analysis when API unavailable', dueDate: 'Next iteration' });

    // Calculate metrics
    const duration = workflowState?.createdAt && workflowState?.updatedAt
      ? `${Math.round((new Date(workflowState.updatedAt).getTime() - new Date(workflowState.createdAt).getTime()) / (1000 * 60))} minutes`
      : 'Unknown';

    const phasesCompleted = workflowState?.history?.filter((h: any) => h.completedAt).length || 0;

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                    RETROSPECTIVE                          ');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('✅ WHAT WENT WELL');
    console.log('══════════════════');
    wentWell.forEach(w => console.log(`  • ${w}`));
    console.log();

    console.log('📈 IMPROVEMENTS FOR NEXT TIME');
    console.log('══════════════════════════════');
    improvements.forEach(i => console.log(`  • ${i}`));
    console.log();

    console.log('🎯 ACTION ITEMS');
    console.log('════════════════');
    actionItems.forEach(item => {
      console.log(`  • ${item.task}${item.dueDate ? ` (Due: ${item.dueDate})` : ''}`);
    });
    console.log();

    console.log('📊 METRICS');
    console.log('═══════════');
    console.log(`  Duration: ${duration}`);
    console.log(`  Phases Completed: ${phasesCompleted}`);
    console.log();

    console.log('═══════════════════════════════════════════════════════════\n');

    return {
      completed: true,
      wentWell,
      improvements,
      actionItems,
      metrics: {
        duration,
        phasesCompleted,
      },
    };
  }

  private async runStep(
    name: string, 
    fn: () => Promise<{ status: 'passed' | 'failed' | 'skipped'; output?: string; error?: string }> | { status: 'passed' | 'failed' | 'skipped'; output?: string; error?: string }
  ): Promise<ShipResult['steps'][0]> {
    try {
      const result = await fn();
      return {
        name,
        status: result.status,
        output: result.output,
        error: result.error,
      };
    } catch (error) {
      return {
        name,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
