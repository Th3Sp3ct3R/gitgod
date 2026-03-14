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
