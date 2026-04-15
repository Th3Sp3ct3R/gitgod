# Example 3 — 666ghj/MiroFish (clone + corpus + analyzer output)

**Repo:** [666ghj/MiroFish](https://github.com/666ghj/MiroFish)  
**Purpose:** Worked run of the Repository Analyzer template: assembled **INJECTED CORPUS** from a shallow clone, then the three **Required output** sections (briefing, `repo_brief`, `system_prompt_fragment`).

**State reset:** `666ghj/MiroFish` was removed from `data/github-starred-state.json` so the next `npm run starred:poll` can surface it as **new** again if the account still stars it.

**Local clone (gitignored):** `data/external/MiroFish` — not committed; re-clone if missing.

---

## Assembled system prompt (copy into API as **system** message)

Fill `{{CORPUS}}` in `../SYSTEM_PROMPT_TEMPLATE.md` with the block below, or paste this full prompt:

---

You are the **Repository Analyzer** for GitGod. Your job is to **explain what this codebase is for and how it is structured** using **only** the injected corpus below plus general software literacy. You do **not** execute code or invent file paths that are not evidenced in the corpus.

### Operating rules

1. **Evidence first**: Every factual claim must be traceable to the injected corpus.
2. **Unknowns**: If something is not in the corpus, say `unknown` and list what artifact would resolve it.
3. **Order of analysis**: mission → surfaces → modules → data flow → risks.
4. **No deep code walk**: Stop at architecture and entry points.
5. **Output shape**: Human briefing, then raw `repo_brief` JSON, then fenced `system_prompt_fragment`.

---

## Injected corpus

--- INJECTED CORPUS BEGIN ---

### Repository identity

- **GitHub:** `666ghj/MiroFish`
- **License (root package.json):** AGPL-3.0
- **Tagline (package.json):** MiroFish — 简洁通用的群体智能引擎，预测万物 / A Simple and Universal Swarm Intelligence Engine, Predicting Anything

### README.md / README-EN.md (substance)

- **Mission:** Multi-agent AI prediction engine: ingest real-world “seed” material (news, policy, finance, or narrative text), build a high-fidelity parallel digital world, run large numbers of agents with memory and behavior, support “god view” variable injection, output **prediction reports** and an **interactive** simulated world.
- **Workflow (5 steps):** (1) graph build / GraphRAG & memory, (2) environment setup / personas & sim params, (3) simulation (dual-platform parallel sim, temporal memory updates), (4) report via ReportAgent, (5) deep interaction with agents / ReportAgent.
- **Credits:** Simulation engine powered by **OASIS** (CAMEL-AI); Zep used for graph memory (per README + pyproject).

### Root package.json (scripts)

- `npm run setup` — root + frontend `npm install`
- `npm run setup:backend` — `cd backend && uv sync`
- `npm run setup:all` — setup + backend
- `npm run dev` — `concurrently` runs backend + frontend
- `npm run backend` — `cd backend && uv run python run.py`
- `npm run frontend` — `cd frontend && npm run dev`
- `npm run build` — frontend production build
- **Node:** `>=18`

### Frontend (frontend/package.json)

- **Stack:** Vue 3, Vue Router, Vite, axios, d3
- **Scripts:** `dev`, `build`, `preview`

### Frontend (frontend/vite.config.js)

- **Dev server:** port **3000**
- **Proxy:** `/api` → `http://localhost:5001`

### Backend (backend/pyproject.toml)

- **Python:** `>=3.11` (README also states ≤3.12)
- **Notable deps:** `flask`, `flask-cors`, `openai`, `zep-cloud==3.13.0`, `camel-oasis==0.2.5`, `camel-ai==0.2.78`, `PyMuPDF`, `python-dotenv`, `pydantic`

### Backend entry (backend/run.py)

- Loads `create_app` from `app`, validates `Config`, runs Flask on `FLASK_HOST` default `0.0.0.0`, port `FLASK_PORT` default **5001**.

### Backend app factory (backend/app/__init__.py)

- CORS: `/api/*` origins `*`
- Blueprints: `graph_bp` → `/api/graph`, `simulation_bp` → `/api/simulation`, `report_bp` → `/api/report`
- Health: `GET /health` → JSON `{ status, service }`
- Registers `SimulationRunner` cleanup on shutdown

### Environment (.env.example — keys only, no secrets)

- `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL_NAME` (OpenAI-compatible; README suggests DashScope / qwen-plus)
- `ZEP_API_KEY` (Zep Cloud)
- Optional: `LLM_BOOST_*` trio for accelerated LLM

### Docker (docker-compose.yml)

- Service `mirofish`, image `ghcr.io/666ghj/mirofish:latest`, `env_file: .env`, ports **3000** and **5001**, volume `./backend/uploads:/app/backend/uploads`

### Documented URLs (README)

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5001`

--- INJECTED CORPUS END ---

---

## Analyzer output (filled per `SYSTEM_PROMPT_TEMPLATE.md`)

### 1) Human-readable briefing

#### Mission

**MiroFish** is a multi-agent **prediction and simulation** product: users upload seed documents and describe prediction goals in natural language; the system builds a **graph / memory-backed** world, runs **OASIS-based** social simulations (with Zep for graph memory), and produces **reports** plus a **Vue** UI for multi-step workflows (graph → environment → simulation → report → interaction).

#### Primary surfaces

- **Web UI:** Vue 3 + Vite dev server on port **3000**, proxied `/api` to backend **5001**.
- **HTTP API:** Flask blueprints under `/api/graph`, `/api/simulation`, `/api/report`; `GET /health`.
- **CLI / ops:** `npm run dev` / `npm run backend` / `frontend`; `docker compose up -d`; `uv run python run.py` for backend.

#### Architecture sketch

- **Monorepo:** root npm orchestrates `frontend/` (Vue) and `backend/` (Flask, `uv`/PEP 621).
- **Backend:** `run.py` → `create_app()`; API split into graph, simulation, report; services layer includes simulation runner/manager, report agent, graph builder, Zep integrations (per tree listing; names from `app/services/`).
- **Frontend:** Step-based views (`Step1GraphBuild` … `Step5Interaction`) and views for simulation runs and reports; API clients under `frontend/src/api/`.
- **External services:** LLM via OpenAI-compatible API; **Zep Cloud** for graph memory; **OASIS** / CAMEL stack for simulation engine.

#### External dependencies & integrations

- **LLM:** OpenAI SDK-compatible endpoint (`LLM_*` env).
- **Zep:** `zep-cloud` Python package + `ZEP_API_KEY`.
- **Simulation:** `camel-oasis`, `camel-ai` (OASIS social sim).

#### Operational risks / sharp edges

- **Cost:** README warns LLM usage is heavy; suggests short simulations (<40 rounds) for trials.
- **Secrets:** `.env` required; never commit real keys (example file uses placeholders).
- **Compliance / scope:** AGPL-3.0 — derivative distribution obligations apply if you redistribute modified versions.
- **Python version:** Pinned to 3.11–3.12 band per README; stricter than `>=3.11` alone.

#### Suggested next steps for a coding agent

1. Read `backend/app/config.py` for full validation rules and env var names.
2. Skim `backend/app/api/{graph,simulation,report}.py` for request/response contracts.
3. Open `frontend/src/router/index.js` and `frontend/src/api/*.js` to map UI steps to API calls.

---

### 2) Machine-readable `repo_brief` (JSON)

```json
{
  "mission": "Multi-agent prediction engine: ingest seed documents, build graph-backed simulated worlds with OASIS/CAMEL and Zep memory, run simulations, generate reports, and expose a Vue multi-step UI plus Flask JSON APIs.",
  "primary_surfaces": [
    "Vue+Vite frontend on port 3000 (README, vite.config.js)",
    "Flask backend on port 5001: /api/graph, /api/simulation, /api/report, /health (app/__init__.py)",
    "npm scripts: dev, backend, frontend; docker compose (docker-compose.yml)"
  ],
  "components": [
    {
      "name": "frontend",
      "role": "Vue 3 SPA with stepped wizard and API clients; Vite proxy to backend",
      "evidence": "frontend/package.json, vite.config.js, src/views/, src/api/"
    },
    {
      "name": "backend_api",
      "role": "Flask blueprints for graph, simulation, report",
      "evidence": "backend/app/__init__.py, backend/app/api/"
    },
    {
      "name": "simulation_services",
      "role": "OASIS-backed simulation orchestration, IPC, config generation",
      "evidence": "backend/app/services/simulation_*.py, pyproject.toml camel-oasis"
    },
    {
      "name": "zep_integration",
      "role": "Graph memory / entity tooling via Zep Cloud",
      "evidence": "pyproject.toml zep-cloud, README + .env.example ZEP_API_KEY, app/services/zep_*.py"
    }
  ],
  "data_flow_summary": "User uploads and natural-language goals flow from Vue → /api/* → Flask services → LLM + Zep + OASIS simulation; results return to UI as reports and interactive simulation state (exact payload shapes not fully specified in corpus).",
  "dependencies_notable": [
    "flask>=3, flask-cors, openai, zep-cloud==3.13.0, camel-oasis==0.2.5, camel-ai==0.2.78",
    "vue ^3.5, vite ^7, axios, d3"
  ],
  "risks": [
    "High LLM cost and need for API keys (README)",
    "AGPL-3.0 copyleft on distribution of modified versions",
    "Reliance on third-party Zep and LLM availability and quotas"
  ],
  "suggested_entry_files": [
    "backend/run.py",
    "backend/app/__init__.py",
    "backend/app/config.py",
    "frontend/src/main.js",
    "frontend/src/router/index.js"
  ],
  "confidence": "high",
  "gaps": [
    "Request/response schemas for each API route not pasted in corpus",
    "Internal simulation IPC and ReportAgent tool details not excerpted",
    "Exact Zep graph schema and OASIS scenario configs not in corpus"
  ]
}
```

---

### 3) `system_prompt_fragment`

```system_prompt_fragment
You are working on **MiroFish** (666ghj/MiroFish): a **multi-agent prediction and simulation** system. Users provide **seed documents** and **natural-language prediction goals**. The product builds a **graph- and memory-backed** digital world, runs **large-scale agent simulations** using the **OASIS** engine (CAMEL stack) and **Zep Cloud** for graph memory, then delivers **prediction reports** and **interactive** exploration via a web UI.

**Runtime layout:** A **Vue 3 + Vite** frontend listens on **port 3000** in development and proxies **`/api`** to a **Flask** backend on **port 5001** (see `vite.config.js`). The Flask app registers three JSON API blueprints: **`/api/graph`**, **`/api/simulation`**, **`/api/report`**, plus **`GET /health`**. The backend entrypoint is **`backend/run.py`** (`uv run python run.py`); configuration is validated before boot.

**Operational constraints:** You need a working **`.env`** derived from **`.env.example`**: at minimum **`LLM_API_KEY`**, **`LLM_BASE_URL`**, **`LLM_MODEL_NAME`** (OpenAI-compatible client), and **`ZEP_API_KEY`** for Zep. Optional **`LLM_BOOST_*`** keys exist for a secondary “boost” model—omit those env vars entirely if unused. README stresses **high LLM cost**; favor shorter simulations when experimenting. The project is **AGPL-3.0**; treat redistribution of modified versions as copyleft-sensitive.

**Frontend structure:** The UI is organized as a **multi-step flow** (graph build → environment → simulation → report → interaction) with Vue views under `frontend/src/views/` and API wrappers in `frontend/src/api/`. Use the **existing axios + proxy** pattern; do not assume different ports than **3000/5001** unless configuration files change.

**Backend structure:** Business logic lives under **`backend/app/services/`** (simulation runner/manager, report agent, graph builder, Zep helpers). When adding features, extend the appropriate **blueprint** under **`backend/app/api/`** and keep CORS and JSON Unicode behavior consistent with `create_app()`.

**Docker:** `docker-compose.yml` runs a published image with ports **3000** and **5001** and mounts **`backend/uploads`**. Prefer the same API assumptions as local dev unless the image docs differ.

When unsure of API contracts or simulation internals, read **`backend/app/api/*.py`** and **`backend/app/config.py`** before guessing paths or payloads.
```

---

## Verification

- **Poller:** After pulling latest state, run `npm run starred:poll` with `GITHUB_TOKEN` set; expect **`666ghj/MiroFish`** under **new** if still starred.
- **Re-analyze:** Refresh `data/external/MiroFish` (`git pull` or re-clone), update the corpus block above, and re-run the analyzer system prompt.
