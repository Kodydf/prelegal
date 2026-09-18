#!/usr/bin/env bash
# Build and start Prelegal in Docker. App: http://localhost:8000
# Shared by the per-platform start-*.sh wrappers.
set -euo pipefail
cd "$(dirname "$0")/.."

docker build -t prelegal .
docker rm -f prelegal >/dev/null 2>&1 || true
# Branch instead of using an args array: empty arrays break `set -u` on macOS bash 3.2.
if [ -f .env ]; then
  docker run -d --name prelegal -p 8000:8000 --env-file .env prelegal
else
  docker run -d --name prelegal -p 8000:8000 prelegal
fi
echo "Prelegal is running at http://localhost:8000"
