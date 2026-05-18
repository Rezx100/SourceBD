#!/bin/bash
cd /opt/sourcebd
docker compose run --rm --entrypoint python -e PYTHONPATH=/app -v /opt/sourcebd/ops:/ops etl /ops/audit_quality.py > /tmp/audit.txt 2>&1
echo "=== STATE AFTER fix_quality.py --apply ==="
grep -E "Total suppliers|Suppliers with|Multi-source|rsc_remediation rows|Distinct parent|RSC progress|RSC training" /tmp/audit.txt | head -20
echo
echo "=== COMPLETENESS ==="
grep -E "missing_|^  tag|^  BKMEA|^  RSC " /tmp/audit.txt | head -20
echo
echo "=== DUPLICATES ==="
grep -E "Exact-name|Same-slug|likely-same|sim=1.00|sim=0.9" /tmp/audit.txt | head -50
echo
echo "=== RSC STATUS DIST ==="
grep -A 8 "5b. RSC remediation" /tmp/audit.txt
