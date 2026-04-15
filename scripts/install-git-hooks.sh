#!/usr/bin/env bash
# Point this repo at .githooks/ so post-merge / pre-push run automatically.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
git config core.hooksPath .githooks
chmod +x .githooks/* scripts/hooks/*.sh 2>/dev/null || true
echo "git core.hooksPath -> .githooks"
echo "Tip: GITGOD_SKIP_HOOKS=1 disables post-merge classify; GITGOD_PRE_PUSH_TEST=1 enables npm test on push."
