/**
 * Pattern extractor - loads and analyzes gitgod synthesis data
 */
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ToolPattern {
  name: string;
  category: string;
  tags: string[];
  relevanceScore: number;
  summary: string;
  crossCategories: string[];
  duplicates: string[];
  architectureHints: string[];
  commonFeatures: string[];
}

export interface CategoryPattern {
  name: string;
  toolCount: number;
  avgRelevance: number;
  topTools: ToolPattern[];
  commonTags: string[];
  featurePatterns: string[];
  architecturePatterns: string[];
}

export interface PatternDatabase {
  totalTools: number;
  categories: Map<string, CategoryPattern>;
  topTools: ToolPattern[];
  tagIndex: Map<string, ToolPattern[]>;
  featurePatterns: Map<string, number>;
}

export class PatternExtractor {
  private dataDir: string;
  private patterns: PatternDatabase | null = null;

  constructor(dataDir: string = '/Users/growthgod/gitgod/data/clawhub-ai') {
    this.dataDir = dataDir;
  }

  /**
   * Load all synthesis data and build pattern database
   */
  async loadPatterns(): Promise<PatternDatabase> {
    if (this.patterns) {
      return this.patterns;
    }

    console.log('📚 Loading GitGod pattern database...\n');

    const synthesisFiles = [
      'synthesis-devtools.json',
      'synthesis-productivity.json',
      'synthesis-remaining.json',
    ];

    const allTools: ToolPattern[] = [];
    const categories = new Map<string, CategoryPattern>();
    const tagIndex = new Map<string, ToolPattern[]>();
    const featureCounts = new Map<string, number>();

    for (const file of synthesisFiles) {
      const filePath = path.join(this.dataDir, file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const tools = JSON.parse(content);

        for (const tool of tools) {
          if (!tool.synthesis) continue;

          const pattern: ToolPattern = {
            name: tool.name,
            category: this.inferCategory(tool),
            tags: tool.synthesis.tags || [],
            relevanceScore: tool.synthesis.relevance_score || 3,
            summary: tool.synthesis.summary || '',
            crossCategories: tool.synthesis.cross_categories || [],
            duplicates: tool.synthesis.duplicates || [],
            architectureHints: this.extractArchitectureHints(tool),
            commonFeatures: this.extractCommonFeatures(tool),
          };

          allTools.push(pattern);

          // Index by tags
          for (const tag of pattern.tags) {
            if (!tagIndex.has(tag)) {
              tagIndex.set(tag, []);
            }
            tagIndex.get(tag)!.push(pattern);
          }

          // Count features
          for (const feature of pattern.commonFeatures) {
            featureCounts.set(feature, (featureCounts.get(feature) || 0) + 1);
          }
        }
      } catch (error) {
        console.warn(`Warning: Could not load ${file}: ${error}`);
      }
    }

    // Build category patterns
    const toolsByCategory = new Map<string, ToolPattern[]>();
    for (const tool of allTools) {
      if (!toolsByCategory.has(tool.category)) {
        toolsByCategory.set(tool.category, []);
      }
      toolsByCategory.get(tool.category)!.push(tool);
    }

    for (const [categoryName, tools] of toolsByCategory) {
      const avgRelevance = tools.reduce((sum, t) => sum + t.relevanceScore, 0) / tools.length;
      const topTools = tools
        .filter(t => t.relevanceScore >= 4)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 10);

      const allTags = tools.flatMap(t => t.tags);
      const tagCounts = new Map<string, number>();
      for (const tag of allTags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
      const commonTags = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag]) => tag);

      const allFeatures = tools.flatMap(t => t.commonFeatures);
      const featurePatternCounts = new Map<string, number>();
      for (const feature of allFeatures) {
        featurePatternCounts.set(feature, (featurePatternCounts.get(feature) || 0) + 1);
      }
      const featurePatterns = Array.from(featurePatternCounts.entries())
        .filter(([_, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([feature]) => feature);

      const architecturePatterns = this.extractCategoryArchitecture(tools);

      categories.set(categoryName, {
        name: categoryName,
        toolCount: tools.length,
        avgRelevance,
        topTools,
        commonTags,
        featurePatterns,
        architecturePatterns,
      });
    }

    this.patterns = {
      totalTools: allTools.length,
      categories,
      topTools: allTools.filter(t => t.relevanceScore >= 4).slice(0, 50),
      tagIndex,
      featurePatterns: featureCounts,
    };

    console.log(`✓ Loaded ${allTools.length} tools across ${categories.size} categories\n`);

    return this.patterns;
  }

  /**
   * Find similar tools based on tags and category
   */
  async findSimilarTools(tags: string[], category?: string, limit: number = 5): Promise<ToolPattern[]> {
    const patterns = await this.loadPatterns();
    const scores = new Map<ToolPattern, number>();

    for (const tag of tags) {
      const toolsWithTag = patterns.tagIndex.get(tag) || [];
      for (const tool of toolsWithTag) {
        const currentScore = scores.get(tool) || 0;
        scores.set(tool, currentScore + 1);
      }
    }

    // Boost score for matching category
    if (category) {
      for (const [tool, score] of scores) {
        if (tool.category === category) {
          scores.set(tool, score + 2);
        }
      }
    }

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tool]) => tool);
  }

  /**
   * Get feature recommendations for a category
   */
  async getFeatureRecommendations(category: string): Promise<string[]> {
    const patterns = await this.loadPatterns();
    const catPattern = patterns.categories.get(category);
    return catPattern?.featurePatterns || [];
  }

  /**
   * Get architecture patterns for a category
   */
  async getArchitecturePatterns(category: string): Promise<string[]> {
    const patterns = await this.loadPatterns();
    const catPattern = patterns.categories.get(category);
    return catPattern?.architecturePatterns || [];
  }

  /**
   * Print pattern summary
   */
  async printSummary(): Promise<void> {
    const patterns = await this.loadPatterns();

    console.log('📊 PATTERN DATABASE SUMMARY');
    console.log('============================\n');
    console.log(`Total Tools: ${patterns.totalTools}`);
    console.log(`Categories: ${patterns.categories.size}`);
    console.log(`High-Relevance Tools (4-5): ${patterns.topTools.length}\n`);

    console.log('🏆 TOP CATEGORIES BY TOOL COUNT');
    console.log('================================\n');
    const sortedCategories = Array.from(patterns.categories.entries())
      .sort((a, b) => b[1].toolCount - a[1].toolCount)
      .slice(0, 10);

    for (const [name, cat] of sortedCategories) {
      console.log(`${name}: ${cat.toolCount} tools (avg relevance: ${cat.avgRelevance.toFixed(1)})`);
    }

    console.log('\n🏷️  MOST COMMON TAGS');
    console.log('====================\n');
    const sortedTags = Array.from(patterns.tagIndex.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 15);

    for (const [tag, tools] of sortedTags) {
      console.log(`${tag}: ${tools.length} tools`);
    }

    console.log('\n🔧 TOP FEATURE PATTERNS');
    console.log('========================\n');
    const sortedFeatures = Array.from(patterns.featurePatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    for (const [feature, count] of sortedFeatures) {
      console.log(`${feature}: ${count} occurrences`);
    }

    console.log('');
  }

  private inferCategory(tool: any): string {
    // Try to infer from various fields
    if (tool.category) return tool.category;
    if (tool.synthesis?.cross_categories?.[0]) return tool.synthesis.cross_categories[0];
    
    // Infer from tags
    const tags = tool.synthesis?.tags || [];
    if (tags.includes('cli')) return 'CLI Tools';
    if (tags.includes('api')) return 'API Tools';
    if (tags.includes('web')) return 'Web Tools';
    if (tags.includes('database') || tags.includes('sql')) return 'Database Tools';
    if (tags.includes('git')) return 'Version Control';
    if (tags.includes('test')) return 'Testing Tools';
    if (tags.includes('security')) return 'Security Tools';
    
    return 'Other';
  }

  private extractArchitectureHints(tool: any): string[] {
    const hints: string[] = [];
    const summary = tool.synthesis?.summary?.toLowerCase() || '';
    const tags = tool.synthesis?.tags || [];

    if (summary.includes('cli') || tags.includes('cli')) hints.push('CLI interface');
    if (summary.includes('api') || tags.includes('api')) hints.push('API integration');
    if (summary.includes('server') || tags.includes('server')) hints.push('Server component');
    if (summary.includes('mcp') || summary.includes('model context protocol')) hints.push('MCP server');
    if (summary.includes('plugin') || summary.includes('extension')) hints.push('Plugin architecture');
    if (tags.includes('webhook')) hints.push('Webhook support');
    if (tags.includes('authentication') || tags.includes('auth')) hints.push('Authentication');

    return hints;
  }

  private extractCommonFeatures(tool: any): string[] {
    const features: string[] = [];
    const summary = tool.synthesis?.summary?.toLowerCase() || '';
    const tags = tool.synthesis?.tags || [];

    // Security features
    if (tags.includes('security') || summary.includes('security')) features.push('Security');
    if (summary.includes('auth')) features.push('Authentication');
    
    // Integration features
    if (summary.includes('integration')) features.push('Integration');
    if (tags.includes('webhook')) features.push('Webhooks');
    
    // UI features
    if (tags.includes('cli')) features.push('CLI interface');
    if (tags.includes('gui') || summary.includes('ui')) features.push('UI/UX');
    
    // Data features
    if (tags.includes('database') || tags.includes('sql')) features.push('Database');
    if (summary.includes('cache')) features.push('Caching');
    
    // Dev features
    if (tags.includes('test')) features.push('Testing');
    if (summary.includes('logging')) features.push('Logging');
    if (summary.includes('error handling')) features.push('Error handling');

    return features;
  }

  private extractCategoryArchitecture(tools: ToolPattern[]): string[] {
    const architectures = new Map<string, number>();
    
    for (const tool of tools) {
      for (const hint of tool.architectureHints) {
        architectures.set(hint, (architectures.get(hint) || 0) + 1);
      }
    }

    return Array.from(architectures.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([arch]) => arch);
  }
}
