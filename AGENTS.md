# AGENTS.md

## Cursor Cloud specific instructions

### Overview

gitgod is a monorepo with two independent npm packages:

| Package | Path | Test Framework | Dev Command |
|---------|------|----------------|-------------|
| **gitgod** (root) | `/workspace` | vitest (`npm test`) | `npx tsx src/cli.ts` |
| **workflow-agent** | `/workspace/workflow-agent` | jest (`npm test`) — no test files currently | `node dist/cli.js` |

### Running tests

- **Root package:** `npm test` (runs `vitest run`, 9 test files, ~45 tests, all pass without API keys)
- **workflow-agent:** `npm test` in `workflow-agent/` (currently exits with code 1 because no test files exist; this is expected)

### Building

- **Root package:** `npm run build` has pre-existing TypeScript compilation errors due to missing source files (`trendshift-workflow.js`, `map-scrape-markdown.js`, `trendshift-topic.js` parser). This does **not** block running via `npx tsx src/cli.ts` (dev mode) or running tests.
- **workflow-agent:** `npm run build` compiles cleanly.

### Linting

No ESLint configuration exists in this repo. TypeScript type-checking (`npx tsc --noEmit`) can be used but has the same pre-existing errors as build.

### Running the CLI (dev mode)

- `npx tsx src/cli.ts --help` — shows all gitgod commands
- `npx tsx src/cli.ts parse <github-url>` — Stage 1: clones a repo and parses README into a skeleton
- `npx tsx src/cli.ts serve` — starts the MCP server over stdio

### Gotchas

- The `parse` command expects `README.md` (exact case). Repos with `readme.md` (lowercase) will fail with "No README.md found".
- Stages 2+ (enrich, synthesize) require `ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY` environment variable.
- The `data/` and `.tmp/` directories are created at runtime by CLI commands; they are gitignored.
- The two npm packages have separate `node_modules` — run `npm install` in both root and `workflow-agent/`.
