#!/usr/bin/env bash
LOG=/opt/sourcebd/etl/logs/bkmea.log
echo "=== TAIL ==="
tail -40 "$LOG"
echo "=== PAGES SUMMARY ==="
grep -oE 'bkmea\.(page|empty_page)' "$LOG" | sort | uniq -c
echo "=== TOTAL ROWS YIELDED (approx via http requests) ==="
grep -c 'HTTP Request' "$LOG"
echo "=== FINAL EVENTS ==="
grep -E '"event":\s*"(run\.complete|run\.error|bkmea\.page|bkmea\.empty_page)"' "$LOG" | tail -20
echo "=== TMUX ==="
tmux ls 2>&1 || echo "no tmux sessions"
