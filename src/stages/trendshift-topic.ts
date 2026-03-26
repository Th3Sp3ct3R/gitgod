import type { TrendshiftTopicParseResult } from "../parsers/trendshift-topic.js";
import {
  extractTrendshiftRepos,
  scrapeTrendshiftTopicMarkdown,
} from "./trendshift-workflow.js";

export interface TrendshiftTopicScrapeOptions {
  outputDir?: string;
  waitForMs?: number;
  scrapeMarkdown?: (url: string, waitForMs: number) => string;
}

export async function scrapeTrendshiftTopic(
  url: string,
  options: TrendshiftTopicScrapeOptions = {}
): Promise<TrendshiftTopicParseResult & { outputPath: string; markdownPath: string; summaryPath: string }> {
  const { markdownPath } = await scrapeTrendshiftTopicMarkdown(url, options);
  const parsed = await extractTrendshiftRepos(markdownPath, url, {
    outputDir: options.outputDir,
  });
  return {
    ...parsed,
    markdownPath,
  };
}
