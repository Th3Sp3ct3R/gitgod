#!/usr/bin/env bash
# Claude Code PostToolUse: stdin is JSON describing the tool call.
# If a knowledge graph file was written, regenerate data/repo-classifications.jsonl.
set -euo pipefail
INPUT=$(cat)
if ! printf '%s' "$INPUT" | grep -q 'knowledge-graph\.json'; then
  exit 0
fi
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"
[ -f package.json ] || exit 0
command -v npm >/dev/null 2>&1 || exit 0
npm run -s classify:json 2>/dev/null || true
exit 0
