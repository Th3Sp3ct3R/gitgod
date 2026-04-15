# twitter-agent + XPOZ integration

## Decision

| Use case | Tool |
|----------|------|
| **Authenticated X actions** (post, like, RT, DM, follow, fleet campaigns, twikit workflows) | **twitter-agent** (this repo) — session cookies + twikit |
| **Read-only search at scale, CSV export, cross-platform (IG, Reddit, TikTok)** | **XPOZ** (`pip install -r requirements-optional.txt`, `XPOZ_API_KEY`) — API key, no fleet login |

**Preferred pattern:** a **Python wrapper** (or small CLI) in your app that calls `twitter-agent` for X actions and `xpoz.XpozClient` for read/search when you need hosted index + CSV or non-X platforms. Use the **XPOZ MCP server** only if your stack is MCP-first (e.g. Cursor) and you want a remote connector without embedding `xpoz` in Python.

**Rationale:** twitter-agent already owns multi-account sessions and twikit; XPOZ is complementary for stateless read APIs and bulk export. Duplicating both in MCP-only form adds ops surface without replacing fleet login.

## Environment

- `XPOZ_API_KEY` — XPOZ read API (see `.env.example`).
- `TWINT_PATH` / `TWEETS_ANALYZER_PATH` — optional; defaults under repo parent `.tmp/twitter-repos/` (see `config.py`).

## Scripts

- `scripts/smoke_fleet.sh` — `fleet-status`; profile + search if `sessions/*.cookies` exist.
- `scripts/xpoz_spike.py` — minimal `twitter.search_posts` when `XPOZ_API_KEY` is set.

## Compliance

Automation and third-party APIs may violate platform terms. Use only where permitted.
