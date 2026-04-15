# GitGod Ecosystem Potential: Agent Composition Analysis

> Generated: 2026-03-25 | Scope: 900+ skills, 75+ SaaS automations, 3 battle-tested codebases, 1 agent factory pipeline

---

## Section 1: What We Have

### 1.1 The GitGod Pipeline

GitGod is a **repo-to-knowledge-graph** pipeline that transforms any GitHub repository into structured, queryable intelligence. It operates in six stages:

| Stage | Command | What It Does | Output |
|---|---|---|---|
| 1. Clone-Parse | `gitgod parse <url>` | Clones a repo, parses the README into a hierarchical taxonomy of tools and categories | `skeleton.json` |
| 2. Enrich | `gitgod enrich <skeleton>` | Scrapes every linked tool/website via Firecrawl to gather metadata, GitHub stars, descriptions | `enriched.json` |
| 3. Synthesize | `gitgod synthesize <enriched>` | LLM-powered batch analysis: generates summaries, tags, relevance scores, cross-category links, duplicate detection | `knowledge-graph.json` |
| 4. Decompose | `gitgod decompose <kg>` | Breaks linked GitHub repos into atomic operations: API endpoints, scripts, configs, business logic | `decomposition.json` |
| 5. Map-Markdown | `gitgod map-markdown <enriched>` | Deep-crawls subrepo links, scraping full content into markdown artifacts | Markdown files |
| 6. Harness | `gitgod harness <repoPath>` | Generates a CLI wrapper + SKILL.md + workflow chains from decomposed operations, then merges into the graph | `SKILL.md`, `CLI_DISCOVERY_MANIFEST.md`, `WORKFLOW_MAP.md` |

The pipeline also exposes an **MCP server** (`gitgod serve`) with tools for querying the knowledge graph: `ask`, `find`, `compare`, `recommend`, `invoke`. This means any AI agent with MCP access can search the graph, compare tools, and execute harness commands.

**Key data model types:**
- `Tool` — a scraped entity with name, URL, status, and optional synthesis data
- `Category` — hierarchical taxonomy node with tools and subcategories
- `DecomposeOperation` — atomic unit: id, title, kind (api_endpoint | script | build | data | config | business_logic)
- `WorkflowChain` — composable multi-step pipeline from decomposed operations
- `CLICommand` — discovered CLI command with args, stdin/stdout schemas
- `HarnessResult` — complete harness output: commands, SKILL.md path, test results, workflows

### 1.2 Skill Inventory Summary

| Category | Count | Highlights |
|---|---:|---|
| AI / ML / LLM Engineering | ~70 | RAG, agents, embeddings, evals, voice AI, computer vision |
| SaaS Tool Automations | ~75 | 75 platforms via Composio: Gmail, Slack, HubSpot, Stripe, Jira, etc. |
| Security & Pentesting | ~60 | OWASP, STRIDE, red team, forensics, supply chain, compliance |
| DevOps & Infrastructure | ~55 | K8s, Terraform, GitOps, Prometheus, Grafana, CI/CD |
| Cloud Platforms | ~70 | Azure (60+), AWS (8), GCP (1) — SDKs for every service |
| Frontend & UI | ~45 | React 19, Next.js, Tailwind, shadcn, animations, PWA |
| Marketing, SEO & Growth | ~40 | 12 SEO sub-skills, CRO, programmatic SEO, email sequences |
| Backend & API | ~35 | REST, GraphQL, tRPC, payments, auth, queues |
| Language-Specific | ~30 | TypeScript, Python, Go, Rust, Java, C#, Ruby, Elixir, etc. |
| Documentation & Writing | ~30 | API docs, wikis, technical writing, brand voice, copy |
| Framework-Specific | ~25 | Next.js, FastAPI, Django, Laravel, NestJS, .NET, Temporal |
| Agent & Skill Development | ~25 | Skill builders, validators, MCP builders, plugin lifecycle |
| Database & Data | ~23 | Postgres, Prisma, Drizzle, DynamoDB, Spark, dbt, Airflow |
| Browser & Web Automation | ~20 | Playwright, Puppeteer, CDP, go-rod, Firecrawl, Apify |
| Testing & QA | ~20 | TDD, E2E, load testing, visual regression, AI-powered QA |
| Health & Medical | ~18 | 15 health analyzers (nutrition, sleep, mental, TCM, etc.) |
| Content & Social Media | ~16 | Cross-platform posting, bots, analytics |
| Code Review & Quality | ~16 | AI-powered review, auditing, dead code cleanup |
| Design & UX | ~15 | UI/UX design, design systems, image generation |
| Research & Analysis | ~13 | Deep research, web search, citation management |
| Miscellaneous | ~40+ | File org, video, image gen, speed reading, debugging |
| **TOTAL** | **~900+** | |

### 1.3 The Twitter Agent: Proof of Concept

The Twitter/X Unified Supervisor (`twitter-agent/SYSTEM_PROMPT.md`) demonstrates the **supervisor pattern** — a single system prompt that:

1. **Registers capabilities** from three codebases (twint, twikit, tweets_analyzer)
2. **Defines a decision tree** that routes incoming tasks to the right tool
3. **Specifies workflow templates** (W1: Recon, W2: Content Campaign, W3: Network Mapping, W4: Trend Monitoring)
4. **Includes safety gates** requiring human confirmation for high-risk actions
5. **Delegates to 60+ installed skills** organized by domain (social media, OSINT, content, growth, browser, data, security, automation, media)
6. **Defines fleet protocol** for multi-account coordination with session isolation, rate spacing, action logging

This pattern is the **blueprint for every supervisor we can build**. The formula:
```
Supervisor = Capability Registry + Decision Tree + Workflow Templates + Safety Gates + Skill Delegation
```

---

## Section 2: Supervisor Agents We Can Build (Top 10)

### #1: Instagram Growth Supervisor

**Core tools it would combine:**
- `instagram` + `instagram-automation` — Graph API publishing, analytics, DMs, carousels
- `apify-influencer-discovery` — find and vet influencers
- `apify-audience-analysis` — demographics across platforms
- `apify-content-analytics` — engagement metrics, campaign ROI
- `image-studio` / `imagen` / `stability-ai` — AI image generation for posts
- `content-creator` + `copywriting` — caption writing with brand voice
- `social-content` — cross-platform content optimization
- `growth-engine` — viral loops, referral programs
- `ab-test-setup` — test content variants
- `analytics-tracking` — design tracking systems
- `playwright-skill` / `browse` — browser automation for scraping

**Unique value:** End-to-end Instagram automation: research competitors → discover influencers → generate content (text + images) → schedule posts → track engagement → optimize based on data. All from a single command.

**Complexity:** Medium — most skills already exist. Needs system prompt, content queue manager, and session/credential management.

**Revenue potential:** High — Instagram growth agencies charge $2K-10K/month per client. This automates 80% of their work.

---

### #2: Security Audit Supervisor

**Core tools it would combine:**
- `007` — master security audit, STRIDE/PASTA, Red/Blue Team
- `vulnerability-scanner` — OWASP 2025, attack surface mapping
- `pentest-commands` — nmap, metasploit, hydra, web scanners
- `api-security-testing` + `api-fuzzing-bug-bounty` — REST/GraphQL pentesting
- `sql-injection-testing` + `xss-html-injection` + `idor-testing` — web vulnerability testing
- `sast-configuration` + `semgrep-rule-creator` — static analysis setup
- `gha-security-review` — CI/CD workflow auditing
- `supply-chain-risk-auditor` — dependency risk assessment
- `differential-review` — security-focused PR review
- `find-bugs` + `audit-context-building` — line-by-line vulnerability hunting
- `security-bluebook-builder` — normative security policy generation
- `gdpr-data-handling` + `pci-compliance` — compliance checking

**Unique value:** Feed it a GitHub repo URL, get a complete security audit: SAST scan, dependency audit, OWASP checklist, compliance gaps, remediation plan, and a security policy document. Currently this requires hiring a consultant for $10K+.

**Complexity:** Medium — security skills are comprehensive. Needs orchestration logic and report synthesis.

**Revenue potential:** Very high — security audits are $5K-50K per engagement. Automated continuous auditing is a SaaS product.

---

### #3: Full-Stack SaaS Builder Supervisor

**Core tools it would combine:**
- `app-builder` + `app-builder/templates` — 12 scaffolding templates
- `saas-mvp-launcher` — tech stack, auth, payments, launch checklist
- `nextjs-app-router-patterns` + `nextjs` — App Router, SSR, streaming
- `shadcn` + `tailwind-design-system` — UI component library
- `clerk-auth` / `nextjs-supabase-auth` — authentication
- `stripe-integration` + `billing-automation` — payments and subscriptions
- `prisma-expert` / `drizzle-orm-expert` — database ORM
- `neon-postgres` / `vercel-storage` — serverless database
- `vercel-deployment` + `vercel-cli` — deployment
- `inngest` / `trigger-dev` — background jobs
- `seo-fundamentals` + `schema-markup` — SEO optimization
- `e2e-testing` — Playwright test generation

**Unique value:** "Describe your SaaS idea" → deployed MVP with auth, payments, database, tests, SEO, and CI/CD in under an hour. Replaces months of setup work.

**Complexity:** High — requires deep integration between many skills. But each skill is well-documented.

**Revenue potential:** Very high — competes with $50K-200K agency builds. Could be a productized service or a developer tool.

---

### #4: SEO & Content Marketing Supervisor

**Core tools it would combine:**
- `seo-audit` + `seo-fundamentals` — diagnose SEO issues
- `seo-content-planner` + `seo-content-writer` + `seo-content-auditor` — content pipeline
- `seo-keyword-strategist` + `keyword-extractor` — keyword research
- `seo-meta-optimizer` + `seo-structure-architect` — on-page optimization
- `seo-snippet-hunter` + `seo-authority-builder` — SERP features + E-E-A-T
- `schema-markup` + `fixing-metadata` — structured data
- `programmatic-seo` — pages at scale
- `geo-fundamentals` — AI search optimization (ChatGPT, Perplexity)
- `content-creator` + `copywriting` — content production
- `competitor-alternatives` + `competitive-landscape` — competitive analysis
- `google-analytics-automation` + `google-sheets-automation` — reporting

**Unique value:** 12 SEO sub-skills working in concert. Input a domain → full technical audit, keyword gaps, content calendar, schema markup, competitor analysis, and generated articles. The most complete SEO agent possible.

**Complexity:** Low-Medium — skills are already highly specialized. Mostly needs orchestration.

**Revenue potential:** High — SEO agencies charge $3K-15K/month. This automates the analysis and content creation.

---

### #5: DevOps & Infrastructure Supervisor

**Core tools it would combine:**
- `docker-expert` — containerization
- `kubernetes-architect` + `k8s-manifest-generator` — K8s deployment
- `terraform-specialist` + `terraform-module-library` — IaC
- `github-actions-templates` + `gitlab-ci-patterns` — CI/CD
- `helm-chart-scaffolding` — Helm charts
- `prometheus-configuration` + `grafana-dashboards` — monitoring
- `slo-implementation` + `observability-engineer` — SRE practices
- `incident-runbook-templates` + `postmortem-writing` — incident response
- `secrets-management` + `cost-optimization` — security + FinOps
- `gitops-workflow` — ArgoCD/Flux deployment

**Unique value:** "Here's my app" → Dockerfile, K8s manifests, Terraform infra, CI/CD pipeline, monitoring dashboards, runbooks, and cost estimates. Everything a DevOps engineer does in the first month, done in hours.

**Complexity:** Medium — well-documented skills but requires sequencing and environment awareness.

**Revenue potential:** High — DevOps engineers cost $150K+/year. This automates initial setup and ongoing maintenance.

---

### #6: Cross-Platform Social Media Supervisor

**Core tools it would combine:**
- `twitter-orchestrator` — existing Twitter supervisor (the proof of concept)
- `instagram` + `instagram-automation` — IG publishing, analytics
- `linkedin-automation` + `linkedin-cli` — LinkedIn posts, messages
- `tiktok-automation` — TikTok publishing
- `youtube-automation` — YouTube uploads, analytics
- `reddit-automation` — Reddit posting, engagement
- `discord-automation` + `discord-bot-architect` — community management
- `telegram-automation` + `telegram-bot-builder` — Telegram channels
- `social-orchestrator` — cross-channel coordination
- `social-content` — platform-optimized content
- `content-creator` + `avoid-ai-writing` — human-quality content
- `image-studio` + `fal-generate` — visual content generation
- `apify-trend-analysis` — cross-platform trend tracking

**Unique value:** One content brief → platform-optimized posts published across 8+ platforms simultaneously. Each version adapted for platform norms (character limits, hashtag culture, visual formats). Coordinated engagement campaigns across platforms.

**Complexity:** Medium — individual automations exist. Needs unified content queue and cross-platform identity management.

**Revenue potential:** Very high — social media management tools (Hootsuite, Buffer, Sprout) are $100-1000/month. This does more.

---

### #7: Sales & Outreach Supervisor

**Core tools it would combine:**
- `sales-automator` — cold emails, follow-ups, proposals
- `email-sequence` — drip campaigns, automated flows
- `linkedin-automation` + `linkedin-cli` — LinkedIn outreach
- `hubspot-automation` / `salesforce-automation` / `pipedrive-automation` — CRM management
- `gmail-automation` — email management
- `apify-lead-generation` — B2B/B2C lead scraping
- `deep-research` + `exa-search` — prospect research
- `copywriting` + `avoid-ai-writing` — human-quality outreach copy
- `calendly-automation` / `cal-com-automation` — meeting scheduling
- `competitive-landscape` + `market-sizing-analysis` — market intelligence
- `slack-automation` — internal notifications

**Unique value:** Input an ICP (Ideal Customer Profile) → scrape leads → research each prospect → generate personalized outreach sequences → send via email/LinkedIn → manage responses in CRM → book meetings → notify team in Slack. Full sales pipeline automation.

**Complexity:** Medium — all tools exist. Needs sequence orchestration and personalization logic.

**Revenue potential:** Very high — outbound SDR teams cost $60K-80K per rep. This automates the repetitive work.

---

### #8: Code Review & Quality Supervisor

**Core tools it would combine:**
- `code-reviewer` + `code-review-checklist` + `code-review-excellence` — comprehensive review
- `find-bugs` + `bug-hunter` — vulnerability and quality scanning
- `vibe-code-auditor` + `production-code-audit` — AI-code and production readiness
- `test-driven-development` + `tdd-orchestrator` — TDD enforcement
- `unit-testing-test-generate` — automated test generation
- `clean-code` + `uncle-bob-craft` — code quality principles
- `refactor-cleaner` + `code-simplifier` — dead code removal
- `security-scanning-security-sast` + `semgrep-rule-creator` — security scanning
- `lint-and-validate` + `fix` — auto-formatting and linting
- `pr-writer` + `iterate-pr` — PR creation and CI fixing

**Unique value:** Attach to any repo as a continuous quality gate. Every PR gets: code review, security scan, test generation, refactoring suggestions, and auto-fixed linting. Works as a GitHub Action or pre-commit hook.

**Complexity:** Low — most skills are well-contained. Needs a GitHub webhook handler and report aggregator.

**Revenue potential:** Medium-High — code review tools (CodeClimate, SonarQube) charge $15-50/user/month. AI-powered reviews are more valuable.

---

### #9: Research & Intelligence Supervisor

**Core tools it would combine:**
- `deep-research` — Gemini-powered autonomous multi-step research (2-10 min)
- `infinite-gratitude` — multi-agent parallel research (10 agents)
- `exa-search` + `tavily-web` — semantic search and content extraction
- `firecrawl` + `firecrawl-scraper` — deep web scraping
- `apify-market-research` + `apify-competitor-intelligence` — market research
- `apify-brand-reputation-monitoring` — brand monitoring
- `alpha-vantage` — financial data, stock prices, technicals
- `data-scientist` + `data-storytelling` — analysis and visualization
- `plotly` + `networkx` — charts and network graphs
- `pdf` + `docx` + `pptx` — report generation in any format
- `citation-management` — academic citation handling
- `last30days` — recent trend research

**Unique value:** "Research [topic]" → comprehensive report with market data, competitive analysis, financial metrics, trend visualization, network graphs, and citations. Delivered as a polished PDF or PPTX. Replaces consulting firms for initial research.

**Complexity:** Low-Medium — research skills are self-contained. Needs a report synthesis layer.

**Revenue potential:** High — management consulting firms charge $50K-500K for research engagements. This handles the data gathering.

---

### #10: E-Commerce Operations Supervisor

**Core tools it would combine:**
- `shopify-apps` + `shopify-development` + `shopify-automation` — Shopify management
- `stripe-automation` + `stripe-integration` — payment processing
- `apify-ecommerce` — pricing intelligence, reviews, competitor tracking
- `seo-content-writer` + `seo-meta-optimizer` — product page SEO
- `email-sequence` + `klaviyo-automation` / `mailchimp-automation` — email marketing
- `google-analytics-automation` + `mixpanel-automation` — analytics
- `instagram-automation` + `tiktok-automation` — social commerce
- `hubspot-automation` — customer relationship management
- `zendesk-automation` / `freshdesk-automation` — customer support
- `inventory-demand-planning` — stock management
- `returns-reverse-logistics` — returns handling
- `customs-trade-compliance` — international compliance

**Unique value:** Full e-commerce operations: product listing optimization, pricing intelligence, automated email flows, social commerce posting, customer support triage, inventory alerts, and returns processing. Runs a Shopify store with minimal human oversight.

**Complexity:** High — many integration points. But individual skills are well-defined.

**Revenue potential:** Very high — e-commerce operations teams are 5-20 people. This automates the routine work for each.

---

## Section 3: Cross-Agent Orchestration Patterns

### 3.1 Supervisor-to-Supervisor Delegation

Supervisors don't exist in isolation. They form a hierarchy:

```
Commander (routes to the right supervisor)
├── Social Media Supervisor
│   ├── Twitter Supervisor (existing)
│   ├── Instagram Supervisor
│   └── LinkedIn Supervisor
├── Security Audit Supervisor
├── SEO & Content Supervisor
│   ├── Content Writer (sub-supervisor)
│   └── Technical SEO (sub-supervisor)
├── DevOps Supervisor
├── Sales Supervisor
│   ├── Lead Gen (sub-supervisor)
│   └── Outreach (sub-supervisor)
└── Research Supervisor
```

**Delegation examples:**
- Social Media Supervisor → delegates to SEO Supervisor for blog posts that feed social campaigns
- Sales Supervisor → delegates to Research Supervisor for prospect intel → Content Supervisor for outreach copy
- Security Supervisor → delegates to DevOps Supervisor for infrastructure hardening after audit findings
- E-Commerce Supervisor → delegates to SEO Supervisor for product page optimization → Social Supervisor for social commerce

### 3.2 Shared Infrastructure

All supervisors share:

| Component | Implementation | Skills That Support It |
|---|---|---|
| **Credential Vault** | Encrypted secret storage per supervisor/account | `cred-omega`, `varlock`, `secrets-management` |
| **Job Queue** | Persistent task queue with retries and scheduling | `bullmq-specialist`, `inngest`, `trigger-dev` |
| **Session Management** | Per-account cookie/token storage with refresh | `auth-implementation-patterns`, `clerk-auth` |
| **Data Lake** | Centralized storage for all scraped/generated data | `database-architect`, `neon-postgres`, `vercel-storage` |
| **MCP Gateway** | GitGod's MCP server (`gitgod serve`) as the unified query interface | Built into gitgod |
| **Observability** | Logging, metrics, alerting for all agent activity | `observability-engineer`, `prometheus-configuration`, `grafana-dashboards` |
| **Context Memory** | Persistent agent memory across sessions | `agent-memory-mcp`, `context-guardian`, `session-indexer` |

### 3.3 Data Flow Between Agents

The most powerful pattern: **one agent's output is another agent's input**.

```
Research Supervisor                       Content Supervisor
  ├── Scrapes competitor data     →      ├── Generates blog posts from research
  ├── Identifies trending topics  →      ├── Creates social content from trends
  └── Maps audience demographics  →      └── Tailors voice per audience segment
                                                    │
                                           Social Media Supervisor
                                             ├── Publishes across platforms
                                             ├── Tracks engagement
                                             └── Feeds metrics back to Research
                                                         │
                                              Sales Supervisor
                                                ├── Uses engagement signals for lead scoring
                                                └── Generates personalized outreach from content performance
```

**Concrete data contracts:**

| Producer Agent | Data Format | Consumer Agent | Use Case |
|---|---|---|---|
| Research Supervisor | `{ competitors: [], trends: [], audience: {} }` | Content Supervisor | Content strategy |
| SEO Supervisor | `{ keywords: [], gaps: [], pages: [] }` | Content Supervisor | Blog post briefs |
| Social Media Supervisor | `{ posts: [], engagement: {} }` | Sales Supervisor | Social selling signals |
| Security Supervisor | `{ findings: [], severity: string }` | DevOps Supervisor | Automated remediation |
| GitGod Pipeline | `knowledge-graph.json` | Any Supervisor | Tool discovery and recommendation |
| Content Supervisor | `{ content: string, images: [] }` | Social Media Supervisor | Multi-platform publishing |

---

## Section 4: The Meta-Architecture

### 4.1 The Commander Agent

A meta-supervisor that sits above all domain supervisors and routes tasks:

```
User: "I need to launch my SaaS product next month"

Commander:
  1. Routes to SaaS Builder Supervisor → scaffold the app
  2. Routes to DevOps Supervisor → set up infrastructure
  3. Routes to SEO Supervisor → prepare landing page and content
  4. Routes to Social Media Supervisor → create launch campaign
  5. Routes to Sales Supervisor → set up outreach sequences
  6. Routes to Security Supervisor → pre-launch security audit
```

**Commander decision tree:**

```
Incoming Task
├── Contains "twitter" / "tweet" / "x.com" → Twitter Supervisor
├── Contains "instagram" / "ig" / "reels" → Instagram Supervisor
├── Contains "security" / "audit" / "pentest" → Security Supervisor
├── Contains "seo" / "ranking" / "keywords" → SEO Supervisor
├── Contains "deploy" / "infra" / "kubernetes" → DevOps Supervisor
├── Contains "sell" / "outreach" / "leads" → Sales Supervisor
├── Contains "build" / "create app" / "saas" → SaaS Builder Supervisor
├── Contains "research" / "analyze" / "report" → Research Supervisor
├── Multi-domain task → Orchestrate across supervisors
└── Unknown → ask for clarification / route to Research Supervisor
```

### 4.2 Skill Discovery and Auto-Routing

GitGod's MCP server already provides the primitives:

- `ask` — "What tools can scrape Instagram?" → returns ranked tools from the knowledge graph
- `find` — structured search by tags, category, relevance score
- `recommend` — "I need to build a payment system" → ranked suggestions with rationale
- `compare` — side-by-side comparison of two tools
- `invoke` — execute a harness command directly

The Commander uses these MCP tools to dynamically discover which skills/harnesses are available and route accordingly. **No hardcoded routing needed** — the Commander queries the knowledge graph at runtime.

### 4.3 GitGod as the Agent Factory

This is the deepest insight: **GitGod itself becomes the machine that builds supervisors**.

```
Input: Any GitHub repo URL
  │
  ├── Stage 1-3: Parse → Enrich → Synthesize → knowledge-graph.json
  │     (understand what the repo does, tag capabilities, score relevance)
  │
  ├── Stage 4: Decompose → decomposition.json
  │     (break into atomic operations: APIs, scripts, configs, business logic)
  │
  ├── Stage 6: Harness → SKILL.md + CLI commands + workflow chains
  │     (generate a usable agent skill from the decomposed operations)
  │
  └── Output: A new supervisor system prompt + SKILL.md + workflow templates
        (automatically generated from the harness output)
```

**The vision:** Point GitGod at a repo like `geelark-api` and it automatically:
1. Parses the API surface
2. Decomposes into operations (device management, session control, proxy config)
3. Generates a SKILL.md with all available commands
4. Creates workflow templates (device provisioning pipeline, session rotation)
5. Produces a system prompt for a "Device Management Supervisor"

This means **new supervisors can be generated programmatically**. The agent ecosystem grows automatically as new repos are ingested.

---

## Section 5: Immediate Next Steps (Prioritized)

### Phase 1: Foundation (Week 1-2)

| # | Task | Dependencies | Effort | Deliverable |
|---|---|---|---|---|
| 1.1 | **Create the Supervisor Template** — a reusable system prompt template that any supervisor can be generated from (Capability Registry, Decision Tree, Workflow Templates, Safety Gates, Skill Delegation sections) | Twitter agent as reference | 2 days | `templates/supervisor-template.md` |
| 1.2 | **Build the Commander Agent** — the meta-router that sits above all supervisors, queries the GitGod MCP server for skill discovery, and delegates to the right supervisor | 1.1 + `gitgod serve` | 3 days | `commander-agent/SYSTEM_PROMPT.md` |
| 1.3 | **Shared Credential Manager** — centralized secret storage that all supervisors use. Build on `cred-omega` + `varlock` patterns. Store per-account cookies, API keys, OAuth tokens | None | 2 days | `src/infra/credential-vault.ts` |
| 1.4 | **Shared Job Queue** — BullMQ-based task queue that supervisors use to schedule and coordinate work | None | 2 days | `src/infra/job-queue.ts` |

### Phase 2: First Two Supervisors (Week 3-4)

| # | Task | Dependencies | Effort | Deliverable |
|---|---|---|---|---|
| 2.1 | **Instagram Growth Supervisor** — the natural second supervisor after Twitter. Combine `instagram` + `instagram-automation` + `image-studio` + `content-creator` + `apify-influencer-discovery` | 1.1, 1.3 | 4 days | `instagram-agent/SYSTEM_PROMPT.md` |
| 2.2 | **SEO & Content Supervisor** — highest skill density (12 SEO skills), lowest new code needed. Pure orchestration of existing skills | 1.1 | 3 days | `seo-agent/SYSTEM_PROMPT.md` |
| 2.3 | **Cross-Supervisor Delegation Protocol** — define how supervisors pass tasks to each other. Standard data contracts (JSON schemas) for inter-agent communication | 1.2, 2.1, 2.2 | 2 days | `docs/DELEGATION_PROTOCOL.md` |

### Phase 3: The Agent Factory (Week 5-6)

| # | Task | Dependencies | Effort | Deliverable |
|---|---|---|---|---|
| 3.1 | **`gitgod generate-supervisor <harness>`** — new CLI command that takes a harness output and auto-generates a supervisor system prompt from it | 1.1 + existing harness stage | 4 days | New CLI command + template engine |
| 3.2 | **Security Audit Supervisor** — third supervisor, critical for enterprise credibility | 1.1, 1.3 | 3 days | `security-agent/SYSTEM_PROMPT.md` |
| 3.3 | **Sales & Outreach Supervisor** — fourth supervisor, immediate revenue potential | 1.1, 1.3, 1.4 | 4 days | `sales-agent/SYSTEM_PROMPT.md` |

### Phase 4: Scale (Week 7-8)

| # | Task | Dependencies | Effort | Deliverable |
|---|---|---|---|---|
| 4.1 | **Batch supervisor generation** — run `gitgod generate-supervisor` across all harness outputs to auto-generate supervisors for every ingested repo | 3.1 | 2 days | N supervisor system prompts |
| 4.2 | **Cross-Platform Social Media Supervisor** — unify all platform supervisors under one umbrella | 2.1 + Twitter agent | 3 days | `social-agent/SYSTEM_PROMPT.md` |
| 4.3 | **DevOps Supervisor** | 1.1 | 3 days | `devops-agent/SYSTEM_PROMPT.md` |
| 4.4 | **Observability Dashboard** — Grafana dashboard tracking agent activity, success rates, costs | 1.4 + `grafana-dashboards` | 2 days | Dashboard JSON |

### Dependency Graph

```
1.1 Supervisor Template ────┬──► 2.1 Instagram Supervisor
                            ├──► 2.2 SEO Supervisor
                            ├──► 3.1 generate-supervisor CLI
                            ├──► 3.2 Security Supervisor
                            └──► 3.3 Sales Supervisor

1.2 Commander Agent ────────┬──► 2.3 Delegation Protocol
                            └──► 4.1 Batch generation

1.3 Credential Manager ─────┬──► 2.1, 3.2, 3.3 (any supervisor with auth)
                             
1.4 Job Queue ───────────────┬──► 3.3 Sales Supervisor
                             └──► 4.4 Observability

3.1 generate-supervisor ─────┬──► 4.1 Batch generation
```

### Revenue Prioritization

| Supervisor | Time to Revenue | Monthly Revenue Potential | Build Order |
|---|---|---|---|
| SEO & Content | 2 weeks | $5K-30K (agency clients) | 1st |
| Instagram Growth | 3 weeks | $5K-50K (agency clients) | 2nd |
| Sales & Outreach | 5 weeks | $10K-100K (per sales team) | 3rd |
| Security Audit | 5 weeks | $5K-50K (per engagement) | 4th |
| SaaS Builder | 8 weeks | $50K-200K (per project) | 5th |

---

## Appendix: Skill Density per Supervisor

How many existing skills each supervisor leverages vs. new code required:

| Supervisor | Existing Skills Used | New Code Required | Leverage Ratio |
|---|---:|---|---|
| SEO & Content | 22 | System prompt + orchestration | 22:1 |
| Code Review & Quality | 16 | GitHub webhook + report aggregator | 16:1 |
| Cross-Platform Social | 15 | Content queue + identity manager | 15:1 |
| Research & Intelligence | 14 | Report synthesis layer | 14:1 |
| Security Audit | 14 | Report synthesis + remediation tracker | 14:1 |
| Instagram Growth | 12 | Session manager + content queue | 12:1 |
| Sales & Outreach | 12 | Sequence engine + CRM sync | 12:1 |
| DevOps & Infrastructure | 12 | Environment detector + config generator | 12:1 |
| E-Commerce Operations | 12 | Multi-platform sync + alerting | 12:1 |
| SaaS Builder | 12 | Template engine + deploy orchestrator | 12:1 |

The average supervisor combines **~14 existing skills** with a system prompt and thin orchestration layer. The ecosystem already contains 95% of the capabilities. The remaining 5% is wiring.
