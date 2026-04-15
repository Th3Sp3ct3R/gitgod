# Repo Analyzer → custom system prompt

This folder defines how GitGod (or any runner) builds an **Anthropic-style grounded system prompt**:

1. **Collect corpus** from the repo and pipeline artifacts (read-only).
2. **Fill** `SYSTEM_PROMPT_TEMPLATE.md` by replacing the `--- INJECTED CORPUS` block.
3. **Run** the filled prompt once (or as the first turn in a session) so the model emits `repo_brief` JSON + a `system_prompt_fragment` for downstream coding agents.

## Corpus sources (in order)

| Priority | Glob / path | Purpose |
|----------|-------------|---------|
| 1 | `README.md`, `docs/**/*.md` (top-level repo) | Human intent, scope |
| 2 | `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md` | Agent constraints |
| 3 | `package.json` / `pyproject.toml` / `Cargo.toml` (names + scripts only) | Stack signals |
| 4 | Pipeline: `**/manifest.json` (Trendshift topic manifest row) | Provenance, state |
| 5 | Pipeline: `**/knowledge-graph.json` | Taxonomy + tools |
| 6 | Pipeline: `**/decomposition.json` | Operations list |
| 7 | Pipeline: harness `**/SKILL.md`, `**/CLI_DISCOVERY_MANIFEST.md` | Executable surface |

Truncate long files (e.g. first 400 lines per file, or 8k tokens total) before injection.

## Outputs

- **Structured**: `repo_brief` — machine-readable summary for routing and retrieval.
- **Unstructured**: `system_prompt_fragment` — paste into specialist agents so they inherit repo context without re-reading the tree.

See `examples/` for two fully worked injections.

## Automated run (GitGod CLI)

After ingest, or standalone:

- `npx tsx src/cli.ts ingest <url> -d data --analyze` — ingests, then runs the analyzer (skips the LLM step with a warning if no API key is configured).
- `npx tsx src/cli.ts analyze-repo <url> -d data` — analyzer only; fails if no LLM key.

**Environment:** at least one of `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `NVIDIA_API_KEY`, or `KIMI_API_KEY` (same resolution as `src/lib/llm.ts`).

**Artifact:** `data/<owner-repo>/repo-analyzer.md` (HTML comment header + model output).

The starred-repo poller (`npm run starred:poll`) spawns ingest with `--analyze` so new stars get a briefing when keys are present.
