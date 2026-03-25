// src/types.ts

export interface Tool {
  name: string;
  url: string;
  description: string;
  link_type: "github" | "website" | "tool" | "api" | "unknown";
  status: "pending_scrape" | "alive" | "dead" | "error" | "skipped";
  scraped?: ScrapedData;
  synthesis?: SynthesisData;
}

export interface Category {
  category: string;
  depth: number;
  tools: Tool[];
  subcategories: Category[];
}

export interface Skeleton {
  repo: string;
  url: string;
  scraped_at: string;
  stats: { categories: number; links: number };
  taxonomy: Category[];
}

export interface ScrapedData {
  title: string;
  description: string;
  content_preview: string;
  github_meta?: {
    stars: number;
    language: string;
    last_commit: string;
    topics: string[];
  };
  scraped_at: string;
}

export interface SynthesisData {
  summary: string;
  tags: string[];
  relevance_score: number;
  cross_categories: string[];
  duplicates: string[];
}

export interface EnrichProgress {
  total: number;
  completed: number;
  failed: number;
  dead: number;
  skipped: number;
  last_index: number;
}

export type DecomposeOperationKind =
  | "api_endpoint"
  | "script"
  | "build"
  | "data"
  | "config"
  | "business_logic";

export interface DecomposeOperation {
  id: string;
  title: string;
  category: string;
  kind: DecomposeOperationKind;
  source_tool_name: string;
  source_url: string;
  evidence: string[];
  tags: string[];
}

export interface DecomposeResult {
  repo: string;
  url: string;
  generated_at: string;
  categories: string[];
  operations: DecomposeOperation[];
  stats: {
    operations: number;
    categories: number;
  };
}

export interface WorkflowChainStep {
  commandId: string;
  inputFromStep?: number;
  note?: string;
}

export interface WorkflowChain {
  id: string;
  title: string;
  description: string;
  steps: WorkflowChainStep[];
}

export interface CLICommand {
  id: string;
  name: string;
  group?: string;
  description?: string;
  args?: string[];
  supportsJson: true;
  stdinSchema?: string;
  stdoutSchema?: string;
}

export interface HarnessConfig {
  slug?: string;
  repoPath: string;
  decomposition: DecomposeResult;
  dataDir?: string;
  outputDir?: string;
  refineFocus?: string;
}

export interface HarnessResult {
  cliName: string;
  commands: CLICommand[];
  skillMdPath: string;
  testResults: {
    passed: number;
    failed: number;
  };
  workflows: WorkflowChain[];
}

export interface InvokeToolInput {
  tool: string;
  command: string;
  args?: Record<string, string>;
}

export interface InvokeToolOutput {
  exitCode: number;
  stdout: string;
  stderr?: string;
  json?: unknown;
}

export interface SingleRepoEntry {
  repo: string;
  url: string;
  scraped: ScrapedData;
  synthesis: SynthesisData;
  source?: string;
  imported_at?: string;
}

export interface BrowserIngestedGraph {
  version: number;
  entries: SingleRepoEntry[];
  updated_at: string;
}
