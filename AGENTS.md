# AGENTS.md

## Cursor Cloud specific instructions

### Repository structure

This is a lightweight monorepo with two independent TypeScript/Node.js projects:

| Project | Path | Package Manager | Test Framework | Dev Command |
|---------|------|----------------|---------------|-------------|
| **gitgod** (main) | `/workspace` | npm | vitest | `npx tsx src/cli.ts` |
| **workflow-agent** | `/workspace/workflow-agent` | npm | jest | `npx ts-node src/cli.ts` |

There is no workspace/monorepo tooling — each project has its own `package.json` and `node_modules`.

### Key commands

- **Root project tests:** `npm test` (runs `vitest run`, 9 test files / 45 tests)
- **Root project build:** `npm run build` (has pre-existing TS errors in unimplemented modules; tests still pass via tsx)
- **Root project dev CLI:** `npx tsx src/cli.ts <command>` (e.g. `list`, `serve`, `parse <url>`)
- **Root MCP server:** `npx tsx src/cli.ts serve` (JSON-RPC over stdio, used by Cursor)
- **workflow-agent build:** `npm run build` in `workflow-agent/` (compiles cleanly)
- **workflow-agent dev CLI:** `npx ts-node src/cli.ts <command>` in `workflow-agent/`
- **workflow-agent tests:** `npm test` in `workflow-agent/` (no test files exist yet; exits code 1)

### Non-obvious caveats

- The root `npm run build` (tsc) fails due to pre-existing errors: missing modules `map-scrape-markdown.js`, `trendshift-workflow.js`, and a type mismatch on `owner` in `SingleRepoEntry`. This does **not** block tests or dev CLI usage because both use tsx/ts-node which skip type-checking.
- The root project uses **ESM** (`"type": "module"` + NodeNext), while workflow-agent uses **CommonJS**. Import paths in root source use `.js` extensions per ESM convention.
- LLM-dependent features (synthesize, decompose, harness) require `ANTHROPIC_API_KEY` env var. Tests mock LLM calls and do not require it.
- GitHub API features benefit from `GITHUB_TOKEN` or `GH_TOKEN` to avoid rate limits, but are not required for tests.
- No databases, Docker, or background services are needed. All persistence is file-based JSON in `./data/`.
- CI runs on Node.js 22 (see `.github/workflows/ci.yml`).
