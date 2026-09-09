"""Public health waiter retries 503 then succeeds; 404 does not retry forever."""

from __future__ import annotations

import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "ops" / "wait_for_http_ok.py"


def _run(url: str, attempts: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--url",
            url,
            "--attempts",
            str(attempts),
            "--sleep",
            "0.05",
            "--timeout",
            "2",
        ],
        check=False,
        capture_output=True,
        text=True,
    )


def test_cli_retries_503_then_accepts_200() -> None:
    hits = {"n": 0}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            hits["n"] += 1
            if hits["n"] < 3:
                self.send_response(503)
                self.end_headers()
                self.wfile.write(b"unhealthy")
                return
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status":"ok","commit":"abc"}\n')

        def log_message(self, fmt: str, *args: object) -> None:
            return

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        url = f"http://127.0.0.1:{server.server_address[1]}/api/health"
        result = _run(url, attempts=5)
        assert result.returncode == 0, result.stderr
        assert '"status":"ok"' in result.stdout
        assert hits["n"] == 3
    finally:
        server.shutdown()
        server.server_close()


def test_cli_fails_on_persistent_404_without_burning_attempts() -> None:
    hits = {"n": 0}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            hits["n"] += 1
            self.send_response(404)
            self.end_headers()

        def log_message(self, fmt: str, *args: object) -> None:
            return

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        url = f"http://127.0.0.1:{server.server_address[1]}/api/health"
        result = _run(url, attempts=8)
        assert result.returncode == 1
        assert hits["n"] == 1
    finally:
        server.shutdown()
        server.server_close()


def test_cli_fails_on_persistent_503_after_attempts() -> None:
    hits = {"n": 0}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            hits["n"] += 1
            self.send_response(503)
            self.end_headers()
            self.wfile.write(b"unhealthy")

        def log_message(self, fmt: str, *args: object) -> None:
            return

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        url = f"http://127.0.0.1:{server.server_address[1]}/api/health"
        result = _run(url, attempts=4)
        assert result.returncode == 1
        assert hits["n"] == 4
        assert "still failing" in result.stderr
    finally:
        server.shutdown()
        server.server_close()


def test_cli_fails_on_persistent_502_after_attempts() -> None:
    hits = {"n": 0}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            hits["n"] += 1
            self.send_response(502)
            self.end_headers()

        def log_message(self, fmt: str, *args: object) -> None:
            return

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        url = f"http://127.0.0.1:{server.server_address[1]}/api/health"
        result = _run(url, attempts=3)
        assert result.returncode == 1
        assert hits["n"] == 3
    finally:
        server.shutdown()
        server.server_close()


def test_cli_fails_when_nothing_is_listening() -> None:
    result = _run("http://127.0.0.1:1/api/health", attempts=2)
    assert result.returncode == 1
    assert "still failing" in result.stderr
