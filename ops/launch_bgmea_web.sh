#!/bin/bash
# Launch BGMEA web scraper as detached docker container
cd /opt/sourcebd
docker compose run -d --rm --name sourcebd-bgmea-web \
  --entrypoint python -e PYTHONPATH=/app \
  -v /opt/sourcebd/etl:/app/etl \
  etl -m etl.cli run bgmea_web
echo "started"
docker ps --format '{{.Names}} {{.Status}}' | grep bgmea-web
