"""Public health waiter retries 503 then succeeds; 404 does not retry forever."""

from __future__ import annotations

import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "ops" / "wait_for_http_ok.py"


def _run(
    url: str,
    attempts: int,
    expect_commit: str | None = None,
) -> subprocess.CompletedProcess[str]:
    cmd = [
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
    ]
    if expect_commit is not None:
        cmd.extend(["--expect-commit", expect_commit])
    return subprocess.run(
        cmd,
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


def test_cli_retries_503_then_accepts_matching_commit_with_ts() -> None:
    hits = {"n": 0}
    sha = "273e86778f95b143bfa694aacbc92ecabf5ee591"

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            hits["n"] += 1
            if hits["n"] == 1:
                self.send_response(503)
                self.end_headers()
                self.wfile.write(b"unhealthy")
                return
            self.send_response(200)
            self.end_headers()
            body = (
                '{"status":"ok","commit":"%s","ts":"2026-09-09T11:56:09.919Z"}\n' % sha
            )
            self.wfile.write(body.encode())

        def log_message(self, fmt: str, *args: object) -> None:
            return

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        url = f"http://127.0.0.1:{server.server_address[1]}/api/health"
        result = _run(url, attempts=5, expect_commit=sha)
        assert result.returncode == 0, result.stderr
        assert sha in result.stdout
        assert hits["n"] == 2
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


def test_cli_fails_when_expect_commit_is_empty() -> None:
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--url",
            "http://127.0.0.1:1/api/health",
            "--attempts",
            "1",
            "--expect-commit",
            "",
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 2
    assert "non-empty SHA" in result.stderr


def test_cli_fails_when_expect_commit_is_whitespace() -> None:
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--url",
            "http://127.0.0.1:1/api/health",
            "--attempts",
            "1",
            "--expect-commit",
            "   ",
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 2
    assert "non-empty SHA" in result.stderr


def test_cli_accepts_padded_expect_commit() -> None:
    sha = "273e86778f95b143bfa694aacbc92ecabf5ee591"

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            self.send_response(200)
            self.end_headers()
            self.wfile.write(
                f'{{"status":"ok","commit":"{sha}","ts":"2026-09-09T11:56:09.919Z"}}\n'.encode()
            )

        def log_message(self, fmt: str, *args: object) -> None:
            return

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        url = f"http://127.0.0.1:{server.server_address[1]}/api/health"
        result = _run(url, attempts=2, expect_commit=f"  {sha}  ")
        assert result.returncode == 0, result.stderr
        assert sha in result.stdout
    finally:
        server.shutdown()
        server.server_close()


def test_cli_fails_when_nothing_is_listening() -> None:
    result = _run("http://127.0.0.1:1/api/health", attempts=2)
    assert result.returncode == 1
    assert "still failing" in result.stderr


def test_cli_rejects_stale_200_when_commit_does_not_match() -> None:
    hits = {"n": 0}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            hits["n"] += 1
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status":"ok","commit":"2f3a3d2fef6cbbbf716600f972f8b1b4be5ea77f"}\n')

        def log_message(self, fmt: str, *args: object) -> None:
            return

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        url = f"http://127.0.0.1:{server.server_address[1]}/api/health"
        result = _run(url, attempts=3, expect_commit="273e86778f95b143bfa694aacbc92ecabf5ee591")
        assert result.returncode == 1
        assert hits["n"] == 3
        assert "commit" in result.stderr
        assert "2f3a3d2" in result.stderr
    finally:
        server.shutdown()
        server.server_close()


def test_cli_retries_503_then_rejects_stale_200_when_expect_commit_mismatches() -> None:
    hits = {"n": 0}
    want = "273e86778f95b143bfa694aacbc92ecabf5ee591"
    stale = "2f3a3d2fef6cbbbf716600f972f8b1b4be5ea77f"

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            hits["n"] += 1
            if hits["n"] == 1:
                self.send_response(503)
                self.end_headers()
                self.wfile.write(b"unhealthy")
                return
            self.send_response(200)
            self.end_headers()
            body = '{"status":"ok","commit":"%s","ts":"2026-09-09T11:56:09.919Z"}\n' % stale
            self.wfile.write(body.encode())

        def log_message(self, fmt: str, *args: object) -> None:
            return

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        url = f"http://127.0.0.1:{server.server_address[1]}/api/health"
        result = _run(url, attempts=4, expect_commit=want)
        assert result.returncode == 1
        assert hits["n"] == 4
        assert "2f3a3d2" in result.stderr
    finally:
        server.shutdown()
        server.server_close()


def test_cli_retries_503_then_stale_200_then_accepts_matching_commit() -> None:
    hits = {"n": 0}
    want = "273e86778f95b143bfa694aacbc92ecabf5ee591"
    stale = "2f3a3d2fef6cbbbf716600f972f8b1b4be5ea77f"

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            hits["n"] += 1
            if hits["n"] == 1:
                self.send_response(503)
                self.end_headers()
                self.wfile.write(b"unhealthy")
                return
            commit = stale if hits["n"] == 2 else want
            self.send_response(200)
            self.end_headers()
            body = '{"status":"ok","commit":"%s","ts":"2026-09-09T11:56:09.919Z"}\n' % commit
            self.wfile.write(body.encode())

        def log_message(self, fmt: str, *args: object) -> None:
            return

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        url = f"http://127.0.0.1:{server.server_address[1]}/api/health"
        result = _run(url, attempts=5, expect_commit=want)
        assert result.returncode == 0, result.stderr
        assert want in result.stdout
        assert hits["n"] == 3
    finally:
        server.shutdown()
        server.server_close()


def test_cli_accepts_200_once_commit_matches() -> None:
    hits = {"n": 0}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            hits["n"] += 1
            commit = "oldsha" if hits["n"] < 2 else "newsha"
            self.send_response(200)
            self.end_headers()
            self.wfile.write(f'{{"status":"ok","commit":"{commit}"}}\n'.encode())

        def log_message(self, fmt: str, *args: object) -> None:
            return

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        url = f"http://127.0.0.1:{server.server_address[1]}/api/health"
        result = _run(url, attempts=4, expect_commit="newsha")
        assert result.returncode == 0, result.stderr
        assert hits["n"] == 2
        assert '"commit":"newsha"' in result.stdout
    finally:
        server.shutdown()
        server.server_close()
