#!/usr/bin/env bash
# trendshift-explore-cron.sh
#
# Runs the Trendshift daily explore pipeline and logs output.
# Designed to be called by cron every 3 days.
#
# Crontab entry (every 3 days at 06:00 UTC):
#   0 6 */3 * * /Users/growthgod/gitgod/scripts/trendshift-explore-cron.sh
#
# To install:
#   bash /Users/growthgod/gitgod/scripts/install-trendshift-cron.sh

set -euo pipefail

GITGOD_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${GITGOD_DIR}/logs"
DATE="$(date +%Y-%m-%d)"
LOG_FILE="${LOG_DIR}/trendshift-explore-${DATE}.log"

mkdir -p "${LOG_DIR}"

echo "=== Trendshift Explore Pipeline ===" >> "${LOG_FILE}"
echo "Date: ${DATE}" >> "${LOG_FILE}"
echo "Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "${LOG_FILE}"
echo "" >> "${LOG_FILE}"

cd "${GITGOD_DIR}"

# Run the explore pipeline
npx tsx src/cli.ts trendshift-explore-pipeline --date "${DATE}" >> "${LOG_FILE}" 2>&1
EXIT_CODE=$?

echo "" >> "${LOG_FILE}"
echo "Finished: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "${LOG_FILE}"
echo "Exit code: ${EXIT_CODE}" >> "${LOG_FILE}"

exit ${EXIT_CODE}
