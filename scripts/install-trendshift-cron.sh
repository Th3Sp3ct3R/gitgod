#!/usr/bin/env bash
# install-trendshift-cron.sh
#
# Installs the Trendshift explore pipeline cron job.
# Runs every 3 days at 06:00 UTC.
#
# Usage:
#   bash scripts/install-trendshift-cron.sh
#
# To uninstall, run:
#   crontab -l | grep -v 'trendshift-explore-cron' | crontab -

set -euo pipefail

GITGOD_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CRON_SCRIPT="${GITGOD_DIR}/scripts/trendshift-explore-cron.sh"
LOG_DIR="${GITGOD_DIR}/logs"

# Ensure the cron script is executable
chmod +x "${CRON_SCRIPT}"

# Create log directory
mkdir -p "${LOG_DIR}"

# Cron schedule: every 3 days at 06:00 UTC
CRON_ENTRY="0 6 */3 * * ${CRON_SCRIPT}"

# Check if the cron job already exists
EXISTING=$(crontab -l 2>/dev/null || true)
if echo "${EXISTING}" | grep -qF "trendshift-explore-cron"; then
  echo "Cron job already installed. Updating..."
  # Remove existing entry and re-add
  FILTERED=$(echo "${EXISTING}" | grep -vF "trendshift-explore-cron")
  echo "${FILTERED}" | { cat; echo "${CRON_ENTRY}"; } | crontab -
else
  echo "Installing cron job..."
  { echo "${EXISTING}"; echo "${CRON_ENTRY}"; } | crontab -
fi

echo ""
echo "Cron job installed:"
echo "  Schedule: Every 3 days at 06:00 UTC"
echo "  Script:   ${CRON_SCRIPT}"
echo "  Logs:     ${LOG_DIR}/trendshift-explore-<date>.log"
echo ""
echo "Current crontab:"
crontab -l | grep "trendshift"
