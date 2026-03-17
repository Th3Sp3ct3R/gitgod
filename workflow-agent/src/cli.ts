#!/usr/bin/env node
/**
 * CLI entry point for workflow-agent
 */
import { Command } from 'commander';
import { detectEnvironment } from './adapters';
import { WorkflowOrchestrator } from './orchestrator';
import { StateManager } from './state';
import { CodebaseAnalyzer } from './analyzer';
import { PlanGenerator } from './analyzer/llm';
import { PatternExtractor } from './patterns';
import { IntelligentRepoAnalyzer } from './patterns';
import { InteractivePlanGenerator } from './patterns';
import * as fs from 'fs/promises';
import * as path from 'path';

const program = new Command();

program
  .name('workflow')
  .description('Portable workflow orchestrator: CEO Review → Eng Review → Implement → Review → Ship → QA → Retro')
  .version('1.0.0');

program
  .command('start')
  .description('Start a new workflow')
  .argument('<plan>', 'Path to the plan document (PLAN.md, RFC.md, etc.)')
  .option('-b, --branch <name>', 'Git branch name (auto-generated if not provided)')
  .action(async (plan: string, options: { branch?: string }) => {
    try {
      const adapter = await detectEnvironment();
      const orchestrator = new WorkflowOrchestrator(adapter);
      
      // Auto-generate branch name if not provided
      const branchName = options.branch || `feat/${Date.now()}`;
      
      await orchestrator.start(plan, branchName);
    } catch (error) {
      console.error('Error starting workflow:', error);
      process.exit(1);
    }
  });

program
  .command('resume')
  .description('Resume the current workflow')
  .action(async () => {
    try {
      const adapter = await detectEnvironment();
      const orchestrator = new WorkflowOrchestrator(adapter);
      await orchestrator.resume();
    } catch (error) {
      console.error('Error resuming workflow:', error);
      process.exit(1);
    }
  });

program
  .command('continue')
  .alias('c')
  .description('Continue to next phase after approval')
  .option('--reject', 'Reject current phase and rollback')
  .action(async (options: { reject?: boolean }) => {
    try {
      const adapter = await detectEnvironment();
      const orchestrator = new WorkflowOrchestrator(adapter);
      await orchestrator.continue(!options.reject);
    } catch (error) {
      console.error('Error continuing workflow:', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show current workflow status')
  .action(async () => {
    try {
      const adapter = await detectEnvironment();
      const orchestrator = new WorkflowOrchestrator(adapter);
      await orchestrator.status();
    } catch (error) {
      console.error('Error getting status:', error);
      process.exit(1);
    }
  });

program
  .command('pause')
  .description('Pause the current workflow')
  .argument('<reason>', 'Reason for pausing')
  .action(async (reason: string) => {
    try {
      const adapter = await detectEnvironment();
      const orchestrator = new WorkflowOrchestrator(adapter);
      await orchestrator.pause(reason);
    } catch (error) {
      console.error('Error pausing workflow:', error);
      process.exit(1);
    }
  });

program
  .command('reset')
  .description('Clear all workflow state (destructive)')
  .action(async () => {
    try {
      const stateManager = new StateManager();
      await stateManager.clear();
      console.log('✓ Workflow state cleared');
    } catch (error) {
      console.error('Error clearing state:', error);
      process.exit(1);
    }
  });

program
  .command('run')
  .description('Run a specific phase directly')
  .argument('<phase>', 'Phase to run (ceo_review, eng_review, implementing, review, ship, qa, retro)')
  .action(async (phase: string) => {
    try {
      const adapter = await detectEnvironment();
      const result = await adapter.runSkill(phase, {});
      
      if (result.success) {
        console.log('✓ Phase completed successfully');
        if (result.output) console.log(result.output);
      } else {
        console.error('✗ Phase failed:', result.error);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error running phase:', error);
      process.exit(1);
    }
  });

program
  .command('suggest')
  .description('Analyze codebase and suggest next feature to build')
  .option('-k, --api-key <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY env var)')
  .action(async (options: { apiKey?: string }) => {
    try {
      // Analyze codebase
      const analyzer = new CodebaseAnalyzer();
      const context = await analyzer.analyze();
      analyzer.printAnalysis(context);

      // Generate plan with LLM
      const generator = new PlanGenerator(options.apiKey);
      const plan = await generator.generatePlan(context);

      console.log('\n🎯 SUGGESTED FEATURE\n');
      console.log('==================\n');
      console.log(plan.markdown);

      // Ask if user wants to save it
      const adapter = await detectEnvironment();
      const saveChoice = await adapter.askUser(
        'Save this plan and start workflow?',
        ['Yes, save and start', 'Yes, save only', 'No, discard']
      );

      if (saveChoice === 'A' || saveChoice === 'B') {
        const planPath = `docs/${plan.title.toLowerCase().replace(/\s+/g, '-')}.md`;
        await fs.mkdir(path.dirname(planPath), { recursive: true });
        await fs.writeFile(planPath, plan.markdown, 'utf-8');
        console.log(`\n✓ Plan saved to ${planPath}`);

        if (saveChoice === 'A') {
          const orchestrator = new WorkflowOrchestrator(adapter);
          await orchestrator.start(planPath);
        }
      }
    } catch (error) {
      console.error('Error suggesting feature:', error);
      process.exit(1);
    }
  });

program
  .command('plan')
  .description('Generate plan from codebase analysis (alias for suggest)')
  .option('-k, --api-key <key>', 'Anthropic API key')
  .option('-o, --output <path>', 'Output path for plan', 'docs/NEXT_FEATURE.md')
  .action(async (options: { apiKey?: string; output: string }) => {
    try {
      const analyzer = new CodebaseAnalyzer();
      const context = await analyzer.analyze();
      analyzer.printAnalysis(context);

      const generator = new PlanGenerator(options.apiKey);
      const plan = await generator.generatePlan(context);

      await fs.mkdir(path.dirname(options.output), { recursive: true });
      await fs.writeFile(options.output, plan.markdown, 'utf-8');

      console.log(`\n✓ Plan generated and saved to ${options.output}`);
      console.log('\nNext steps:');
      console.log(`  workflow start ${options.output}`);
    } catch (error) {
      console.error('Error generating plan:', error);
      process.exit(1);
    }
  });

program
  .command('patterns')
  .description('Show patterns from GitGod synthesis data')
  .action(async () => {
    try {
      const extractor = new PatternExtractor();
      await extractor.printSummary();
    } catch (error) {
      console.error('Error loading patterns:', error);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Intelligently analyze repository using GitGod patterns')
  .argument('[path]', 'Repository path', '.')
  .option('-o, --output <path>', 'Output plan to file')
  .action(async (repoPath: string, options: { output?: string }) => {
    try {
      console.log('🚀 Starting intelligent repo analysis...\n');
      
      const generator = new InteractivePlanGenerator();
      const plan = await generator.generateInteractivePlan(repoPath);
      
      generator.printPlan(plan);

      if (options.output) {
        await fs.mkdir(path.dirname(options.output), { recursive: true });
        await fs.writeFile(options.output, plan.markdown, 'utf-8');
        console.log(`\n✓ Plan saved to ${options.output}`);
      }

      // Ask to start workflow
      const adapter = await detectEnvironment();
      const startChoice = await adapter.askUser(
        'Start workflow with this plan?',
        ['Yes, start now', 'Save and start later', 'Just analyze']
      );

      if (startChoice === 'A') {
        const planPath = options.output || `docs/${plan.title.toLowerCase().replace(/\s+/g, '-')}.md`;
        if (!options.output) {
          await fs.mkdir(path.dirname(planPath), { recursive: true });
          await fs.writeFile(planPath, plan.markdown, 'utf-8');
        }
        
        const orchestrator = new WorkflowOrchestrator(adapter);
        await orchestrator.start(planPath);
      }
    } catch (error) {
      console.error('Error analyzing repository:', error);
      process.exit(1);
    }
  });

// Parse CLI arguments
program.parse();
