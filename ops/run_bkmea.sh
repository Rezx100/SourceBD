#!/usr/bin/env bash
set -e
cd /opt/sourcebd
rm -f etl/logs/bkmea.log
tmux kill-session -t bkmea 2>/dev/null || true
tmux new-session -d -s bkmea 'cd /opt/sourcebd && docker compose run --rm etl run bkmea_web 2>&1 | tee etl/logs/bkmea.log; echo SCRAPER_EXIT=$?'
echo SPAWNED
sleep 2
tmux ls
