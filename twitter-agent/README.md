# Twitter/X Workflow Agent

Standalone autonomous agent for Twitter/X OSINT, multi-account operations, and analytics. Built on three battle-tested codebases: **twikit** (async account ops), **twint** (no-API scraping), and **tweets_analyzer** (behavioral profiling).

## Quick Start

```bash
cd twitter-agent
pip install -r requirements.txt

# Add your first account
python agent.py login myhandle myemail@gmail.com mypassword

# Check fleet status
python agent.py fleet-status
```

## Commands

| Command | What it does |
|---------|-------------|
| `fleet-status` | Show all fleet accounts and session health |
| `login <handle> <email> <pass>` | Authenticate and save session cookies |
| `recon <target>` | Full OSINT: profile, tweets, network, behavioral analysis |
| `campaign --topic "X" --tweets file.json` | Multi-account content posting with cross-engagement |
| `network <handle1> <handle2> ...` | Map social graph intersections and bridge nodes |
| `trends <keyword1> <keyword2> ...` | Monitor trending topics and keyword volumes |
| `search <query>` | Quick tweet search |
| `profile <handle>` | Display a Twitter profile |

## Workflows

### W1: Recon (`python agent.py recon elonmusk`)
1. Pulls full profile via twikit
2. Fetches recent tweets
3. Samples follower/following lists
4. Deep scrapes timeline via twint (no API limits)
5. Runs behavioral analysis via tweets_analyzer
6. Generates `data/osint/<target>/REPORT.md`

### W2: Campaign (`python agent.py campaign --topic "launch" --tweets tweets.json`)
Input `tweets.json`:
```json
[
  {"handle": "account1", "text": "Excited about our launch!"},
  {"handle": "auto", "text": "Check out what we're building"},
  {"handle": "account2", "text": "The future is here", "media_paths": ["img.jpg"]}
]
```
- Posts from specified or auto-rotated accounts
- Fleet cross-engagement (likes + selective RTs)
- Safety gates block identical spam

### W3: Network Map (`python agent.py network user1 user2 user3`)
- Pulls follower/following graphs for each seed
- Computes intersections and bridge nodes
- Identifies mutual connections and clusters
- Generates `data/network/<id>/GRAPH.md`

### W4: Trends (`python agent.py trends "AI agents" "LLM tools"`)
- Pulls current trending topics
- Searches each keyword with volume/engagement stats
- Cross-references with twint for historical depth
- Generates `data/trends/<id>/DIGEST.md`

## Architecture

```
twitter-agent/
├── agent.py              # CLI entry point (click)
├── config.py             # Configuration and paths
├── session_manager.py    # Multi-account session management
├── tools.py              # Tool wrappers (twikit, twint, tweets_analyzer)
├── SYSTEM_PROMPT.md      # Full supervisor system prompt
├── requirements.txt      # Python dependencies
├── sessions/             # Cookie files per account
├── data/                 # All output artifacts
│   ├── osint/            # Recon reports
│   ├── campaigns/        # Campaign metrics
│   ├── network/          # Network maps
│   ├── trends/           # Trend digests
│   ├── twint/            # Raw twint outputs
│   └── analysis/         # tweets_analyzer outputs
├── fleet-log/            # Per-account action logs (JSONL)
└── workflows/            # Workflow implementations
    ├── recon.py           # W1: Target Reconnaissance
    ├── campaign.py        # W2: Content Campaign
    ├── network_map.py     # W3: Network Mapping
    └── trends.py          # W4: Trend Monitoring
```

## Safety Gates

These require human confirmation:
- Posting identical content across 3+ accounts in 1 hour
- Following/unfollowing 50+ accounts per session
- Sending DMs to non-fleet accounts
- Actions on accounts inactive 30+ days
- Bulk deletes

## Multi-Account Fleet

Each account gets isolated:
- Session cookies: `sessions/<handle>.cookies`
- Action logs: `fleet-log/<handle>/<date>.jsonl`
- Rate jitter: 30-90s between actions (configurable)
- Round-robin or targeted account selection

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TWINT_PATH` | `../.tmp/twitter-repos/twint` | Path to twint installation |
| `TWEETS_ANALYZER_PATH` | `../.tmp/twitter-repos/tweets_analyzer` | Path to tweets_analyzer |
| `RATE_JITTER_MIN` | `30` | Minimum seconds between actions |
| `RATE_JITTER_MAX` | `90` | Maximum seconds between actions |

## Optional: twint + tweets_analyzer

Recon/trends workflows call **twint** and **tweets_analyzer** via subprocess. Clone them next to the repo or set `TWINT_PATH` / `TWEETS_ANALYZER_PATH` (see `.env.example`). Default layout: `gitgod/.tmp/twitter-repos/twint` and `.../tweets_analyzer` relative to this package’s parent.

## Smoke checks

After `pip install -r requirements.txt` and (optionally) login:

```bash
./scripts/smoke_fleet.sh
```

With no `sessions/*.cookies`, this still runs `fleet-status` and prints instructions for login.

## Optional: XPOZ read API

For hosted search / CSV / Instagram & Reddit (see `INTEGRATION.md`):

```bash
pip install -r requirements-optional.txt
# export XPOZ_API_KEY=...
python scripts/xpoz_spike.py
```

Without `XPOZ_API_KEY`, the spike exits successfully and skips the network call.
