"""GHA public smoke must retry 503s; Caddy must not hold the upstream down."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_gha_public_smoke_retries_instead_of_one_shot_curl() -> None:
    text = (ROOT / ".github/workflows/deploy-production.yml").read_text(encoding="utf-8")
    _, smoke = text.split("Public smoke test", 1)
    assert "until" in smoke
    assert "attempt" in smoke
    assert "sleep 5" in smoke
    assert "-ge 12" in smoke
    assert "api/health" in smoke
    assert 'curl --fail --silent --show-error --max-time 15 "http://${HOST}/api/health"' not in smoke


def test_caddy_does_not_keep_upstream_unhealthy_for_a_health_interval() -> None:
    text = (ROOT / "ops/Caddyfile").read_text(encoding="utf-8")
    directives = [
        line.strip()
        for line in text.splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    assert not any(line.startswith("health_uri") for line in directives)
    assert not any(line.startswith("health_interval") for line in directives)


def test_deploy_vps_waits_for_public_health_before_returning() -> None:
    text = (ROOT / "ops/deploy_vps.sh").read_text(encoding="utf-8")
    _, public = text.split("Public health check", 1)
    assert "until" in public
    assert "sleep 3" in public
    assert "warn \"Public health check failed" not in text
    assert public.index("until") < public.index("deploy OK")
