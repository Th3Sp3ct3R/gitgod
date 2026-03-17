/**
 * Core workflow orchestrator
 */
import {
  WorkflowState,
  Phase,
  PhaseConfig,
  PhaseResult,
  PHASES,
  EnvironmentAdapter,
} from './types';
import { StateManager } from './state';

export class WorkflowOrchestrator {
  private stateManager: StateManager;
  private adapter: EnvironmentAdapter;

  constructor(adapter: EnvironmentAdapter, cwd?: string) {
    this.adapter = adapter;
    this.stateManager = new StateManager(cwd);
  }

  /**
   * Start a new workflow
   */
  async start(planPath: string, branchName?: string): Promise<void> {
    const hasActive = await this.stateManager.hasActiveWorkflow();
    if (hasActive) {
      const shouldContinue = await this.adapter.askUser(
        'A workflow is already active. Start a new one?',
        ['Yes, start new workflow', 'No, resume existing', 'Cancel']
      );

      if (shouldContinue === 'C') {
        this.adapter.log('Cancelled', 'info');
        return;
      }

      if (shouldContinue === 'B') {
        await this.resume();
        return;
      }

      // Clear existing workflow
      await this.stateManager.clear();
    }

    // Create new workflow
    const state = await this.stateManager.createWorkflow(
      planPath,
      this.adapter.name,
      branchName
    );

    this.adapter.log(`Workflow started for: ${planPath}`, 'success');
    
    // Auto-advance to first phase
    await this.advance(state);
  }

  /**
   * Resume the current workflow
   */
  async resume(): Promise<void> {
    const state = await this.stateManager.load();
    
    if (state.currentPhase === 'idle') {
      this.adapter.log('No active workflow. Run: workflow start <plan>', 'warn');
      return;
    }

    if (state.currentPhase === 'complete') {
      this.adapter.log('Workflow already complete. Start a new one?', 'info');
      return;
    }

    if (state.currentPhase === 'paused') {
      this.adapter.log(`Resuming from paused state: ${state.pausedReason}`, 'info');
      // Determine where to resume based on context
      const targetPhase = this.determineResumePhase(state);
      const resumedState = await this.stateManager.resume(state, targetPhase);
      await this.advance(resumedState);
      return;
    }

    this.adapter.log(`Resuming workflow at phase: ${state.currentPhase}`, 'info');
    await this.advance(state);
  }

  /**
   * Continue to next phase after approval
   */
  async continue(approved: boolean = true): Promise<void> {
    const state = await this.stateManager.load();
    const phaseConfig = PHASES[state.currentPhase];

    if (!phaseConfig.requiresApproval) {
      this.adapter.log('Current phase does not require approval', 'warn');
      await this.advance(state);
      return;
    }

    if (!approved) {
      // Rollback to previous phase
      if (phaseConfig.rollbackPhase) {
        this.adapter.log(`Rolling back to: ${phaseConfig.rollbackPhase}`, 'warn');
        const rolledBack = await this.stateManager.transition(
          state,
          phaseConfig.rollbackPhase,
          ['Rolled back due to rejection']
        );
        await this.advance(rolledBack);
      } else {
        this.adapter.log('Cannot rollback - no rollback phase defined', 'error');
      }
      return;
    }

    // Advance to next phase
    if (phaseConfig.nextPhase) {
      const advanced = await this.stateManager.transition(state, phaseConfig.nextPhase);
      await this.advance(advanced);
    } else {
      this.adapter.log('Workflow complete!', 'success');
    }
  }

  /**
   * Get current status
   */
  async status(): Promise<void> {
    const state = await this.stateManager.load();
    const stats = await this.stateManager.getStats(state);

    console.log('\n📊 WORKFLOW STATUS');
    console.log('==================');
    console.log(`Phase: ${state.currentPhase}`);
    console.log(`Environment: ${state.environment}`);
    console.log(`Plan: ${state.context.planPath}`);
    
    if (state.context.branchName) {
      console.log(`Branch: ${state.context.branchName}`);
    }
    
    if (state.pausedReason) {
      console.log(`Paused: ${state.pausedReason}`);
    }

    console.log(`\nDuration: ${this.formatDuration(stats.duration)}`);
    console.log(`Phases completed: ${stats.phasesCompleted}`);
    
    if (state.history.length > 0) {
      console.log('\nPhase History:');
      state.history.forEach((entry) => {
        const status = entry.completedAt 
          ? (entry.success ? '✓' : '✗') 
          : '▶';
        console.log(`  ${status} ${entry.phase}`);
      });
    }

    console.log('');
  }

  /**
   * Pause the workflow
   */
  async pause(reason: string): Promise<void> {
    const state = await this.stateManager.load();
    await this.stateManager.pause(state, reason);
    this.adapter.log(`Workflow paused: ${reason}`, 'warn');
  }

  /**
   * Main execution loop for a phase
   */
  private async advance(state: WorkflowState): Promise<void> {
    const phaseConfig = PHASES[state.currentPhase];
    
    this.adapter.log(`
========================================
  ENTERING PHASE: ${phaseConfig.name}
========================================\n`);

    // Execute the phase
    const result = await this.executePhase(state.currentPhase, state);

    if (!result.success) {
      this.adapter.log(`Phase failed: ${result.error}`, 'error');
      
      // Ask if user wants to retry, rollback, or pause
      const choice = await this.adapter.askUser(
        'Phase failed. What would you like to do?',
        ['Retry phase', 'Rollback', 'Pause workflow', 'Abort']
      );

      switch (choice) {
        case 'A':
          await this.advance(state); // Retry
          return;
        case 'B':
          if (phaseConfig.rollbackPhase) {
            const rolledBack = await this.stateManager.transition(
              state,
              phaseConfig.rollbackPhase,
              ['Rolled back due to failure']
            );
            await this.advance(rolledBack);
          }
          return;
        case 'C':
          await this.stateManager.pause(state, result.error || 'User requested pause');
          return;
        case 'D':
          await this.stateManager.clear();
          this.adapter.log('Workflow aborted', 'error');
          return;
      }
    }

    // Handle pause request from phase
    if (result.shouldPause) {
      await this.stateManager.pause(state, result.pauseReason || 'Phase requested pause');
      this.adapter.log(`Phase paused: ${result.pauseReason}`, 'warn');
      return;
    }

    // Save any artifacts to context
    if (result.artifacts) {
      await this.stateManager.updateContext(state, result.artifacts);
    }

    // If phase requires approval, wait for it
    if (phaseConfig.requiresApproval) {
      const prompt = phaseConfig.approvalPrompt || `Approve ${phaseConfig.name}?`;
      const approved = await this.adapter.askUser(
        prompt,
        ['Yes, continue', 'No, rollback', 'Pause']
      );

      if (approved === 'B') {
        // Rollback
        if (phaseConfig.rollbackPhase) {
          const rolledBack = await this.stateManager.transition(
            state,
            phaseConfig.rollbackPhase,
            ['Rolled back by user']
          );
          await this.advance(rolledBack);
        }
        return;
      }

      if (approved === 'C') {
        await this.stateManager.pause(state, 'User requested pause');
        return;
      }

      // Approved - continue
      await this.continue(true);
      return;
    }

    // Auto-advance to next phase
    if (phaseConfig.nextPhase) {
      const advanced = await this.stateManager.transition(state, phaseConfig.nextPhase);
      await this.advance(advanced);
    } else {
      this.adapter.log('\n✨ WORKFLOW COMPLETE! ✨\n', 'success');
    }
  }

  /**
   * Execute a specific phase
   */
  private async executePhase(phase: Phase, state: WorkflowState): Promise<PhaseResult> {
    // Build args from context
    const args: Record<string, unknown> = {
      ...state.context,
    };

    return await this.adapter.runSkill(phase, args);
  }

  /**
   * Determine which phase to resume to after pause
   */
  private determineResumePhase(state: WorkflowState): Phase {
    // Default: resume current phase
    if (state.currentPhase !== 'paused') {
      return state.currentPhase;
    }

    // If we know what phase we were in before pausing, resume that
    if (state.previousPhase && state.previousPhase !== 'paused') {
      return state.previousPhase;
    }

    // Check history to find the last non-paused phase
    const lastRealPhase = [...state.history]
      .reverse()
      .find(h => h.phase !== 'paused');
    
    return lastRealPhase?.phase || 'idle';
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}
