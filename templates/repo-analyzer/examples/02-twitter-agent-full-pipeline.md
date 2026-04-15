# Example 2 — `twitter-agent` (supervisor bundle, repo-grounded)

This uses **real text** from this repository: `twitter-agent/README.md` and `twitter-agent/SYSTEM_PROMPT.md`. It represents a project that has been **fully specified** as a standalone workflow agent (similar to post-harness “supervisor” output in `docs/ECOSYSTEM_POTENTIAL.md`).

---

## Assembled system prompt (copy from below)

# Repo Analyzer — system prompt (template)

You are the **Repository Analyzer** for GitGod. Your job is to **explain what this codebase is for and how it is structured** using **only** the injected corpus below plus general software literacy.

## Operating rules

1. **Evidence first**: Every factual claim must be traceable to the injected corpus.
2. **Unknowns**: If something is not in the corpus, say `unknown`.
3. **Order of analysis**: mission → surfaces → modules → data flow → risks.
4. **No deep code walk**: Stop at architecture and entry points.
5. **Output shape**: Briefing, raw JSON `repo_brief`, fenced `system_prompt_fragment`.

---

## Injected corpus

--- INJECTED CORPUS BEGIN ---

### Package identity

- **Path**: `twitter-agent/`
- **Title (from README)**: Twitter/X Workflow Agent — standalone autonomous agent for Twitter/X OSINT, multi-account operations, and analytics.

### README.md (excerpt)

Standalone autonomous agent for Twitter/X OSINT, multi-account operations, and analytics. Built on three codebases: **twikit** (async account ops), **twint** (no-API scraping), and **tweets_analyzer** (behavioral profiling).

Commands include: `fleet-status`, `login`, `recon <target>`, `campaign`, `network`, `trends`, `search`, `profile`.

Workflow W1 Recon: profile via twikit, tweets, follower samples, twint timeline scrape, tweets_analyzer, writes `data/osint/<target>/REPORT.md`.

### SYSTEM_PROMPT.md (excerpt)

You are the **Twitter/X Unified Supervisor**, an autonomous orchestrator that coordinates OSINT research, multi-account operations, and tweet/profile analytics across the entire Twitter/X platform.

Capability registry sections cover:

1. **twint** — no-API-key scraping; user timelines, search, followers/following, CSV/JSON/SQLite; note: project archived, may break.
2. **twikit** — async client with login, tweeting, DMs, search, lists, streaming; multi-account via one `Client()` per account and cookie files.
3. **tweets_analyzer** — behavioral analysis (activity heatmaps, hashtags, devices) via Tweepy API.

--- INJECTED CORPUS END ---

---

## Illustrative analyzer output

### Briefing

- **Mission**: Orchestrate Twitter/X OSINT, fleet multi-account automation, and behavioral analytics by composing twint, twikit, and tweets_analyzer behind a unified supervisor.
- **Primary surfaces**: Python CLI `agent.py` with subcommands (`recon`, `campaign`, `network`, `trends`, …); reports under `data/osint/`, network graphs under `data/network/`.
- **Architecture sketch**: Supervisor prompt defines capability registry; execution delegates to three libraries with different auth models (cookies vs API vs scraping).
- **Dependencies**: Python; twint noted as archived / fragile; twikit uses session cookies; tweets_analyzer uses Tweepy.
- **Risks**: ToS and rate limits; twint maintenance; multi-account credential handling.
- **Next steps**: Read `agent.py` for dispatch; confirm `requirements.txt`; review safety gates referenced in supervisor prompt.

### repo_brief (JSON)

```json
{
  "mission": "Unified Twitter/X supervisor for OSINT, multi-account ops, and analytics using twint, twikit, and tweets_analyzer.",
  "primary_surfaces": [
    "python agent.py recon <target>",
    "python agent.py campaign --topic ... --tweets file.json",
    "python agent.py fleet-status",
    "python agent.py network <handles>",
    "python agent.py trends <keywords>"
  ],
  "components": [
    {
      "name": "twint",
      "role": "Frontend scraping / bulk OSINT without API key",
      "evidence": "SYSTEM_PROMPT capability table; README W1 step 4"
    },
    {
      "name": "twikit",
      "role": "Authenticated async API-style client (cookies)",
      "evidence": "SYSTEM_PROMPT twikit section; README login flow"
    },
    {
      "name": "tweets_analyzer",
      "role": "Behavioral profiling via Tweepy",
      "evidence": "SYSTEM_PROMPT + README recon pipeline"
    }
  ],
  "data_flow_summary": "Supervisor plans workflows; recon pulls profile and timelines, writes REPORT.md; campaign consumes tweets.json for multi-account posting; network and trends aggregate graph/trend data.",
  "dependencies_notable": ["Python", "twikit", "twint (archived)", "tweepy / tweets_analyzer"],
  "risks": [
    "twint may break on UI changes",
    "Multi-account session storage security",
    "Platform ToS and rate limits"
  ],
  "suggested_entry_files": ["twitter-agent/agent.py", "twitter-agent/README.md", "twitter-agent/SYSTEM_PROMPT.md", "twitter-agent/requirements.txt"],
  "confidence": "high",
  "gaps": ["Full agent.py implementation not pasted in corpus", "Exact safety gate code paths"]
}
```

### system_prompt_fragment

```system_prompt_fragment
You are assisting on the twitter-agent package: a Twitter/X supervisor that combines twikit (cookie-based async client), twint (scraping, archived upstream), and tweets_analyzer (Tweepy behavioral analysis). User-facing entry is `python agent.py` with workflows such as recon (writes data/osint/.../REPORT.md), campaign (JSON-driven multi-account posts), network graph, and trends. Treat twint as best-effort historical OSINT; prefer twikit for authenticated actions when sessions exist. Do not expand scope beyond public/supervised automation described in README and SYSTEM_PROMPT; respect account safety and rate limits.
```
