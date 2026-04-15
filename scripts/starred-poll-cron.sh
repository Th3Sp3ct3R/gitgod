#!/usr/bin/env bash
# Cron wrapper for poll-github-starred.ts — RSS-style polling (no GitHub push API).
#
# Each run compares GitHub (stars + star lists) to data/github-starred-state.json.
# Only *deltas* POST to STARWEBHOOK_URL / Telegram / local ingest — like fetching an RSS feed on a timer.
#
# First run with no state file: writes baseline only — no webhooks (by design).
# After that: new stars and list add/remove events fire on the next poll.
#
# Install (edit paths; use `which node` / your Node if not using nvm):
#   chmod +x scripts/starred-poll-cron.sh
#   crontab -e
#
# Examples:
#   */10 * * * * /full/path/to/gitgod/scripts/starred-poll-cron.sh
#   */15 * * * * /full/path/to/gitgod/scripts/starred-poll-cron.sh
#
# Logs append to data/starred-poll.log (create data/ if missing).
#
# Requires repo-root `.env` with at least GITHUB_TOKEN. Optional: STARWEBHOOK_URL,
# STARWEBHOOK_SECRET, TELEGRAM_*, Hermes routing (see .env.example).
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$DIR/data/starred-poll.log"
export PATH="/Users/growthgod/.nvm/versions/node/v24.10.0/bin:$PATH"
TSX="$DIR/node_modules/.bin/tsx"

set -a
if [ -f "$DIR/.env" ]; then
  # shellcheck disable=SC1091
  . "$DIR/.env"
fi
set +a

cd "$DIR"
echo "--- $(date -Iseconds) ---" >> "$LOG"
"$TSX" scripts/poll-github-starred.ts --verbose >> "$LOG" 2>&1
