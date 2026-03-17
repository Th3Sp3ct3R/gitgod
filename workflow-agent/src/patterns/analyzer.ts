/**
 * Intelligent repo analyzer using gitgod patterns
 */
import { PatternExtractor, ToolPattern, CategoryPattern } from './extractor';
import { CodebaseAnalyzer, CodebaseContext } from '../analyzer';

export interface RepoAnalysis {
  repoInfo: {
    name: string;
    detectedCategory: string;
    confidence: number;
  };
  similarTools: ToolPattern[];
  categoryPatterns: CategoryPattern | null;
  gaps: Array<{
    type: 'missing_feature' | 'missing_architecture' | 'quality_issue';
    description: string;
    recommendation: string;
    priority: 'high' | 'medium' | 'low';
    basedOn: string[]; // Tools that have this
  }>;
  questions: Array<{
    id: string;
    question: string;
    context: string;
    options: string[];
    defaultAnswer: string;
  }>;
  insights: string[];
}

export class IntelligentRepoAnalyzer {
  private patternExtractor: PatternExtractor;
  private codebaseAnalyzer: CodebaseAnalyzer;

  constructor() {
    this.patternExtractor = new PatternExtractor();
    this.codebaseAnalyzer = new CodebaseAnalyzer();
  }

  /**
   * Deeply analyze a repository against gitgod patterns
   */
  async analyzeRepo(repoPath: string): Promise<RepoAnalysis> {
    console.log(`🔍 Analyzing repository: ${repoPath}\n`);

    // Load patterns first
    await this.patternExtractor.loadPatterns();

    // Analyze codebase structure
    const codebaseContext = await this.codebaseAnalyzer.analyze();

    // Detect category from codebase
    const detectedCategory = this.detectCategory(codebaseContext);
    const categoryPattern = await this.getCategoryPattern(detectedCategory.category);

    // Find similar tools
    const similarTools = await this.patternExtractor.findSimilarTools(
      detectedCategory.tags,
      detectedCategory.category,
      10
    );

    // Identify gaps
    const gaps = await this.identifyGaps(codebaseContext, categoryPattern, similarTools);

    // Generate insights
    const insights = this.generateInsights(codebaseContext, similarTools, gaps);

    // Generate questions
    const questions = this.generateQuestions(gaps, codebaseContext);

    return {
      repoInfo: {
        name: repoPath.split('/').pop() || 'Unknown',
        detectedCategory: detectedCategory.category,
        confidence: detectedCategory.confidence,
      },
      similarTools,
      categoryPatterns: categoryPattern,
      gaps,
      questions,
      insights,
    };
  }

  /**
   * Detect what category this repo belongs to
   */
  private detectCategory(context: CodebaseContext): { category: string; tags: string[]; confidence: number } {
    const tags: string[] = [];
    
    // Detect from languages
    const langs = Object.keys(context.codeStructure.languages);
    if (langs.includes('TypeScript') || langs.includes('JavaScript')) {
      tags.push('typescript');
    }
    if (langs.includes('Python')) {
      tags.push('python');
    }
    if (langs.includes('Go')) {
      tags.push('go');
    }

    // Detect from entry points and structure
    if (context.codeStructure.mainEntryPoints.some(e => e.includes('cli') || e.includes('bin'))) {
      tags.push('cli');
    }
    if (context.codeStructure.keyModules.includes('server') || context.codeStructure.keyModules.includes('api')) {
      tags.push('api');
      tags.push('server');
    }

    // Infer category from patterns
    let category = 'Other';
    let confidence = 0.5;

    if (tags.includes('cli')) {
      category = 'CLI Tools';
      confidence = 0.8;
    } else if (tags.includes('api')) {
      category = 'API Tools';
      confidence = 0.75;
    } else if (context.codeStructure.keyModules.includes('mcp') || 
               context.todos.some(t => t.text.toLowerCase().includes('mcp'))) {
      category = 'MCP Servers';
      tags.push('mcp');
      confidence = 0.9;
    } else if (tags.includes('web') || context.codeStructure.keyModules.includes('web')) {
      category = 'Web Tools';
      confidence = 0.7;
    }

    // Add more tags from gaps
    if (!context.codeStructure.hasCI) {
      tags.push('ci-cd');
    }
    if (!context.codeStructure.hasDocs) {
      tags.push('documentation');
    }
    if (context.todos.length > 5) {
      tags.push('needs-cleanup');
    }

    return { category, tags, confidence };
  }

  /**
   * Get category patterns
   */
  private async getCategoryPattern(category: string): Promise<CategoryPattern | null> {
    const patterns = await this.patternExtractor.loadPatterns();
    return patterns.categories.get(category) || null;
  }

  /**
   * Identify gaps by comparing against similar tools
   */
  private async identifyGaps(
    context: CodebaseContext,
    categoryPattern: CategoryPattern | null,
    similarTools: ToolPattern[]
  ): Promise<RepoAnalysis['gaps']> {
    const gaps: RepoAnalysis['gaps'] = [];

    // Check for missing features compared to top tools
    if (categoryPattern) {
      for (const feature of categoryPattern.featurePatterns) {
        const hasFeature = this.checkHasFeature(context, feature);
        if (!hasFeature) {
          const toolsWithFeature = similarTools
            .filter(t => t.commonFeatures.includes(feature))
            .slice(0, 3)
            .map(t => t.name);

          if (toolsWithFeature.length > 0) {
            gaps.push({
              type: 'missing_feature',
              description: `Missing ${feature.toLowerCase()}`,
              recommendation: `Consider adding ${feature.toLowerCase()} to match similar tools`,
              priority: toolsWithFeature.length > 2 ? 'high' : 'medium',
              basedOn: toolsWithFeature,
            });
          }
        }
      }
    }

    // Check for missing architecture patterns
    if (categoryPattern) {
      for (const arch of categoryPattern.architecturePatterns) {
        const hasArch = this.checkHasArchitecture(context, arch);
        if (!hasArch) {
          const toolsWithArch = similarTools
            .filter(t => t.architectureHints.includes(arch))
            .slice(0, 3)
            .map(t => t.name);

          if (toolsWithArch.length > 0) {
            gaps.push({
              type: 'missing_architecture',
              description: `Missing ${arch.toLowerCase()} architecture`,
              recommendation: `Consider implementing ${arch.toLowerCase()} pattern`,
              priority: 'medium',
              basedOn: toolsWithArch,
            });
          }
        }
      }
    }

    // Quality issues
    if (context.codeStructure.languages['TypeScript'] && !context.codeStructure.hasCI) {
      gaps.push({
        type: 'quality_issue',
        description: 'No CI/CD pipeline detected',
        recommendation: 'Add GitHub Actions for automated testing and deployment',
        priority: 'high',
        basedOn: similarTools.filter(t => t.relevanceScore >= 4).map(t => t.name),
      });
    }

    if (!context.codeStructure.hasDocs) {
      gaps.push({
        type: 'quality_issue',
        description: 'Documentation missing or minimal',
        recommendation: 'Add comprehensive README with usage examples',
        priority: 'high',
        basedOn: similarTools.slice(0, 3).map(t => t.name),
      });
    }

    if (Object.keys(context.codeStructure.languages).length > 0 && context.todos.length > 10) {
      gaps.push({
        type: 'quality_issue',
        description: `${context.todos.length} TODOs/FIXMEs found in codebase`,
        recommendation: 'Address critical TODOs before adding new features',
        priority: 'medium',
        basedOn: [],
      });
    }

    return gaps.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Generate insights from analysis
   */
  private generateInsights(
    context: CodebaseContext,
    similarTools: ToolPattern[],
    gaps: RepoAnalysis['gaps']
  ): string[] {
    const insights: string[] = [];

    // Compare against top tools
    const topTools = similarTools.filter(t => t.relevanceScore >= 4);
    if (topTools.length > 0) {
      insights.push(`This project resembles ${topTools.length} highly-rated tools in the ecosystem`);
    }

    // Architecture insight
    if (context.codeStructure.keyModules.length > 0) {
      insights.push(`Modular architecture detected with ${context.codeStructure.keyModules.length} key modules`);
    }

    // Gap insight
    const highPriorityGaps = gaps.filter(g => g.priority === 'high');
    if (highPriorityGaps.length > 0) {
      insights.push(`${highPriorityGaps.length} high-priority improvements identified compared to similar tools`);
    }

    // Language insight
    const langCount = Object.keys(context.codeStructure.languages).length;
    if (langCount === 1) {
      insights.push('Single-language codebase - good for maintainability');
    } else if (langCount > 2) {
      insights.push(`Multi-language codebase (${langCount} languages) - consider consolidation`);
    }

    return insights;
  }

  /**
   * Generate interactive questions based on gaps
   */
  private generateQuestions(gaps: RepoAnalysis['gaps'], context: CodebaseContext): RepoAnalysis['questions'] {
    const questions: RepoAnalysis['questions'] = [];

    // Question about CI/CD
    const ciGap = gaps.find(g => g.description.includes('CI/CD'));
    if (ciGap) {
      questions.push({
        id: 'add-ci',
        question: 'Add CI/CD pipeline?',
        context: `${ciGap.basedOn.slice(0, 3).join(', ')} and ${ciGap.basedOn.length} other similar tools have automated testing.`,
        options: ['Yes, add GitHub Actions', 'No, skip for now', 'Add later manually'],
        defaultAnswer: 'A',
      });
    }

    // Question about tests
    if (!context.codeStructure.hasCI) {
      questions.push({
        id: 'add-tests',
        question: 'Add test framework?',
        context: 'No test coverage detected. Similar tools typically have unit and integration tests.',
        options: ['Yes, add Jest', 'Yes, add Vitest', 'No, skip'],
        defaultAnswer: 'A',
      });
    }

    // Question about documentation
    const docGap = gaps.find(g => g.description.includes('Documentation'));
    if (docGap) {
      questions.push({
        id: 'improve-docs',
        question: 'Improve documentation?',
        context: 'README needs expansion with usage examples and API documentation.',
        options: ['Yes, auto-generate docs', 'Yes, but manual', 'No'],
        defaultAnswer: 'A',
      });
    }

    // Question about TODOs
    if (context.todos.length > 5) {
      questions.push({
        id: 'fix-todos',
        question: `Address ${context.todos.length} TODOs/FIXMEs?`,
        context: 'Found critical items needing attention before new features.',
        options: ['Yes, fix high-priority', 'Yes, fix all', 'No, defer'],
        defaultAnswer: 'A',
      });
    }

    // Question about specific features
    const featureGaps = gaps.filter(g => g.type === 'missing_feature').slice(0, 3);
    for (const gap of featureGaps) {
      questions.push({
        id: `feature-${gap.description.replace(/\s+/g, '-').toLowerCase()}`,
        question: `Add ${gap.description.toLowerCase()}?`,
        context: `Used by ${gap.basedOn.join(', ')}. ${gap.recommendation}`,
        options: ['Yes, essential', 'Yes, but later', 'No, not needed'],
        defaultAnswer: gap.priority === 'high' ? 'A' : 'B',
      });
    }

    return questions;
  }

  /**
   * Check if codebase has a specific feature
   */
  private checkHasFeature(context: CodebaseContext, feature: string): boolean {
    const featureLower = feature.toLowerCase();
    
    if (featureLower.includes('test') || featureLower.includes('testing')) {
      return context.codeStructure.hasCI;
    }
    if (featureLower.includes('auth')) {
      return context.todos.some(t => t.text.toLowerCase().includes('auth')) === false;
    }
    if (featureLower.includes('logging')) {
      return context.codeStructure.keyModules.some(m => m.includes('log'));
    }
    if (featureLower.includes('error')) {
      return context.todos.some(t => t.text.toLowerCase().includes('error')) === false;
    }
    if (featureLower.includes('cache')) {
      return context.codeStructure.keyModules.some(m => m.includes('cache'));
    }
    if (featureLower.includes('cli')) {
      return context.codeStructure.mainEntryPoints.some(e => e.includes('cli') || e.includes('bin'));
    }
    
    return false;
  }

  /**
   * Check if codebase has specific architecture
   */
  private checkHasArchitecture(context: CodebaseContext, architecture: string): boolean {
    const archLower = architecture.toLowerCase();
    
    if (archLower.includes('cli')) {
      return context.codeStructure.mainEntryPoints.some(e => e.includes('cli'));
    }
    if (archLower.includes('api')) {
      return context.codeStructure.keyModules.some(m => m.includes('api') || m.includes('server'));
    }
    if (archLower.includes('mcp')) {
      return context.codeStructure.keyModules.includes('mcp') || 
             context.todos.some(t => t.text.toLowerCase().includes('mcp'));
    }
    if (archLower.includes('plugin')) {
      return context.codeStructure.keyModules.some(m => m.includes('plugin') || m.includes('extension'));
    }
    if (archLower.includes('webhook')) {
      return context.todos.some(t => t.text.toLowerCase().includes('webhook'));
    }
    
    return false;
  }

  /**
   * Print analysis results
   */
  printAnalysis(analysis: RepoAnalysis): void {
    console.log('📊 REPO ANALYSIS RESULTS');
    console.log('========================\n');

    console.log(`Repository: ${analysis.repoInfo.name}`);
    console.log(`Detected Category: ${analysis.repoInfo.detectedCategory} (${(analysis.repoInfo.confidence * 100).toFixed(0)}% confidence)\n`);

    console.log('💡 INSIGHTS');
    console.log('===========');
    analysis.insights.forEach(i => console.log(`• ${i}`));
    console.log();

    console.log('🛠️  SIMILAR TOOLS');
    console.log('=================');
    analysis.similarTools.slice(0, 5).forEach(tool => {
      console.log(`• ${tool.name} (relevance: ${tool.relevanceScore}/5) - ${tool.summary.substring(0, 80)}...`);
    });
    console.log();

    if (analysis.categoryPatterns) {
      console.log('📈 CATEGORY PATTERNS');
      console.log('====================');
      console.log(`Tools in category: ${analysis.categoryPatterns.toolCount}`);
      console.log(`Avg relevance: ${analysis.categoryPatterns.avgRelevance.toFixed(1)}/5`);
      console.log(`Common features: ${analysis.categoryPatterns.featurePatterns.slice(0, 5).join(', ')}`);
      console.log();
    }

    console.log('⚠️  GAPS IDENTIFIED');
    console.log('===================');
    analysis.gaps.forEach(gap => {
      const icon = gap.priority === 'high' ? '🔴' : gap.priority === 'medium' ? '🟡' : '🟢';
      console.log(`${icon} [${gap.priority.toUpperCase()}] ${gap.description}`);
      console.log(`   Recommendation: ${gap.recommendation}`);
      if (gap.basedOn.length > 0) {
        console.log(`   Similar tools with this: ${gap.basedOn.slice(0, 3).join(', ')}`);
      }
      console.log();
    });

    console.log('❓ QUESTIONS FOR YOU');
    console.log('====================');
    analysis.questions.forEach((q, i) => {
      console.log(`${i + 1}. ${q.question}`);
      console.log(`   Context: ${q.context}`);
      console.log(`   Options: ${q.options.join(' / ')}`);
      console.log();
    });
  }
}
