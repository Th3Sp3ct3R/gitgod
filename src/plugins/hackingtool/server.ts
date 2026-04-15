import { createEngine, type HackingtoolEngine } from "./engine.js";
import { DISCLAIMER_SHORT } from "./disclaimer.js";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

const TOOL_DEFINITIONS = [
  {
    name: "security_search",
    description: `NLP search across 158 security tools from z4nzu/hackingtool. ${DISCLAIMER_SHORT}`,
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query (e.g. 'port scanner', 'wifi cracking')" },
        max_results: { type: "number", description: "Max results (default 10)" },
      },
      required: ["query"],
    },
  },
  {
    name: "security_browse",
    description: "Browse security tools by attack phase / category.",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: { type: "string", description: "Category name filter (optional, e.g. 'Web Attack')" },
      },
    },
  },
  {
    name: "security_recommend",
    description: "Get tool recommendations for a specific security use case.",
    inputSchema: {
      type: "object" as const,
      properties: {
        use_case: { type: "string", description: "What you need (e.g. 'subdomain enumeration')" },
        max: { type: "number", description: "Max recommendations (default 5)" },
        prefer_tags: { type: "array", items: { type: "string" }, description: "Boost tools with these tags" },
      },
      required: ["use_case"],
    },
  },
  {
    name: "security_compare",
    description: "Side-by-side comparison of 2+ security tools.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tools: { type: "array", items: { type: "string" }, description: "Tool names to compare (min 2)" },
      },
      required: ["tools"],
    },
  },
  {
    name: "security_stats",
    description: "Dashboard: tool counts, score distribution, languages, top tools across the security toolkit.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "security_categories",
    description: "List all 20 security tool categories with counts and top tools.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

function handleToolCall(engine: HackingtoolEngine, toolName: string, args: Record<string, unknown>): unknown {
  switch (toolName) {
    case "security_search": {
      const query = args.query as string;
      const maxResults = (args.max_results as number) || 10;
      const results = engine.search(query, maxResults);
      return results.map((t) => ({
        name: t.name,
        url: t.url,
        summary: t.summary,
        relevance_score: t.relevance_score,
        tags: t.tags,
        category: t.categoryPath,
        github_stars: t.github_stars,
      }));
    }

    case "security_browse": {
      const category = args.category as string | undefined;
      return engine.browse(category);
    }

    case "security_recommend": {
      const useCase = args.use_case as string;
      const max = args.max as number | undefined;
      const preferTags = args.prefer_tags as string[] | undefined;
      return engine.recommend(useCase, { max, preferTags });
    }

    case "security_compare": {
      const tools = args.tools as string[];
      return engine.compare(tools);
    }

    case "security_stats":
      return engine.stats();

    case "security_categories":
      return engine.categories();

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

function handleRequest(req: JsonRpcRequest, engine: HackingtoolEngine): JsonRpcResponse {
  const { id, method, params } = req;

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "hackingtool", version: "0.1.0" },
        capabilities: { tools: {} },
      },
    };
  }

  if (method === "notifications/initialized") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOL_DEFINITIONS } };
  }

  if (method === "tools/call") {
    const toolName = (params as { name: string }).name;
    const args = (params as { arguments: Record<string, unknown> }).arguments || {};

    try {
      const result = handleToolCall(engine, toolName, args);
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

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Unknown method: ${method}` },
  };
}

export function startHackingtoolServer(dataDir: string): void {
  let engine = createEngine(dataDir);
  let buffer = "";

  process.stdin.on("data", (chunk) => {
    buffer += chunk.toString();

    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
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

    // Hot-reload engine on each request
    engine = createEngine(dataDir);

    const response = handleRequest(req, engine);

    if (req.id !== undefined) {
      sendResponse(response);
    }
  }

  function sendResponse(res: JsonRpcResponse) {
    const json = JSON.stringify(res);
    const msg = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;
    process.stdout.write(msg);
  }
}
