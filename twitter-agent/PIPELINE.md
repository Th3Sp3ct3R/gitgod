# Twitter Content Pipeline — Architecture

> Full flow: Documentation sites → GitGod knowledge → Tweet bank → Fleet posting

---

## Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 1: INGEST                                                │
│                                                                 │
│  Doc sites (Firecrawl, Kimi, Anthropic, OpenAI, etc.)          │
│       │                                                         │
│       ▼                                                         │
│  doc-scraper skill (WebFetch, batch 5-7 pages)                 │
│       │                                                         │
│       ▼                                                         │
│  Obsidian LLM Docs/*.md  ←── full documentation references     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  STAGE 2: WATCH                                                 │
│                                                                 │
│  blog_watcher.py (scheduled every 6hrs via Cowork)             │
│       │                                                         │
│       ├── Polls blog index pages in watchlist.json              │
│       ├── Diffs against data/blog_watcher_state.json            │
│       └── Flags new post URLs                                   │
│                                                                 │
│  watchlist.json:                                                │
│    - Firecrawl  /blog/*                                         │
│    - Kimi       /blog/*                                         │
│    - Anthropic  /news/*                                         │
│    - OpenAI     /blog/*                                         │
│    - (add any blog — just needs name, url, link_pattern)        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  STAGE 3: PROCESS                                               │
│                                                                 │
│  auto_poster.py                                                 │
│       │                                                         │
│       ├── Scrapes new post HTML → strips to text                │
│       ├── Sends to Ollama gemma2:2b (or OpenCode Go fallback)  │
│       ├── LLM generates 2-3 tweet angles per post              │
│       ├── Appends to Obsidian LLM Docs/Blogs/<Name> Blog.md    │
│       └── Queues tweets → data/tweet_queue/<name>-<ts>.json    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  STAGE 4: POST                                                  │
│                                                                 │
│  Option A — Manual review:                                      │
│    1. Check data/tweet_queue/ for queued .json files            │
│    2. Edit/approve tweets                                       │
│    3. python agent.py campaign --tweets <file>.json             │
│                                                                 │
│  Option B — Auto-post (when ready):                             │
│    python scripts/auto_poster.py --post --handles h1,h2,h3     │
│                                                                 │
│  twitter-agent campaign:                                        │
│    - Posts from fleet accounts via twikit (cookie auth)         │
│    - Cross-engagement (likes + selective RTs)                   │
│    - Safety gates block identical spam                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## File Map

| File | Purpose |
|------|---------|
| `watchlist.json` | Blog configs: name, URL, link pattern, .md target |
| `scripts/blog_watcher.py` | Polls blogs, diffs state, flags new posts |
| `scripts/auto_poster.py` | Orchestrator: scrape → LLM angles → queue |
| `scripts/md_to_tweets.py` | Converts existing .md tweet banks → tweets.json |
| `data/blog_watcher_state.json` | Seen URLs per blog (auto-maintained) |
| `data/tweet_queue/*.json` | Queued tweet campaigns ready to post |
| `agent.py` | Twitter agent: campaign, recon, fleet-status |

## Obsidian Vault Structure

```
~/Documents/vanta-brain/Research/LLM-Docs/
├── Kimi Code CLI.md              # Full docs reference
├── Firecrawl.md                  # Full docs reference
├── .skills/doc-scraper/SKILL.md  # Reusable scraping skill
└── Blogs/
    ├── Firecrawl Blog.md         # 14 posts + tweet angles (seed)
    ├── Kimi Blog.md              # (watcher will populate)
    ├── Anthropic Blog.md         # (watcher will populate)
    └── OpenAI Blog.md            # (watcher will populate)
```

## LLM Routing (Tweet Generation)

| Priority | Provider | Model | When |
|----------|----------|-------|------|
| 1 | Ollama (local) | gemma2:2b | Default — fast, free, no rate limits |
| 2 | OpenCode Go | Kimi K2.5 | Fallback if Ollama is down |

## Scheduled Task

| Task | Schedule | What |
|------|----------|------|
| `blog-watcher` | Every 6 hours | Polls watchlist → scrapes new → generates angles → queues |

Notifications delivered to Cowork on every run.

## Commands Quick Reference

```bash
# Check for new posts (no action)
python scripts/blog_watcher.py --dry-run

# Full pipeline: detect + scrape + generate + queue
python scripts/auto_poster.py

# Process a specific URL manually
python scripts/auto_poster.py --url https://example.com/blog/post --blog "Example"

# Convert existing .md bank to campaign JSON
python scripts/md_to_tweets.py ~/Desktop/COWORK/Obsidian\ LLM\ Docs/Blogs/Firecrawl\ Blog.md --out tweets.json

# Preview tweets before posting
python scripts/md_to_tweets.py <blog.md> --preview --limit 10

# Post queued tweets from fleet
python agent.py campaign --tweets data/tweet_queue/<file>.json

# Add a new blog to watch — edit watchlist.json, then seed:
python scripts/blog_watcher.py --config watchlist.json --seed
```

## Adding a New Blog

1. Add entry to `watchlist.json`:
```json
{
  "name": "NewBlog",
  "blog_url": "https://example.com/blog",
  "md_file": "~/Documents/vanta-brain/Research/LLM-Docs/Blogs/NewBlog Blog.md",
  "link_pattern": "href=\"(/blog/[a-z0-9-]+)\"",
  "base_url": "https://example.com",
  "category": "llm"
}
```

2. Seed current posts: `python scripts/blog_watcher.py --seed`
3. Next scheduled run picks up new posts automatically
