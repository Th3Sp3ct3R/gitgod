/**
 * Adapter exports and factory
 */
export { BaseAdapter } from './base';
export { ClaudeAdapter } from './claude';
export { OpenCodeAdapter } from './opencode';
export { StandaloneAdapter } from './standalone';

import { ClaudeAdapter } from './claude';
import { OpenCodeAdapter } from './opencode';
import { StandaloneAdapter } from './standalone';
import { EnvironmentAdapter, Environment } from '../types';

/**
 * Detect the current environment and return appropriate adapter
 */
export async function detectEnvironment(): Promise<EnvironmentAdapter> {
  // Allow manual override via environment variable
  const forcedEnv = process.env.WORKFLOW_ENV;
  if (forcedEnv) {
    const adapter = getAdapter(forcedEnv as Environment);
    adapter.log(`Using forced environment: ${forcedEnv}`);
    return adapter;
  }

  const adapters = [
    new ClaudeAdapter(),
    new OpenCodeAdapter(),
    new StandaloneAdapter(),
  ];

  for (const adapter of adapters) {
    if (await adapter.detect()) {
      adapter.log(`Detected ${adapter.name} environment`);
      return adapter;
    }
  }

  // Fallback to standalone
  const fallback = new StandaloneAdapter();
  fallback.log('No specific environment detected, using standalone mode');
  return fallback;
}

/**
 * Get adapter by name
 */
export function getAdapter(name: Environment): EnvironmentAdapter {
  switch (name) {
    case 'claude':
      return new ClaudeAdapter();
    case 'opencode':
      return new OpenCodeAdapter();
    case 'standalone':
      return new StandaloneAdapter();
    default:
      return new StandaloneAdapter();
  }
}
