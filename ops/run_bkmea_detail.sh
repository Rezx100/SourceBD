#!/usr/bin/env bash
# Run BKMEA detail enrichment in tmux.
set -e
cd /opt/sourcebd
mkdir -p etl/logs
tmux kill-session -t bkmea_detail 2>/dev/null || true
rm -f etl/logs/bkmea_detail.log
tmux new-session -d -s bkmea_detail 'cd /opt/sourcebd && docker compose run --rm etl run bkmea_detail 2>&1 | tee etl/logs/bkmea_detail.log; echo SCRAPER_EXIT=$?'
echo SPAWNED
sleep 2
tmux ls
