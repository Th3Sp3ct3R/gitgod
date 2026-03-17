/**
 * Interactive plan generator - asks questions and builds customized plan
 */
import { RepoAnalysis } from './analyzer';
import { IntelligentRepoAnalyzer } from './analyzer';

export interface GeneratedPlan {
  title: string;
  description: string;
  goals: string[];
  scope: {
    in: string[];
    out: string[];
  };
  phases: Array<{
    name: string;
    tasks: string[];
    rationale: string;
  }>;
  successCriteria: string[];
  markdown: string;
}

export interface UserAnswers {
  [questionId: string]: string;
}

export class InteractivePlanGenerator {
  private analyzer: IntelligentRepoAnalyzer;

  constructor() {
    this.analyzer = new IntelligentRepoAnalyzer();
  }

  /**
   * Run full interactive analysis and plan generation
   */
  async generateInteractivePlan(repoPath: string): Promise<GeneratedPlan> {
    // Step 1: Analyze repo
    const analysis = await this.analyzer.analyzeRepo(repoPath);
    this.analyzer.printAnalysis(analysis);

    // Step 2: Collect answers (in real usage, this would be interactive)
    // For now, we'll use defaults
    const answers = this.collectDefaultAnswers(analysis.questions);

    // Step 3: Generate plan based on analysis + answers
    const plan = this.buildPlan(analysis, answers);

    return plan;
  }

  /**
   * Build customized plan from analysis and user answers
   */
  private buildPlan(analysis: RepoAnalysis, answers: UserAnswers): GeneratedPlan {
    const goals: string[] = [];
    const scopeIn: string[] = [];
    const scopeOut: string[] = [];
    const phases: GeneratedPlan['phases'] = [];

    // Determine goals based on gaps and answers
    const highPriorityGaps = analysis.gaps.filter(g => g.priority === 'high');
    
    if (highPriorityGaps.length > 0) {
      goals.push(`Address ${highPriorityGaps.length} critical gaps identified in analysis`);
    }

    if (answers['add-ci'] === 'A') {
      goals.push('Establish automated CI/CD pipeline for reliable deployments');
      scopeIn.push('GitHub Actions workflow for testing and building');
      scopeIn.push('Pre-commit hooks for code quality');
    } else {
      scopeOut.push('CI/CD automation (manual for now)');
    }

    if (answers['add-tests']?.startsWith('Yes')) {
      goals.push('Add comprehensive test coverage');
      scopeIn.push('Unit tests for core functionality');
      scopeIn.push('Integration tests for external dependencies');
      scopeOut.push('100% test coverage (aim for 80% initially)');
    }

    if (answers['improve-docs'] === 'A') {
      goals.push('Improve documentation for better developer experience');
      scopeIn.push('Auto-generated API documentation');
      scopeIn.push('Usage examples and tutorials');
    }

    if (answers['fix-todos']?.startsWith('Yes')) {
      const todoCount = parseInt(answers['fix-todos'].match(/\d+/)?.[0] || '0');
      goals.push(`Address ${todoCount} outstanding TODOs and FIXMEs`);
      scopeIn.push('Resolve high-priority technical debt');
    }

    // Add category-specific goals
    if (analysis.categoryPatterns) {
      const missingFeatures = analysis.gaps
        .filter(g => g.type === 'missing_feature')
        .slice(0, 2);
      
      for (const feature of missingFeatures) {
        if (goals.length < 5) {
          goals.push(feature.recommendation);
        }
      }
    }

    // Build phases based on what needs to be done
    if (answers['fix-todos']?.startsWith('Yes')) {
      phases.push({
        name: 'Address Technical Debt',
        tasks: [
          'Review and prioritize all TODOs/FIXMEs',
          'Fix critical issues that block other work',
          'Create tickets for non-critical items',
        ],
        rationale: 'Clean codebase before adding new features',
      });
    }

    if (answers['add-tests']?.startsWith('Yes')) {
      const testFramework = answers['add-tests'].includes('Jest') ? 'Jest' : 'Vitest';
      phases.push({
        name: 'Add Test Infrastructure',
        tasks: [
          `Install and configure ${testFramework}`,
          'Create test utilities and mocks',
          'Write initial unit tests for core modules',
          'Set up coverage reporting',
        ],
        rationale: 'Establish testing foundation before implementation',
      });
    }

    if (answers['add-ci'] === 'A') {
      phases.push({
        name: 'Set Up CI/CD Pipeline',
        tasks: [
          'Create GitHub Actions workflow for tests',
          'Add lint and type-check jobs',
          'Configure coverage reporting',
          'Set up automated releases',
        ],
        rationale: 'Automate quality checks and deployment',
      });
    }

    if (answers['improve-docs'] === 'A') {
      phases.push({
        name: 'Generate Documentation',
        tasks: [
          'Enhance README with architecture overview',
          'Add usage examples and quickstart guide',
          'Generate API documentation from code',
          'Create contribution guidelines',
        ],
        rationale: 'Improve developer experience and adoption',
      });
    }

    // Add implementation phase for specific features
    const featureGaps = analysis.gaps.filter(g => g.type === 'missing_feature');
    if (featureGaps.length > 0) {
      phases.push({
        name: 'Add Missing Features',
        tasks: featureGaps.slice(0, 3).map(g => g.recommendation),
        rationale: 'Align with best practices from similar tools',
      });
    }

    // Success criteria
    const successCriteria = [
      'All high-priority gaps addressed',
      'CI/CD pipeline passing',
      'Test coverage above 80%',
      'Documentation complete and accurate',
    ];

    if (phases.length === 0) {
      phases.push({
        name: 'Review and Refine',
        tasks: [
          'Review codebase against similar tools',
          'Identify opportunities for improvement',
          'Create roadmap for future enhancements',
        ],
        rationale: 'Repository is in good shape, focus on incremental improvements',
      });
    }

    const title = `Improve ${analysis.repoInfo.name} - ${goals.length} Key Enhancements`;
    const description = `Based on analysis of ${analysis.similarTools.length} similar tools, this plan addresses ${analysis.gaps.filter(g => g.priority === 'high').length} critical gaps and adds ${phases.length} enhancement phases to bring the project in line with ecosystem best practices.`;

    const plan: GeneratedPlan = {
      title,
      description,
      goals,
      scope: { in: scopeIn, out: scopeOut },
      phases,
      successCriteria,
      markdown: this.buildMarkdown({
        title,
        description,
        goals,
        scope: { in: scopeIn, out: scopeOut },
        phases,
        successCriteria,
        analysis,
      }),
    };

    return plan;
  }

  /**
   * Collect default answers (in real usage, would prompt user)
   */
  private collectDefaultAnswers(questions: RepoAnalysis['questions']): UserAnswers {
    const answers: UserAnswers = {};
    
    for (const question of questions) {
      // Use default answer
      const defaultIndex = question.defaultAnswer.charCodeAt(0) - 65; // A=0, B=1, etc.
      answers[question.id] = question.options[defaultIndex] || question.options[0];
    }

    return answers;
  }

  /**
   * Build markdown document
   */
  private buildMarkdown(data: {
    title: string;
    description: string;
    goals: string[];
    scope: { in: string[]; out: string[] };
    phases: GeneratedPlan['phases'];
    successCriteria: string[];
    analysis: RepoAnalysis;
  }): string {
    return `# ${data.title}

## Overview

${data.description}

## Analysis Context

**Repository:** ${data.analysis.repoInfo.name}
**Category:** ${data.analysis.repoInfo.detectedCategory}
**Similar Tools Analyzed:** ${data.analysis.similarTools.length}
**Critical Gaps Found:** ${data.analysis.gaps.filter(g => g.priority === 'high').length}

### Top Similar Tools
${data.analysis.similarTools.slice(0, 5).map(t => `- ${t.name} (${t.relevanceScore}/5 relevance)`).join('\n')}

## Goals

${data.goals.map(g => `- ${g}`).join('\n')}

## Scope

### In Scope

${data.scope.in.map(s => `- ${s}`).join('\n') || '- No specific scope items defined'}

### Out of Scope (Future Work)

${data.scope.out.map(s => `- ${s}`).join('\n') || '- No deferred items'}

## Implementation Phases

${data.phases.map((phase, i) => `
### Phase ${i + 1}: ${phase.name}

**Rationale:** ${phase.rationale}

**Tasks:**
${phase.tasks.map(t => `- ${t}`).join('\n')}
`).join('\n')}

## Success Criteria

${data.successCriteria.map(s => `- [ ] ${s}`).join('\n')}

## Gaps Addressed

${data.analysis.gaps.filter(g => g.priority === 'high').map(g => `- **${g.description}** - ${g.recommendation}`).join('\n')}

---

*Generated by GitGod Intelligent Repo Analyzer*
*Based on patterns from ${data.analysis.similarTools.length} similar tools in the ecosystem*
`;
  }

  /**
   * Print generated plan
   */
  printPlan(plan: GeneratedPlan): void {
    console.log('\n📋 GENERATED PLAN');
    console.log('==================\n');
    console.log(plan.markdown);
  }
}
