#!/usr/bin/env bash
# Smoke checks for fleet-status and (when sessions exist) profile + search.
# Login is interactive and credential-based — run manually:
#   python agent.py login <handle> <email> <password>
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PY="${ROOT}/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  PY="python3"
fi

echo "== fleet-status =="
"$PY" agent.py fleet-status

if compgen -G "${ROOT}/sessions/"*.cookies > /dev/null 2>&1; then
  echo "== profile (first session handle) =="
  HANDLE="$(basename "$(ls -1 "${ROOT}/sessions/"*.cookies | head -1)" .cookies)"
  "$PY" agent.py profile "$HANDLE" || true
  echo "== search (sample) =="
  "$PY" agent.py search "test" --count 5 || true
else
  echo "No sessions/*.cookies yet — skipping profile/search. Run: python agent.py login <handle> <email> <password>"
fi
