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

/** LLM Classifier-Ω output (enrich when GITGOD_CLASSIFIER_OMEGA=1). See docs/prompts/CLASSIFIER-OMEGA-SYSTEM.md */
export interface OmegaClassification {
  website_type: string;
  is_competitor: boolean;
  competitor_reason: string | null;
  is_another_agent: boolean;
  agent_type: string | null;
  agent_capabilities: string[];
  threat_level: string;
  threat_justification: string;
  key_technologies: string[];
  target_audience: string;
  red_flags: string[];
  summary: string;
  action_recommendation: string;
  /** 0–100 model-reported certainty */
  confidence: number;
  /** Privacy, bias, oversight notes; null if none */
  ethics_notes: string | null;
}

export interface ScrapedData {
  title: string;
  description: string;
  content_preview: string;
  /** Long text for Classifier-Ω (up to ~120k chars) when GITGOD_CLASSIFIER_OMEGA is set during enrich */
  content_text?: string;
  github_meta?: {
    stars: number;
    language: string;
    last_commit: string;
    topics: string[];
  };
  scraped_at: string;
  content_format?: 'markdown' | 'json' | 'json_with_md';
  content_category?: string;
  classifier_confidence?: number;
  omega_classification?: OmegaClassification;
  llms_txt_source?: string;
  firecrawl_method?:
    | "MAP"
    | "SCRAPE"
    | "BATCH_SCRAPE"
    | "CRAWL"
    | "INTERACT"
    | "SEARCH"
    | "LLMS_TXT_BYPASS";
  firecrawl_credits?: number;
  interact_output?: string;
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
  decompositionPath?: string;
  dataDir?: string;
  outputDir?: string;
  refineFocus?: string;
  discoveryManifestPath?: string | false;
  workflowMapPath?: string | false;
  allowFallback?: boolean;
}

export interface HarnessResult {
  status: "harnessed" | "decomposed_no_harness";
  cliName: string;
  commands: CLICommand[];
  skillMdPath: string;
  testResults: {
    passed: number;
    failed: number;
  };
  workflows: WorkflowChain[];
  cachePath: string;
  workflowPath?: string;
  fallbackReason?: string;
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
  /** GitHub org/user when known from ingest */
  owner?: string;
  /** When the entry was ingested (some stages use this key) */
  ingested_at?: string;
}

export interface BrowserIngestedGraph {
  version: number;
  entries: SingleRepoEntry[];
  updated_at: string;
}
