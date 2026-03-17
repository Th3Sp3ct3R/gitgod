/**
 * Core types for the workflow orchestrator
 */

export type Phase =
  | 'idle'
  | 'ceo_review'
  | 'ceo_approved'
  | 'eng_review'
  | 'eng_approved'
  | 'implementing'
  | 'review'
  | 'ship'
  | 'qa'
  | 'retro'
  | 'complete'
  | 'paused';

export type Environment = 'claude' | 'opencode' | 'standalone' | 'unknown';

export interface WorkflowContext {
  planPath: string;
  approvedPlanPath?: string;
  branchName?: string;
  prNumber?: number;
  ceoFeedback?: string[];
  engDecisions?: string[];
  implementationNotes?: string[];
  reviewFindings?: string[];
  qaResults?: string[];
  retroNotes?: string[];
  [key: string]: unknown;
}

export interface PhaseHistoryEntry {
  phase: Phase;
  startedAt: string;
  completedAt?: string;
  success?: boolean;
  error?: string;
  notes?: string[];
}

export interface WorkflowState {
  version: string;
  currentPhase: Phase;
  previousPhase?: Phase;
  context: WorkflowContext;
  history: PhaseHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  environment: Environment;
  pausedReason?: string;
}

export interface PhaseConfig {
  name: string;
  description: string;
  requiresApproval: boolean;
  approvalPrompt?: string;
  nextPhase: Phase | null;
  rollbackPhase?: Phase;
  timeoutMinutes?: number;
}

export interface PhaseResult {
  success: boolean;
  output?: string;
  error?: string;
  artifacts?: Record<string, string>;
  shouldPause?: boolean;
  pauseReason?: string;
}

export interface EnvironmentAdapter {
  name: Environment;
  detect(): Promise<boolean>;
  runSkill(skillName: string, args: Record<string, unknown>): Promise<PhaseResult>;
  askUser(question: string, options?: string[]): Promise<string>;
  log(message: string, level?: 'info' | 'warn' | 'error' | 'success'): void;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exec(command: string): Promise<{ stdout: string; stderr: string; code: number }>;
}

export const PHASES: Record<Phase, PhaseConfig> = {
  idle: {
    name: 'Idle',
    description: 'Waiting to start workflow',
    requiresApproval: false,
    nextPhase: 'ceo_review',
  },
  ceo_review: {
    name: 'CEO Review',
    description: 'Strategic review: scope expansion, 10x thinking, dream state',
    requiresApproval: true,
    approvalPrompt: 'CEO review complete. Approve plan and continue to engineering review?',
    nextPhase: 'eng_review',
    rollbackPhase: 'idle',
  },
  ceo_approved: {
    name: 'CEO Approved',
    description: 'Transition state waiting for engineering review',
    requiresApproval: false,
    nextPhase: 'eng_review',
  },
  eng_review: {
    name: 'Engineering Review',
    description: 'Architecture, error mapping, security, performance review',
    requiresApproval: true,
    approvalPrompt: 'Engineering review complete. Ready to implement?',
    nextPhase: 'implementing',
    rollbackPhase: 'ceo_approved',
  },
  eng_approved: {
    name: 'Engineering Approved',
    description: 'Transition state waiting for implementation',
    requiresApproval: false,
    nextPhase: 'implementing',
  },
  implementing: {
    name: 'Implementation',
    description: 'Writing code based on approved plan',
    requiresApproval: false,
    nextPhase: 'review',
    rollbackPhase: 'eng_approved',
  },
  review: {
    name: 'Code Review',
    description: 'Review implementation for bugs and quality',
    requiresApproval: true,
    approvalPrompt: 'Code review passed. Ship it?',
    nextPhase: 'ship',
    rollbackPhase: 'implementing',
  },
  ship: {
    name: 'Ship',
    description: 'Run tests, merge to main, create PR',
    requiresApproval: false,
    nextPhase: 'qa',
  },
  qa: {
    name: 'QA',
    description: 'Test the shipped feature',
    requiresApproval: false,
    nextPhase: 'retro',
  },
  retro: {
    name: 'Retrospective',
    description: 'Review what went well and what to improve',
    requiresApproval: false,
    nextPhase: 'complete',
  },
  complete: {
    name: 'Complete',
    description: 'Workflow finished successfully',
    requiresApproval: false,
    nextPhase: null,
  },
  paused: {
    name: 'Paused',
    description: 'Workflow paused for manual intervention',
    requiresApproval: false,
    nextPhase: null,
  },
};

export const STATE_FILE = '.gitgodreview/state.json';
export const STATE_VERSION = '1.0.0';
