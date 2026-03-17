/**
 * Codebase analyzer - scans for context to generate plans
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import * as glob from 'glob';

export interface CodebaseContext {
  // Existing plans
  existingPlans: Array<{
    path: string;
    title: string;
    summary: string;
    lastModified: Date;
  }>;

  // TODOs and FIXMEs found in code
  todos: Array<{
    file: string;
    line: number;
    text: string;
    type: 'TODO' | 'FIXME' | 'HACK' | 'XXX';
  }>;

  // Recent commit history
  recentCommits: Array<{
    hash: string;
    message: string;
    date: Date;
    files: string[];
  }>;

  // Code structure
  codeStructure: {
    languages: Record<string, number>;
    mainEntryPoints: string[];
    keyModules: string[];
    testCoverage: number;
    hasCI: boolean;
    hasDocs: boolean;
  };

  // What's missing
  gaps: string[];

  // Overall summary
  summary: string;
}

export class CodebaseAnalyzer {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  /**
   * Analyze the entire codebase and return context
   */
  async analyze(): Promise<CodebaseContext> {
    console.log('🔍 Analyzing codebase...\n');

    const [
      existingPlans,
      todos,
      recentCommits,
      codeStructure,
    ] = await Promise.all([
      this.findExistingPlans(),
      this.findTodos(),
      this.getRecentCommits(),
      this.analyzeCodeStructure(),
    ]);

    const gaps = this.identifyGaps(codeStructure, existingPlans);
    const summary = this.generateSummary(codeStructure, existingPlans, gaps);

    return {
      existingPlans,
      todos,
      recentCommits,
      codeStructure,
      gaps,
      summary,
    };
  }

  /**
   * Find existing plan documents
   */
  private async findExistingPlans(): Promise<CodebaseContext['existingPlans']> {
    const planPatterns = [
      '**/PLAN.md',
      '**/RFC.md',
      '**/TODO.md',
      '**/TODOS.md',
      '**/ROADMAP.md',
      'docs/**/*.md',
      '.github/**/*.md',
    ];

    const plans: CodebaseContext['existingPlans'] = [];

    for (const pattern of planPatterns) {
      try {
        const files = glob.sync(pattern, { cwd: this.cwd, absolute: true });
        
        for (const file of files) {
          try {
            const content = await fs.readFile(file, 'utf-8');
            const lines = content.split('\n');
            const title = lines[0]?.replace(/^#+\s*/, '') || path.basename(file);
            const summary = lines.slice(1, 5).join(' ').substring(0, 200);
            const stats = await fs.stat(file);

            plans.push({
              path: path.relative(this.cwd, file),
              title,
              summary: summary + (summary.length >= 200 ? '...' : ''),
              lastModified: stats.mtime,
            });
          } catch {
            // Skip files we can't read
          }
        }
      } catch {
        // Pattern didn't match
      }
    }

    // Sort by most recent
    plans.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

    return plans;
  }

  /**
   * Find TODO/FIXME/HACK/XXX comments in code
   */
  private async findTodos(): Promise<CodebaseContext['todos']> {
    const todos: CodebaseContext['todos'] = [];
    
    try {
      const files = glob.sync('**/*.{ts,js,tsx,jsx,py,rb,go,rs,java}', {
        cwd: this.cwd,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**']
      });
      
      const todoRegex = /(TODO|FIXME|HACK|XXX)[\s:]*(.+?)(?:\n|$)/gi;

      for (const file of files.slice(0, 100)) { // Limit to first 100 files
        try {
          const content = await fs.readFile(file, 'utf-8');
          const lines = content.split('\n');

          lines.forEach((line, index) => {
            const match = todoRegex.exec(line);
            if (match) {
              todos.push({
                file: path.relative(this.cwd, file),
                line: index + 1,
                text: match[2].trim(),
                type: match[1].toUpperCase() as 'TODO' | 'FIXME' | 'HACK' | 'XXX',
              });
            }
            todoRegex.lastIndex = 0; // Reset regex
          });
        } catch {
          // Skip files we can't read
        }
      }
    } catch {
      // Ignore glob errors
    }

    return todos.slice(0, 20); // Return top 20
  }

  /**
   * Get recent git commits
   */
  private async getRecentCommits(): Promise<CodebaseContext['recentCommits']> {
    const { execSync } = require('child_process');
    
    try {
      // Get last 10 commits with file changes
      const logOutput = execSync(
        'git log --format="%H|%s|%ci" --name-only -10',
        { cwd: this.cwd, encoding: 'utf-8' }
      );

      const commits: CodebaseContext['recentCommits'] = [];
      const sections = logOutput.split('\n\n');

      for (const section of sections) {
        const lines = section.split('\n');
        const header = lines[0];
        
        if (!header?.includes('|')) continue;

        const [hash, message, dateStr] = header.split('|');
        const files = lines.slice(1).filter((l: string) => l.trim());

        commits.push({
          hash: hash.substring(0, 8),
          message,
          date: new Date(dateStr),
          files,
        });
      }

      return commits;
    } catch {
      return [];
    }
  }

  /**
   * Analyze code structure
   */
  private async analyzeCodeStructure(): Promise<CodebaseContext['codeStructure']> {
    const structure: CodebaseContext['codeStructure'] = {
      languages: {},
      mainEntryPoints: [],
      keyModules: [],
      testCoverage: 0,
      hasCI: false,
      hasDocs: false,
    };

    // Count files by extension
    const extensions: Record<string, string> = {
      '.ts': 'TypeScript',
      '.js': 'JavaScript',
      '.tsx': 'TypeScript React',
      '.jsx': 'JavaScript React',
      '.py': 'Python',
      '.go': 'Go',
      '.rs': 'Rust',
      '.rb': 'Ruby',
      '.java': 'Java',
    };

    try {
      const allFiles = glob.sync('**/*', { 
        cwd: this.cwd, 
        absolute: true,
        nodir: true,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**']
      });

      for (const file of allFiles) {
        const ext = path.extname(file);
        if (extensions[ext]) {
          structure.languages[extensions[ext]] = 
            (structure.languages[extensions[ext]] || 0) + 1;
        }
      }
    } catch {
      // Ignore
    }

    // Find entry points
    const entryPoints = [
      'src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js',
      'index.ts', 'index.js', 'main.ts', 'main.js',
      'package.json', 'Cargo.toml', 'go.mod', 'setup.py',
    ];

    for (const entry of entryPoints) {
      try {
        await fs.access(path.join(this.cwd, entry));
        structure.mainEntryPoints.push(entry);
      } catch {
        // Doesn't exist
      }
    }

    // Check for CI
    try {
      await fs.access(path.join(this.cwd, '.github/workflows'));
      structure.hasCI = true;
    } catch {
      try {
        await fs.access(path.join(this.cwd, '.gitlab-ci.yml'));
        structure.hasCI = true;
      } catch {
        // No CI
      }
    }

    // Check for docs
    try {
      const readme = await fs.readFile(path.join(this.cwd, 'README.md'), 'utf-8');
      structure.hasDocs = readme.length > 100;
    } catch {
      // No README
    }

    // Find key modules (directories in src/)
    try {
      const srcFiles = await fs.readdir(path.join(this.cwd, 'src'));
      structure.keyModules = srcFiles.filter(f => !f.includes('.'));
    } catch {
      // No src/
    }

    return structure;
  }

  /**
   * Identify what's missing
   */
  private identifyGaps(
    structure: CodebaseContext['codeStructure'],
    plans: CodebaseContext['existingPlans']
  ): string[] {
    const gaps: string[] = [];

    if (!structure.hasDocs) {
      gaps.push('Documentation (README needs improvement)');
    }

    if (!structure.hasCI) {
      gaps.push('CI/CD pipeline');
    }

    if (Object.keys(structure.languages).length === 0) {
      gaps.push('Source code structure');
    }

    if (plans.length === 0) {
      gaps.push('Project roadmap/plan');
    }

    if (structure.testCoverage === 0) {
      gaps.push('Test coverage');
    }

    return gaps;
  }

  /**
   * Generate overall summary
   */
  private generateSummary(
    structure: CodebaseContext['codeStructure'],
    plans: CodebaseContext['existingPlans'],
    gaps: string[]
  ): string {
    const langCount = Object.keys(structure.languages).length;
    const langs = Object.entries(structure.languages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lang, count]) => `${lang} (${count} files)`)
      .join(', ');

    let summary = `Codebase with ${langCount} language(s): ${langs}. `;
    
    if (plans.length > 0) {
      summary += `${plans.length} existing plan(s). `;
    }

    if (gaps.length > 0) {
      summary += `Missing: ${gaps.join(', ')}.`;
    } else {
      summary += 'Well-structured project.';
    }

    return summary;
  }

  /**
   * Print analysis results
   */
  printAnalysis(context: CodebaseContext): void {
    console.log('📋 EXISTING PLANS');
    console.log('==================');
    if (context.existingPlans.length === 0) {
      console.log('None found\n');
    } else {
      context.existingPlans.forEach(plan => {
        console.log(`• ${plan.path}`);
        console.log(`  ${plan.title}`);
        console.log(`  ${plan.summary}`);
        console.log();
      });
    }

    console.log('📝 TODOs FOUND');
    console.log('===============');
    if (context.todos.length === 0) {
      console.log('None found\n');
    } else {
      context.todos.slice(0, 10).forEach(todo => {
        console.log(`• [${todo.type}] ${todo.file}:${todo.line}`);
        console.log(`  ${todo.text}`);
      });
      if (context.todos.length > 10) {
        console.log(`  ... and ${context.todos.length - 10} more`);
      }
      console.log();
    }

    console.log('🔄 RECENT COMMITS');
    console.log('==================');
    context.recentCommits.slice(0, 5).forEach(commit => {
      console.log(`• ${commit.hash} ${commit.message}`);
    });
    console.log();

    console.log('📊 CODE STRUCTURE');
    console.log('==================');
    console.log(`Languages: ${Object.entries(context.codeStructure.languages).map(([l, c]) => `${l}(${c})`).join(', ')}`);
    console.log(`Entry points: ${context.codeStructure.mainEntryPoints.join(', ') || 'None'}`);
    console.log(`Key modules: ${context.codeStructure.keyModules.join(', ') || 'None'}`);
    console.log(`CI/CD: ${context.codeStructure.hasCI ? '✓' : '✗'}`);
    console.log(`Documentation: ${context.codeStructure.hasDocs ? '✓' : '✗'}`);
    console.log();

    console.log('⚠️  GAPS IDENTIFIED');
    console.log('===================');
    if (context.gaps.length === 0) {
      console.log('None found\n');
    } else {
      context.gaps.forEach(gap => console.log(`• ${gap}`));
      console.log();
    }

    console.log('🎯 SUMMARY');
    console.log('==========');
    console.log(context.summary);
    console.log();
  }
}
