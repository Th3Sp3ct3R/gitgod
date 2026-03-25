---
name: mcp-master
description: "Master prompt for building and using MCP (Model Context Protocol) servers"
---

# MCP (MODEL CONTEXT PROTOCOL) - MASTER

> Complete guide to building and using MCP servers for AI agent tool extensions

---

## WHAT IS MCP?

MCP (Model Context Protocol) is a standard protocol that enables AI models to interact with external services through well-designed tools. It's like a "USB-C for AI agents" - a universal interface for extending agent capabilities.

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│    LLM      │◀───────▶│ MCP Client │◀───────▶│ MCP Server │
│ (Claude,    │         │ (Claude    │         │ (Your       │
│  Gemini)    │         │  Code)     │         │  Service)   │
└─────────────┘         └─────────────┘         └─────────────┘
                              │
                              ▼
                        ┌─────────────┐
                        │   Tools     │
                        │  Resources  │
                        │   Prompts   │
                        └─────────────┘
```

---

## MCP SERVER ARCHITECTURE

### Core Components

```python
class MCPServer:
    def __init__(self, name: str):
        self.name = name
        self.tools = {}
        self.resources = {}
        self.prompts = {}
    
    # Tools: Actions the LLM can perform
    def register_tool(self, tool: Tool):
        self.tools[tool.name] = tool
    
    # Resources: Data the LLM can access
    def register_resource(self, resource: Resource):
        self.resources[resource.uri] = resource
    
    # Prompts: Pre-built prompt templates
    def register_prompt(self, prompt: Prompt):
        self.prompts[prompt.name] = prompt
```

### Transport Options

| Transport | Use Case | Pros | Cons |
|:----------|:---------|:-----|:-----|
| **Streamable HTTP** | Remote servers | Scalable, stateless | More complex |
| **stdio** | Local servers | Simple, fast | Local only |
| **WebSocket** | Real-time apps | Bidirectional | Stateful |

**Recommendation:**
- **Remote**: Streamable HTTP (stateless, easier to scale)
- **Local**: stdio (simple, fast)

---

## BUILDING AN MCP SERVER

### Phase 1: Deep Research

#### 1.1 Understand MCP Design Principles

- **API Coverage vs Workflow Tools**: Balance comprehensive API coverage with specialized workflow tools
- **Tool Naming**: Use consistent prefixes (e.g., `github_create_issue`, `github_list_repos`)
- **Context Management**: Return focused, relevant data with pagination support
- **Error Messages**: Guide agents toward solutions with specific suggestions

#### 1.2 Study Documentation

```bash
# Key resources
https://modelcontextprotocol.io/specification/draft.md
https://modelcontextprotocol.io/sitemap.xml
```

#### 1.3 Choose Your Stack

| Language | SDK | Best For |
|:---------|:-----|:---------|
| **TypeScript** | @modelcontextprotocol/typescript-sdk | Most cases, good AI code generation |
| **Python** | mcp | Python projects, data science |
| **Go** | mcpgolang | High performance |

---

### Phase 2: Implementation

#### 2.1 Project Structure (TypeScript)

```
my-mcp-server/
├── src/
│   ├── index.ts          # Main entry point
│   ├── tools/            # Tool implementations
│   │   └── github.ts
│   ├── resources/        # Resource handlers
│   └── utils/           # Shared utilities
├── package.json
├── tsconfig.json
└── README.md
```

#### 2.2 Basic Server Setup

```typescript
import { Server } from "@modelcontextprotocol/typescript-sdk";
import { z } from "zod";

const server = new Server({
  name: "my-mcp-server",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {},
    resources: {}
  }
});

// Register a tool
server.setRequestHandler("tools/list", async () => {
  return {
    tools: [{
      name: "my_tool",
      description: "Does something useful",
      inputSchema: {
        type: "object",
        properties: {
          param1: {
            type: "string",
            description: "The first parameter"
          }
        },
        required: ["param1"]
      }
    }]
  };
});

server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === "my_tool") {
    // Execute tool logic
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ result: "success" })
      }]
    };
  }
});
```

#### 2.3 Tool Definition Best Practices

```typescript
// Good tool definition
const myTool = {
  name: "github_create_issue",
  description: "Create a new GitHub issue in a repository",
  inputSchema: z.object({
    owner: z.string().describe("Repository owner (username or organization)"),
    repo: z.string().describe("Repository name"),
    title: z.string().describe("Issue title"),
    body: z.string().optional().describe("Issue body content"),
    labels: z.array(z.string()).optional().describe("Labels to apply")
  }),
  
  // Annotations for better LLM understanding
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};
```

#### 2.4 Resource Definition

```typescript
// Resource for accessing data
const repoResource = {
  uri: "github://{owner}/{repo}/issues",
  name: "Repository Issues",
  description: "List of open issues in a repository",
  mimeType: "application/json"
};
```

---

### Phase 3: Testing

#### Using MCP Inspector

```bash
# Install and run inspector
npx @modelcontextprotocol/inspector node dist/index.js

# Test tools
npx @modelcontextprotocol/inspector --command "npm" --args "start"
```

---

## USING MCP SERVERS

### Adding to Claude Code

```bash
# Add MCP server to Claude Code
claude config add-mcp /path/to/your/server.js

# Or use npm package
claude config add-mcp npx @some/mcp-server
```

### Common MCP Servers

| Server | What it does |
|:-------|:-------------|
| **filesystem** | Read/write local files |
| **github** | GitHub API operations |
| **gitlab** | GitLab integration |
| **slack** | Slack messaging |
| **postgres** | Database queries |
| **memory** | Persistent vector memory |
| **brave-search** | Web search |

---

## AGENT MEMORY WITH MCP

### Setting Up Agent Memory

```bash
# Clone agentMemory
git clone https://github.com/webzler/agentMemory.git .agent/skills/agent-memory

# Install
cd .agent/skills/agent-memory
npm install
npm run compile

# Start server
npm run start-server my-project $(pwd)
```

### Memory Tools

| Tool | Description |
|:-----|:-------------|
| `memory_search` | Search memories by query, type, or tags |
| `memory_write` | Record new knowledge or decisions |
| `memory_read` | Retrieve specific memory by key |
| `memory_stats` | View analytics on memory usage |

### Example Usage

```python
# Search memory
memory_search({
  query: "authentication patterns",
  type: "pattern"
})

# Write memory
memory_write({
  key: "auth-v1",
  type: "decision",
  content: "Chose JWT over sessions for stateless auth",
  tags: ["auth", "security", "architecture"]
})

# Read memory
memory_read({
  key: "auth-v1"
})
```

---

## BEST PRACTICES

### 1. Tool Design
- ✅ Use clear, descriptive names with consistent prefixes
- ✅ Include detailed parameter descriptions
- ✅ Provide examples in field descriptions
- ✅ Return structured data when possible
- ✅ Use annotations (readOnlyHint, destructiveHint, etc.)

### 2. Error Handling
- ✅ Return actionable error messages
- ✅ Suggest next steps in errors
- ✅ Handle rate limits gracefully
- ✅ Log errors for debugging

### 3. Performance
- ✅ Use pagination for large results
- ✅ Cache frequently accessed data
- ✅ Implement connection pooling
- ✅ Use async/await for I/O

### 4. Security
- ✅ Never log sensitive data
- ✅ Validate all inputs
- ✅ Use environment variables for secrets
- ✅ Implement rate limiting

---

## COMMON PATTERNS

### Tool Wrapper Pattern
```typescript
class APIToolWrapper {
  constructor(private apiClient: APIClient) {}
  
  async execute(params: any): Promise<ToolResult> {
    try {
      const result = await this.apiClient.request(params);
      return { success: true, data: result };
    } catch (error) {
      return { 
        success: false, 
        error: this.formatError(error) 
      };
    }
  }
  
  private formatError(error: Error): string {
    // Return actionable error message
    return `Failed to ${this.action}: ${error.message}. Try checking API key and permissions.`;
  }
}
```

### Pagination Pattern
```typescript
async function paginateRequest(
  requestFn: (page: number) => Promise<Response>,
  maxPages: number = 10
): Promise<any[]> {
  const results = [];
  let hasMore = true;
  let page = 1;
  
  while (hasMore && page <= maxPages) {
    const response = await requestFn(page);
    results.push(...response.items);
    hasMore = response.hasMore;
    page++;
  }
  
  return results;
}
```

---

## RESOURCES

- [MCP Specification](https://modelcontextprotocol.io/specification/draft.md)
- [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Python SDK](https://github.com/modelcontextprotocol/python-sdk)
- [MCP Best Practices](./reference/mcp_best_practices.md)
