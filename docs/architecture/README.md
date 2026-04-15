# Architecture

- **Data flow arc (hood & gang):** [DATA-FLOW-ARC.md](./DATA-FLOW-ARC.md) — docs → scraper → Obsidian → GitGod knowledge → blog + tweet angles → JSON agent → twitter-agent → fleet.

**Positioning:** GitGod is the CLI + browser layer that captures and stores knowledge; Obsidian is the human-readable vault; downstream agents format and ship to fleet.

## Obsidian sync (not a remote push)

Canonical notes live **in this repo** under `docs/architecture/`. To mirror them into your vault:

1. Set `GITGOD_OBSIDIAN_VAULT` (or `OBSIDIAN_VAULT_PATH`) to your vault root, e.g. `~/Documents/vanta-brain`.
2. Run **`gitgod vault-sync`** anytime, or run **`gitgod enrich …`** — enrich **ends** by copying `README.md` and `DATA-FLOW-ARC.md` into `<vault>/Architecture/`.

That is a **filesystem copy** (local “webhook”), not Obsidian Cloud. Repo stays source of truth; Obsidian opens the copied files.
