"""GHA public smoke must retry 503s; Caddy must not hold the upstream down."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _workflow() -> str:
    return (ROOT / ".github/workflows/deploy-production.yml").read_text(encoding="utf-8")


def _smoke_run_script(text: str) -> str:
    _, rest = text.split("Public smoke test", 1)
    _, run = rest.split("run: |", 1)
    return run.strip()


def test_gha_public_smoke_retries_instead_of_one_shot_curl() -> None:
    text = _workflow()
    assert text.index("Deploy to VPS via SSH") < text.index("Public smoke test")
    assert text.index("actions/checkout@v4") < text.index("Public smoke test")
    run = _smoke_run_script(text)
    assert "ops/wait_for_http_ok.py" in run
    assert "--attempts 12" in run
    assert "--sleep 5" in run
    assert '--url "http://${{ secrets.VPS_HOST }}/api/health"' in run
    assert "continue-on-error" not in text.split("Public smoke test", 1)[1]
    assert "|| true" not in run
    assert "|| echo" not in run
    assert 'curl --fail --silent --show-error --max-time 15 "http://${HOST}/api/health"' not in run


def test_caddy_does_not_keep_upstream_unhealthy_for_a_health_interval() -> None:
    text = (ROOT / "ops/Caddyfile").read_text(encoding="utf-8")
    directives = [
        line.strip()
        for line in text.splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    assert not any(line.startswith("health_uri") for line in directives)
    assert not any(line.startswith("health_interval") for line in directives)
    assert any(line.startswith("reverse_proxy 127.0.0.1:3000") for line in directives)


def test_deploy_vps_waits_for_public_health_before_returning() -> None:
    text = (ROOT / "ops/deploy_vps.sh").read_text(encoding="utf-8")
    _, public = text.split("Public health check", 1)
    assert "until" in public
    assert "sleep 3" in public
    assert "die " in public
    assert public.index("until") < public.index("die ")
    assert public.index("die ") < public.index("deploy OK")
    assert "warn \"Public health check failed" not in text
