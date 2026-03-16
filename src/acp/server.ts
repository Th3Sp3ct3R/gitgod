import { loadGraphs, type GraphIndex } from "./loader.js";
import { listGraphs } from "./tools/list-graphs.js";
import { getStats } from "./tools/stats.js";
import { ask } from "./tools/ask.js";
import { find } from "./tools/find.js";
import { compare } from "./tools/compare.js";
import { recommend } from "./tools/recommend.js";

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
];

export function handleRequest(req: JsonRpcRequest, index: GraphIndex): JsonRpcResponse {
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
          result = ask(index, args as Parameters<typeof ask>[1]);
          break;
        case "find":
          result = find(index, args as Parameters<typeof find>[1]);
          break;
        case "compare":
          result = compare(index, args as Parameters<typeof compare>[1]);
          break;
        case "recommend":
          result = recommend(index, args as Parameters<typeof recommend>[1]);
          break;
        case "list_graphs":
          result = listGraphs(index);
          break;
        case "stats":
          result = getStats(index, args as Parameters<typeof getStats>[1]);
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

    const response = handleRequest(req, index);

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
