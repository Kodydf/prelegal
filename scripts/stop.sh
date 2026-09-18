#!/usr/bin/env bash
# Stop and remove the Prelegal container.
# Shared by the per-platform stop-*.sh wrappers.
set -euo pipefail
docker rm -f prelegal >/dev/null 2>&1 || true
echo "Prelegal stopped."
