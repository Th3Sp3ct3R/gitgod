/**
 * Firecrawl Method Router for gitgod pipeline
 *
 * Two-phase classification:
 *   Phase 1 (pre-scrape):  URL patterns + domain signals → which Firecrawl method
 *   Phase 2 (post-scrape): existing content-classifier → storage format
 *
 * Methods and costs:
 *   map:      1 credit flat. Discover all URLs on a domain.
 *   scrape:   1 credit/page. Static HTML → clean markdown/html.
 *   batch:    1 credit/page. Same as scrape but concurrent for 3+ URLs.
 *   crawl:    1 credit/page. Recursive link following for deep doc sites.
 *   interact: 2-7 credits/min. Playwright browser for SPAs, auth-gated, JS-heavy.
 *   bypass:   0 credits. Domain serves /llms-full.txt — skip Firecrawl entirely.
 *
 * Install: npm install firecrawl  (official JS SDK; legacy alias firecrawl-js → use `firecrawl`)
 * Env:     FIRECRAWL_API_KEY=fc-...
 */

import Firecrawl from "firecrawl";
import {
  countLayoutOnlyUrls,
  extractLayoutLinkSets,
  mergeMapWithLayoutLinks,
} from "./site-layout-map.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type FirecrawlMethod =
  | "MAP"
  | "SCRAPE"
  | "BATCH_SCRAPE"
  | "CRAWL"
  | "INTERACT"
  | "SEARCH"
  | "LLMS_TXT_BYPASS";

export interface MethodDecision {
  method: FirecrawlMethod;
  reason: string;
  estimatedCredits: number | null;
  pageEstimate?: number;
}

/** After map + layout scrape: how many nav/header/footer-only URLs were merged in. */
export interface MapLayoutSummary {
  seedUrl: string;
  headerLinkCount: number;
  navLinkCount: number;
  footerLinkCount: number;
  /** URLs present in header/nav/footer but not in Firecrawl map() alone */
  urlsAddedFromLayout: number;
  layoutScrapeCredits: number;
}

export interface MapResult {
  domain: string;
  urls: Array<{ url: string; title?: string; description?: string }>;
  totalFound: number;
  mappedAt: string;
  /** Set when mapDomainWithLayout runs: header/nav/footer extraction merged into urls */
  layout?: MapLayoutSummary;
}

export interface ScrapeResult {
  url: string;
  method: FirecrawlMethod;
  markdown?: string;
  html?: string;
  metadata?: Record<string, unknown>;
  interactOutput?: string;
  rawContent?: string;
  success: boolean;
  error?: string;
  creditsUsed: number;
}

export interface DomainPlan {
  domain: string;
  mapResult: MapResult;
  groups: Map<FirecrawlMethod, string[]>;
  estimatedCredits: number;
}

export type LlmsTxtCacheEntry = { found: boolean; url?: string };

// ─── Client ──────────────────────────────────────────────────────────────────

let _client: InstanceType<typeof Firecrawl> | null = null;

function getClient(): InstanceType<typeof Firecrawl> {
  if (!_client) {
    const key = process.env.FIRECRAWL_API_KEY;
    if (!key) throw new Error("Missing FIRECRAWL_API_KEY env var");
    _client = new Firecrawl({ apiKey: key });
  }
  return _client;
}

// ─── Pre-Scrape URL Classification ──────────────────────────────────────────

const SPA_SIGNALS: Array<(url: URL) => boolean> = [
  (u) => u.hash.length > 1 && u.hash !== "#",
  (u) => /\/(app|dashboard|console|portal|admin|panel)\//i.test(u.pathname),
  (u) => /\.(vercel|netlify)\.app$/.test(u.hostname),
  (u) => /\/(~|_next|__nuxt)\//i.test(u.pathname),
];

export function preClassifyUrl(
  url: string,
  mapResult: MapResult | null,
  llmsTxtAvailable: boolean,
): MethodDecision {
  if (llmsTxtAvailable) {
    return {
      method: "LLMS_TXT_BYPASS",
      reason: "Domain serves llms.txt — free bypass",
      estimatedCredits: 0,
    };
  }

  const u = new URL(url);

  // SPA / dynamic → Interact
  const spaHits = SPA_SIGNALS.filter((fn) => fn(u)).length;
  if (spaHits >= 1) {
    return {
      method: "INTERACT",
      reason: `SPA signals (${spaHits} hits): needs browser`,
      estimatedCredits: 7,
    };
  }

  // Deep doc site → Crawl
  if (mapResult) {
    const pathPrefix = u.pathname.replace(/\/[^/]*$/, "");
    const samePrefixPages = mapResult.urls.filter((l) => {
      try {
        return new URL(l.url).pathname.startsWith(pathPrefix);
      } catch {
        return false;
      }
    }).length;

    if (samePrefixPages >= 10) {
      return {
        method: "CRAWL",
        reason: `${samePrefixPages} pages under ${pathPrefix}`,
        estimatedCredits: samePrefixPages,
        pageEstimate: samePrefixPages,
      };
    }
  }

  // Default → Scrape
  return {
    method: "SCRAPE",
    reason: "Static page — standard scrape",
    estimatedCredits: 1,
  };
}

// ─── Map ─────────────────────────────────────────────────────────────────────

export async function mapDomain(
  domain: string,
  options?: { search?: string; limit?: number },
): Promise<MapResult> {
  const client = getClient();
  const result = await client.map(domain, {
    limit: options?.limit ?? 5000,
    ...(options?.search ? { search: options.search } : {}),
  });

  const links = result?.links ?? [];
  return {
    domain,
    urls: links.map((l) => ({
      url: l.url,
      title: l.title,
      description: l.description,
    })),
    totalFound: links.length,
    mappedAt: new Date().toISOString(),
  };
}

/**
 * Firecrawl map(domain) plus one HTML scrape of a seed page to collect same-origin
 * links from header, nav, footer, and ARIA landmarks — merged into urls (map-first,
 * layout fills gaps and tags overlapping URLs with layout:* in description).
 *
 * Costs: 1 map credit + 1 scrape credit (unless skipLayout).
 */
export async function mapDomainWithLayout(
  origin: string,
  options?: {
    limit?: number;
    search?: string;
    layoutSeedUrl?: string;
    /** Skip header/nav/footer scrape (map only). */
    skipLayout?: boolean;
  },
): Promise<MapResult> {
  const mapResult = await mapDomain(origin, options);
  if (options?.skipLayout) return mapResult;

  let seed = options?.layoutSeedUrl?.trim();
  if (!seed) seed = `${origin.replace(/\/$/, "")}/`;
  try {
    new URL(seed);
  } catch {
    console.warn(`  ⚠️ Invalid layout seed URL, using ${origin}/`);
    seed = `${origin.replace(/\/$/, "")}/`;
  }

  const scrape = await executeScrape(seed);
  if (!scrape.success || !scrape.html) {
    console.warn(`  ⚠️ Layout link scrape failed (${seed}): ${scrape.error ?? "no html"} — using map only`);
    return mapResult;
  }

  const layout = extractLayoutLinkSets(scrape.html, seed);
  const merged = mergeMapWithLayoutLinks(mapResult.urls, layout);
  const urlsAddedFromLayout = countLayoutOnlyUrls(mapResult.urls, merged);

  console.log(
    `     Layout (${seed}): header ${layout.header.length} · nav ${layout.nav.length} · footer ${layout.footer.length} · +${urlsAddedFromLayout} URL(s) not in map alone`,
  );

  return {
    domain: mapResult.domain,
    urls: merged,
    totalFound: merged.length,
    mappedAt: mapResult.mappedAt,
    layout: {
      seedUrl: seed,
      headerLinkCount: layout.header.length,
      navLinkCount: layout.nav.length,
      footerLinkCount: layout.footer.length,
      urlsAddedFromLayout,
      layoutScrapeCredits: scrape.creditsUsed,
    },
  };
}

// ─── Scrape ──────────────────────────────────────────────────────────────────

export async function executeScrape(url: string): Promise<ScrapeResult> {
  const client = getClient();
  try {
    const result = await client.scrape(url, { formats: ["markdown", "html"] });
    return {
      url,
      method: "SCRAPE",
      markdown: result?.markdown,
      html: result?.html,
      metadata: result?.metadata as Record<string, unknown> | undefined,
      success: true,
      creditsUsed: 1,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { url, method: "SCRAPE", success: false, error: message, creditsUsed: 0 };
  }
}

// ─── Batch Scrape ────────────────────────────────────────────────────────────

export async function executeBatchScrape(urls: string[]): Promise<ScrapeResult[]> {
  const client = getClient();
  try {
    const job = await client.batchScrape(urls, {
      options: { formats: ["markdown", "html"] },
    });
    const data = job?.data ?? [];
    return data.map((page, i) => ({
      url: urls[i] ?? (page.metadata?.sourceURL as string) ?? "unknown",
      method: "BATCH_SCRAPE" as FirecrawlMethod,
      markdown: page.markdown,
      html: page.html,
      metadata: page.metadata as Record<string, unknown> | undefined,
      success: true,
      creditsUsed: 1,
    }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return urls.map((url) => ({
      url,
      method: "BATCH_SCRAPE" as FirecrawlMethod,
      success: false,
      error: message,
      creditsUsed: 0,
    }));
  }
}

// ─── Crawl ───────────────────────────────────────────────────────────────────

export async function executeCrawl(
  url: string,
  options?: { limit?: number; includePaths?: string[] },
): Promise<ScrapeResult[]> {
  const client = getClient();
  try {
    const result = await client.crawl(url, {
      limit: options?.limit ?? 100,
      scrapeOptions: { formats: ["markdown", "html"] },
      ...(options?.includePaths ? { includePaths: options.includePaths } : {}),
    });
    const data = result?.data ?? [];
    return data.map((page) => ({
      url: (page.metadata?.sourceURL as string) ?? "unknown",
      method: "CRAWL" as FirecrawlMethod,
      markdown: page.markdown,
      html: page.html,
      metadata: page.metadata as Record<string, unknown> | undefined,
      success: true,
      creditsUsed: 1,
    }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return [{ url, method: "CRAWL" as FirecrawlMethod, success: false, error: message, creditsUsed: 0 }];
  }
}

// ─── Interact ────────────────────────────────────────────────────────────────

export async function executeInteract(
  url: string,
  extractionPrompt?: string,
): Promise<ScrapeResult> {
  const client = getClient();
  try {
    const scrapeResult = await client.scrape(url, { formats: ["markdown", "html"] });
    const scrapeId = scrapeResult.metadata?.scrapeId;

    if (!scrapeId) {
      return {
        url,
        method: "INTERACT",
        markdown: scrapeResult.markdown,
        html: scrapeResult.html,
        metadata: scrapeResult.metadata as Record<string, unknown> | undefined,
        success: true,
        creditsUsed: 1,
      };
    }

    const prompt =
      extractionPrompt ?? "Extract the main content. Open all tabs, accordions, expandable sections.";
    const interactResult = await client.interact(scrapeId, { prompt });

    await client.stopInteraction(scrapeId);

    return {
      url,
      method: "INTERACT",
      markdown: scrapeResult.markdown,
      html: scrapeResult.html,
      metadata: scrapeResult.metadata as Record<string, unknown> | undefined,
      interactOutput: interactResult.output ?? interactResult.result,
      success: true,
      creditsUsed: 8,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { url, method: "INTERACT", success: false, error: message, creditsUsed: 0 };
  }
}

// ─── Domain Planning (orchestrator) ──────────────────────────────────────────

export async function buildDomainPlans(
  urls: string[],
  llmsTxtCache: Map<string, LlmsTxtCacheEntry>,
): Promise<DomainPlan[]> {
  const domainGroups = new Map<string, string[]>();
  for (const url of urls) {
    try {
      const domain = new URL(url).origin;
      if (!domainGroups.has(domain)) domainGroups.set(domain, []);
      domainGroups.get(domain)!.push(url);
    } catch {
      console.warn(`  ⚠️ Invalid URL: ${url}`);
    }
  }

  const plans: DomainPlan[] = [];

  for (const [domain, domainUrls] of domainGroups) {
    console.log(`  🗺️ Mapping ${domain} (${domainUrls.length} URLs)...`);
    const layoutSeed =
      domainUrls.find((u) => {
        try {
          return new URL(u).origin === domain;
        } catch {
          return false;
        }
      }) ?? `${domain}/`;
    const mapResult = await mapDomainWithLayout(domain, { layoutSeedUrl: layoutSeed });
    console.log(`     Found ${mapResult.totalFound} total pages (map + header/nav/footer)`);

    const hasLlmsTxt = llmsTxtCache.get(domain)?.found ?? false;

    const groups = new Map<FirecrawlMethod, string[]>();
    let totalCredits = 1 + (mapResult.layout ? mapResult.layout.layoutScrapeCredits : 0); // map + layout seed scrape

    for (const url of domainUrls) {
      const decision = preClassifyUrl(url, mapResult, hasLlmsTxt);
      if (!groups.has(decision.method)) groups.set(decision.method, []);
      groups.get(decision.method)!.push(url);
      totalCredits += decision.estimatedCredits ?? 0;
    }

    const scrapeUrls = groups.get("SCRAPE");
    if (scrapeUrls && scrapeUrls.length >= 3) {
      groups.delete("SCRAPE");
      groups.set("BATCH_SCRAPE", scrapeUrls);
    }

    plans.push({ domain, mapResult, groups, estimatedCredits: totalCredits });

    for (const [method, methodUrls] of groups) {
      console.log(`     ${method}: ${methodUrls.length} URLs`);
    }
    console.log(`     Estimated: ~${totalCredits} credits`);
  }

  return plans;
}

// ─── Execution Engine ────────────────────────────────────────────────────────

export async function executePlans(
  plans: DomainPlan[],
  fetchLlmsTxt: (domain: string) => Promise<string | null>,
): Promise<ScrapeResult[]> {
  const all: ScrapeResult[] = [];

  for (const plan of plans) {
    for (const [method, urls] of plan.groups) {
      switch (method) {
        case "LLMS_TXT_BYPASS": {
          for (const url of urls) {
            const content = await fetchLlmsTxt(new URL(url).origin);
            all.push({
              url,
              method: "LLMS_TXT_BYPASS",
              rawContent: content ?? undefined,
              success: !!content,
              error: content ? undefined : "llms.txt fetch failed",
              creditsUsed: 0,
            });
          }
          break;
        }
        case "SCRAPE": {
          for (const url of urls) {
            console.log(`  📄 Scraping: ${url}`);
            all.push(await executeScrape(url));
          }
          break;
        }
        case "BATCH_SCRAPE": {
          console.log(`  📦 Batch scraping ${urls.length} URLs on ${plan.domain}...`);
          all.push(...(await executeBatchScrape(urls)));
          break;
        }
        case "CRAWL": {
          console.log(`  🕷️ Crawling from ${urls[0]} (est. ${urls.length} pages)...`);
          all.push(...(await executeCrawl(urls[0]!, { limit: urls.length + 20 })));
          break;
        }
        case "INTERACT": {
          for (const url of urls) {
            console.log(`  🎭 Interacting: ${url}`);
            all.push(await executeInteract(url));
          }
          break;
        }
      }
    }
  }

  return all;
}
