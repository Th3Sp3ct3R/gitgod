/**
 * Base adapter with shared functionality
 */
import * as fs from 'fs/promises';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { EnvironmentAdapter, PhaseResult, Environment } from '../types';

export abstract class BaseAdapter implements EnvironmentAdapter {
  abstract name: Environment;

  abstract detect(): Promise<boolean>;
  abstract runSkill(skillName: string, args: Record<string, unknown>): Promise<PhaseResult>;
  abstract askUser(question: string, options?: string[]): Promise<string>;

  log(message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info'): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${this.name.toUpperCase()}]`;
    
    const colors: Record<string, string> = {
      info: '\x1b[36m',    // cyan
      warn: '\x1b[33m',    // yellow
      error: '\x1b[31m',   // red
      success: '\x1b[32m', // green
      reset: '\x1b[0m',
    };

    const color = colors[level] || colors.info;
    console.log(`${color}${prefix} ${timestamp} - ${message}${colors.reset}`);
  }

  async readFile(path: string): Promise<string> {
    return fs.readFile(path, 'utf-8');
  }

  async writeFile(path: string, content: string): Promise<void> {
    await fs.writeFile(path, content, 'utf-8');
  }

  async exec(command: string): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ stdout, stderr, code: code || 0 });
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  protected async checkCommandExists(command: string): Promise<boolean> {
    try {
      const { code } = await this.exec(`which ${command}`);
      return code === 0;
    } catch {
      return false;
    }
  }
}
