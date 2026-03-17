/**
 * State persistence and management
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  WorkflowState,
  WorkflowContext,
  Phase,
  STATE_FILE,
  STATE_VERSION,
  PhaseHistoryEntry,
  Environment,
} from './types';

export class StateManager {
  private statePath: string;

  constructor(cwd: string = process.cwd()) {
    this.statePath = path.join(cwd, STATE_FILE);
  }

  /**
   * Check if a workflow is currently active
   */
  async hasActiveWorkflow(): Promise<boolean> {
    try {
      const state = await this.load();
      return state.currentPhase !== 'idle' && state.currentPhase !== 'complete';
    } catch {
      return false;
    }
  }

  /**
   * Load the current workflow state
   */
  async load(): Promise<WorkflowState> {
    try {
      const content = await fs.readFile(this.statePath, 'utf-8');
      const state = JSON.parse(content) as WorkflowState;
      
      // Version migration if needed
      if (state.version !== STATE_VERSION) {
        return this.migrateState(state);
      }
      
      return state;
    } catch (error) {
      // Return default state if file doesn't exist
      return this.createDefaultState();
    }
  }

  /**
   * Save the workflow state
   */
  async save(state: WorkflowState): Promise<void> {
    state.updatedAt = new Date().toISOString();
    
    // Ensure directory exists
    const dir = path.dirname(this.statePath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(
      this.statePath,
      JSON.stringify(state, null, 2),
      'utf-8'
    );
  }

  /**
   * Create a new workflow with initial state
   */
  async createWorkflow(
    planPath: string,
    environment: Environment,
    branchName?: string
  ): Promise<WorkflowState> {
    const state: WorkflowState = {
      version: STATE_VERSION,
      currentPhase: 'idle',
      context: {
        planPath,
        branchName,
      },
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      environment,
    };

    await this.save(state);
    return state;
  }

  /**
   * Transition to a new phase
   */
  async transition(
    state: WorkflowState,
    newPhase: Phase,
    notes?: string[],
    error?: string
  ): Promise<WorkflowState> {
    // Complete current phase in history
    const currentEntry = state.history.find(
      (h) => h.phase === state.currentPhase && !h.completedAt
    );
    
    if (currentEntry) {
      currentEntry.completedAt = new Date().toISOString();
      currentEntry.success = !error;
      currentEntry.error = error;
      currentEntry.notes = notes;
    }

    // Add new phase entry
    state.history.push({
      phase: newPhase,
      startedAt: new Date().toISOString(),
      notes,
    });

    state.previousPhase = state.currentPhase;
    state.currentPhase = newPhase;

    await this.save(state);
    return state;
  }

  /**
   * Update context with new data
   */
  async updateContext(
    state: WorkflowState,
    contextUpdate: Partial<WorkflowContext>
  ): Promise<WorkflowState> {
    state.context = { ...state.context, ...contextUpdate };
    await this.save(state);
    return state;
  }

  /**
   * Pause the workflow
   */
  async pause(state: WorkflowState, reason: string): Promise<WorkflowState> {
    state.pausedReason = reason;
    return this.transition(state, 'paused', [reason]);
  }

  /**
   * Resume from paused state
   */
  async resume(state: WorkflowState, targetPhase: Phase): Promise<WorkflowState> {
    delete state.pausedReason;
    return this.transition(state, targetPhase, ['Resumed from pause']);
  }

  /**
   * Clear all workflow state
   */
  async clear(): Promise<void> {
    try {
      await fs.unlink(this.statePath);
    } catch {
      // File may not exist, that's fine
    }
  }

  /**
   * Get workflow statistics
   */
  async getStats(state: WorkflowState): Promise<{
    duration: number;
    phasesCompleted: number;
    currentPhaseDuration: number;
  }> {
    const now = new Date();
    const startTime = new Date(state.createdAt);
    const duration = now.getTime() - startTime.getTime();

    const phasesCompleted = state.history.filter((h) => h.completedAt).length;

    const currentEntry = state.history.find(
      (h) => h.phase === state.currentPhase && !h.completedAt
    );
    const currentPhaseDuration = currentEntry
      ? now.getTime() - new Date(currentEntry.startedAt).getTime()
      : 0;

    return {
      duration,
      phasesCompleted,
      currentPhaseDuration,
    };
  }

  private createDefaultState(): WorkflowState {
    return {
      version: STATE_VERSION,
      currentPhase: 'idle',
      context: { planPath: '' },
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      environment: 'unknown',
    };
  }

  private migrateState(oldState: WorkflowState): WorkflowState {
    // Simple migration: just update version
    return {
      ...oldState,
      version: STATE_VERSION,
    };
  }
}
