import { loadGraphs, type GraphIndex } from "./loader.js";
import { listGraphs } from "./tools/list-graphs.js";
import { getStats } from "./tools/stats.js";
import { ask } from "./tools/ask.js";
import { find } from "./tools/find.js";
import { compare } from "./tools/compare.js";
import { recommend } from "./tools/recommend.js";
import { ingestHarness } from "./tools/ingest.js";
import { invokeHarnessCommand } from "./tools/invoke.js";
import { researchMergeTool } from "./tools/research-merge-mcp.js";
import { scrapeWebTool, starPollRunTool, starPollStatus } from "./tools/backend-mcp.js";
import { exaAnswerTool, exaContentsTool, exaSearchTool } from "./tools/exa-mcp.js";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

const TOOL_DEFINITIONS = [
  {
    name: "ask",
    description: "Ask a natural language question about tools in the knowledge graph. Searches all graphs and returns ranked results.",
    inputSchema: {
      type: "object" as const,
      properties: {
        question: { type: "string", description: "Natural language question" },
        max_results: { type: "number", description: "Max results (default 5)" },
        graph: { type: "string", description: "Restrict to one graph slug" },
      },
      required: ["question"],
    },
  },
  {
    name: "find",
    description: "Structured search with filters. Filter by tags, category, relevance score, link type, and name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tags: { type: "array", items: { type: "string" }, description: "Match ANY of these tags" },
        tags_all: { type: "array", items: { type: "string" }, description: "Match ALL of these tags" },
        category: { type: "string", description: "Category path substring" },
        min_score: { type: "number", description: "Minimum relevance score (1-5)" },
        max_score: { type: "number", description: "Maximum relevance score (1-5)" },
        link_type: { type: "string", description: "github, website, or api" },
        name: { type: "string", description: "Substring match on tool name" },
        graph: { type: "string", description: "Restrict to one graph slug" },
        limit: { type: "number", description: "Results per page (default 20)" },
        offset: { type: "number", description: "Pagination offset" },
      },
    },
  },
  {
    name: "compare",
    description: "Compare 2+ tools side by side. Shows shared tags, unique tags, and detailed metadata.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tools: { type: "array", items: { type: "string" }, description: "Tool names to compare (min 2)" },
      },
      required: ["tools"],
    },
  },
  {
    name: "recommend",
    description: "Get tool recommendations for a specific use case. Returns ranked suggestions with rationale.",
    inputSchema: {
      type: "object" as const,
      properties: {
        use_case: { type: "string", description: "Description of what you need" },
        max: { type: "number", description: "Max recommendations (default 5)" },
        exclude: { type: "array", items: { type: "string" }, description: "Tool names to exclude" },
        prefer_tags: { type: "array", items: { type: "string" }, description: "Boost tools with these tags" },
        graph: { type: "string", description: "Restrict to one graph slug" },
      },
      required: ["use_case"],
    },
  },
  {
    name: "list_graphs",
    description: "List all imported knowledge graphs with statistics.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "stats",
    description: "Get aggregate statistics across all knowledge graphs. Dashboard data.",
    inputSchema: {
      type: "object" as const,
      properties: {
        graph: { type: "string", description: "Stats for one graph only" },
      },
    },
  },
  {
    name: "ingest",
    description: "Ingest a generated harness JSON/SKILL.md payload into the knowledge graph.",
    inputSchema: {
      type: "object" as const,
      properties: {
        slug: { type: "string", description: "Repository slug for the graph entry" },
        harness_json_path: {
          type: "string",
          description: "Optional path to a harness cache json file. Defaults to data/harnesses/<slug>.json",
        },
      },
      required: ["slug"],
    },
  },
  {
    name: "invoke",
    description: "Invoke an allowlisted command from a generated harness cache.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tool: { type: "string", description: "Harness slug, e.g. instagrowth-saas" },
        command: { type: "string", description: "CLI command id or name to execute" },
        args: {
          type: "object",
          description: "CLI arg object, e.g. { \"--env\": \"staging\" }",
        },
      },
      required: ["tool", "command"],
    },
  },
  {
    name: "research_merge",
    description:
      "Merge Firecrawl web search and `gh search repos` into one markdown report plus structured hits. Requires FIRECRAWL_API_KEY for web search (unless skip_firecrawl) and `gh` on PATH for GitHub (unless skip_gh).",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        firecrawl_limit: { type: "number", description: "Max Firecrawl web results (default 10)" },
        gh_limit: { type: "number", description: "Max gh repo results (default 15)" },
        skip_firecrawl: { type: "boolean", description: "Skip Firecrawl even if key is set" },
        skip_gh: { type: "boolean", description: "Skip GitHub CLI search" },
        fc_categories: {
          type: "array",
          items: { type: "string" },
          description: "Firecrawl category bias: github, research, pdf",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "scrape_web",
    description:
      "Fetch page content via Firecrawl: single-page scrape (default) or shallow crawl from a seed URL. Requires FIRECRAWL_API_KEY. Large markdown is truncated.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "HTTP(S) URL to scrape or crawl from" },
        mode: {
          type: "string",
          enum: ["scrape", "crawl"],
          description: "scrape = one page; crawl = follow links up to crawl_limit (default 50)",
        },
        crawl_limit: { type: "number", description: "Max pages when mode is crawl (default 50, max 500)" },
        max_markdown_chars: {
          type: "number",
          description: "Max markdown characters per page (default 80000, cap 200000)",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "star_poll_status",
    description:
      "Read GitHub star poller state (repos + optional star lists). Path: STARRED_STATE_FILE env or <dataDir>/github-starred-state.json.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "star_poll_run",
    description:
      "Run scripts/poll-github-starred.ts from cwd via npx tsx (diff stars/lists, optional POST to STARWEBHOOK_URL). Use dry_run to print actions without writing state or POSTing. Requires repo root cwd; set GITHUB_TOKEN for live GitHub API.",
    inputSchema: {
      type: "object" as const,
      properties: {
        dry_run: { type: "boolean", description: "Pass --dry-run (no POST, no state write)" },
        init: { type: "boolean", description: "Pass --init (re-baseline state)" },
        verbose: { type: "boolean", description: "Pass --verbose" },
      },
    },
  },
  {
    name: "exa_search",
    description:
      "Exa semantic web search (POST /search). Optional freshness (day|week|month|year) maps to recent publish dates. Requires EXA_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        numResults: { type: "number", description: "Max results 1–100 (default 10)" },
        freshness: {
          type: "string",
          enum: ["day", "week", "month", "year"],
          description: "Prefer pages published after now minus this window",
        },
        type: { type: "string", description: "Exa search type (e.g. auto, neural, fast, deep, instant)" },
        category: { type: "string", description: "Optional category (e.g. news, company, people)" },
        includeHighlights: { type: "boolean", description: "Request highlight snippets (default true)" },
        highlightsMaxCharacters: { type: "number", description: "Per-result highlight cap when includeHighlights is true" },
      },
      required: ["query"],
    },
  },
  {
    name: "exa_contents",
    description:
      "Exa URL contents / crawl (POST /contents): clean text for one or more URLs. Requires EXA_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        urls: { type: "array", items: { type: "string" }, description: "HTTP(S) URLs to fetch" },
        maxCharacters: { type: "number", description: "Max characters per page text (default 10000)" },
      },
      required: ["urls"],
    },
  },
  {
    name: "exa_answer",
    description:
      "Exa answer with citations (POST /answer): LLM-generated answer from web search results. Requires EXA_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Question or topic" },
        text: { type: "boolean", description: "Include full text on citation objects (default true)" },
      },
      required: ["query"],
    },
  },
];

export async function handleRequest(
  req: JsonRpcRequest,
  index: GraphIndex,
  dataDir: string
): Promise<JsonRpcResponse> {
  const { id, method, params } = req;

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "gitgod", version: "0.1.0" },
        capabilities: { tools: {} },
      },
    };
  }

  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOL_DEFINITIONS } };
  }

  if (method === "tools/call") {
    const toolName = (params as { name: string }).name;
    const args = (params as { arguments: Record<string, unknown> }).arguments || {};

    try {
      let result: unknown;
      switch (toolName) {
        case "ask":
          result = ask(index, args as unknown as Parameters<typeof ask>[1]);
          break;
        case "find":
          result = find(index, args as unknown as Parameters<typeof find>[1]);
          break;
        case "compare":
          result = compare(index, args as unknown as Parameters<typeof compare>[1]);
          break;
        case "recommend":
          result = recommend(index, args as unknown as Parameters<typeof recommend>[1]);
          break;
        case "list_graphs":
          result = listGraphs(index);
          break;
        case "stats":
          result = getStats(index, args as unknown as Parameters<typeof getStats>[1]);
          break;
        case "ingest":
          result = ingestHarness(dataDir, args as unknown as Parameters<typeof ingestHarness>[1]);
          break;
        case "invoke":
          result = invokeHarnessCommand(
            dataDir,
            args as unknown as Parameters<typeof invokeHarnessCommand>[1]
          );
          break;
        case "research_merge":
          result = await researchMergeTool(
            args as unknown as Parameters<typeof researchMergeTool>[0]
          );
          break;
        case "scrape_web":
          result = await scrapeWebTool(
            args as unknown as Parameters<typeof scrapeWebTool>[0]
          );
          break;
        case "star_poll_status":
          result = starPollStatus(dataDir);
          break;
        case "star_poll_run":
          result = starPollRunTool(
            args as unknown as Parameters<typeof starPollRunTool>[0]
          );
          break;
        case "exa_search":
          result = await exaSearchTool(args as unknown as Parameters<typeof exaSearchTool>[0]);
          break;
        case "exa_contents":
          result = await exaContentsTool(args as unknown as Parameters<typeof exaContentsTool>[0]);
          break;
        case "exa_answer":
          result = await exaAnswerTool(args as unknown as Parameters<typeof exaAnswerTool>[0]);
          break;
        default:
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Unknown tool: ${toolName}` },
          };
      }

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        },
      };
    } catch (err) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32603,
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }
  }

  if (method === "notifications/initialized") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Unknown method: ${method}` },
  };
}

export function startServer(dataDir: string): void {
  let index = loadGraphs(dataDir);
  let buffer = "";

  process.stdin.on("data", (chunk) => {
    buffer += chunk.toString();

    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        // Try newline-delimited JSON fallback
        const nlIndex = buffer.indexOf("\n");
        if (nlIndex === -1) break;
        const line = buffer.slice(0, nlIndex).trim();
        buffer = buffer.slice(nlIndex + 1);
        if (!line) continue;
        processLine(line);
        continue;
      }

      const header = buffer.slice(0, headerEnd);
      const contentLengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!contentLengthMatch) {
        // Skip malformed header
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(contentLengthMatch[1], 10);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + contentLength) break;

      const body = buffer.slice(bodyStart, bodyStart + contentLength);
      buffer = buffer.slice(bodyStart + contentLength);

      processLine(body);
    }
  });

  function processLine(line: string) {
    let req: JsonRpcRequest;
    try {
      req = JSON.parse(line);
    } catch {
      const errResponse: JsonRpcResponse = {
        jsonrpc: "2.0",
        id: 0,
        error: { code: -32700, message: "Parse error" },
      };
      sendResponse(errResponse);
      return;
    }

    // Hot-reload: re-scan data directory
    index = loadGraphs(dataDir);

    void handleRequest(req, index, dataDir).then((response) => {
      if (req.id !== undefined) {
        sendResponse(response);
      }
    });
  }

  function sendResponse(res: JsonRpcResponse) {
    const json = JSON.stringify(res);
    const msg = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;
    process.stdout.write(msg);
  }
}
