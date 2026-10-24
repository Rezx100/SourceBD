"""The founder's yes/no on Volza matches the scripts could not settle (ambiguous or likely).

No Volza calls, no credit. Lists every supplier whose newest complete row found shipments but is not
shown (several exporters under the name, an exact search that kept under 90%, or Volza's spelling
differing from ours), with what each search found, and stores the answer in etl/raw/volza/review.json:

  all    every shipment the name search found is this supplier's
  exact  only the shipments of the exact-name search are
  no     not this supplier; it stays hidden

A yes ("all" or "exact") is fetched in the next launch batch: that one search again for the latest
shipment, then the four markets and the small-orders search (about $0.75 each), and is then shown.

  python ops/volza_review.py            # the list, in the console
  python ops/volza_review.py --serve    # the same list as a page at http://127.0.0.1:8770 with buttons
"""

from __future__ import annotations

import argparse
import html
import json
import sys
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs

sys.path.insert(0, str(Path(__file__).resolve().parent))

from volza_company_list import load  # noqa: E402
from volza_export_dryrun import RAW  # noqa: E402
from volza_load_sample import shown_class  # noqa: E402

REVIEW = RAW / "review.json"
CHOICES = {"all": "Yes, all of the name search", "exact": "Yes, only the exact search", "no": "No, not ours"}


def decisions() -> dict[str, dict[str, Any]]:
    return json.loads(REVIEW.read_text(encoding="utf-8")) if REVIEW.exists() else {}


def decide(sid: str, choice: str, name: str) -> None:
    if choice not in CHOICES:
        raise ValueError(choice)
    d = decisions()
    d[sid] = {"decision": choice, "name": name, "at": datetime.now(timezone.utc).replace(microsecond=0).isoformat()}
    REVIEW.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")


def newest() -> dict[str, dict[str, Any]]:
    """The newest complete row of every supplier fetched so far (later files win)."""
    files = [RAW / f for f in ("live_sample.jsonl", "batch_1.jsonl", "refetch_1.jsonl")]
    files += sorted(RAW.glob("launch_*.jsonl"))
    return {r["id"]: r for f in files if f.exists() for r in load(f) if not r.get("partial")}


def name_search(r: dict[str, Any]) -> list[Any] | None:
    """The last starts-with search that found shipments: [name, status, shipments, exporters]."""
    return next((t for t in reversed(r["tried"]) if not str(t[0]).startswith("exact:") and t[2]), None)


def queue() -> list[dict[str, Any]]:
    """Unsure suppliers, the ones a yes has already been fetched for left out."""
    rows = [r for r in newest().values() if r["shipments"] and not r.get("review")]
    return sorted((r for r in rows if shown_class(r) != "exact"), key=lambda r: r["name"].lower())


def evidence(r: dict[str, Any]) -> dict[str, Any]:
    ns, ex, top = name_search(r), r.get("exact_check"), r.get("top") or {}
    return {
        "name_search": f"{ns[2]:,} shipments under {ns[3]} exporter name(s), searching '{ns[0]}'" if ns else "",
        "exact_search": (f"{ex['shipments']:,} shipments" if ex else "not run"),
        "volza_spelling": r.get("volza_supplier") or top.get("supplier_name") or "",
        "city": ", ".join(x for x in (top.get("supplier_city"), top.get("supplier_country")) if x),
        "shipment": " · ".join(str(x) for x in (str(top.get("shipment_date") or "")[:10], top.get("buyer_name"),
                                                 top.get("product_description"), top.get("destination_country")) if x),
    }


def page(rows: list[dict[str, Any]], done: dict[str, dict[str, Any]]) -> str:
    cards = []
    for r in rows:
        e, d = evidence(r), done.get(r["id"], {}).get("decision")
        buttons = "".join(
            f'<button name="choice" value="{k}"{" class=on" if d == k else ""}>{html.escape(v)}</button>'
            for k, v in CHOICES.items() if k != "exact" or r.get("exact_check", {}).get("shipments"))
        lines = "".join(f"<dt>{html.escape(k.replace('_', ' '))}</dt><dd>{html.escape(str(v))}</dd>"
                        for k, v in e.items() if v)
        cards.append(f'<form id="s-{r["id"]}" method=post action=/decide><h2>{html.escape(r["name"])}</h2>'
                     f'<p class=slug>{html.escape(r["slug"])}</p><dl>{lines}</dl>'
                     f'<input type=hidden name=id value="{r["id"]}"><input type=hidden name=name '
                     f'value="{html.escape(r["name"])}">{buttons}</form>')
    left = sum(1 for r in rows if r["id"] not in done)
    return f"""<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width">
<title>Volza review</title><style>
body{{font:15px/1.5 system-ui;max-width:760px;margin:24px auto;padding:0 16px;background:#fafaf8;color:#1a1a1a}}
form{{background:#fff;border:1px solid #ddd;border-radius:8px;padding:14px 16px;margin:12px 0;scroll-margin-top:12px}}
h2{{margin:0;font-size:17px}} .slug{{margin:0;color:#777;font-size:13px}}
dl{{display:grid;grid-template-columns:130px 1fr;gap:2px 10px;margin:10px 0}} dt{{color:#666}} dd{{margin:0}}
button{{font:inherit;padding:6px 12px;margin:4px 6px 0 0;border:1px solid #bbb;border-radius:6px;background:#fff;cursor:pointer}}
button.on{{background:#1a1a1a;color:#fff;border-color:#1a1a1a}}
</style><h1>Is this our company?</h1><p>{left} of {len(rows)} still to answer. A yes is fetched and shown
after the next batch; a no stays hidden. You can change an answer until then.</p>{"".join(cards)}
<form method=post action=/done><button>Done, close the page</button></form>"""


def serve(port: int) -> None:
    class H(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            self._send(200, page(queue(), decisions()))

        def do_POST(self) -> None:
            if self.path == "/done":  # Ctrl+C does not reach a waiting server on Windows
                self._send(200, "<p style='font:16px system-ui;margin:40px'>Saved. You can close this tab.</p>")
                threading.Thread(target=server.shutdown).start()
                return
            f = parse_qs(self.rfile.read(int(self.headers.get("Content-Length", 0))).decode())
            try:
                decide(f["id"][0], f["choice"][0], f["name"][0])
            except (KeyError, ValueError):
                self._send(400, "bad answer")
                return
            self.send_response(303)
            self.send_header("Location", f"/#s-{f['id'][0]}")  # back to the card just answered, not the top
            self.end_headers()

        def _send(self, code: int, body: str) -> None:
            self.send_response(code)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(body.encode())

        def log_message(self, *_: Any) -> None:
            pass

    print(f"review page at http://127.0.0.1:{port}; press Done on the page to stop. Answers go to {REVIEW}")
    server = HTTPServer(("127.0.0.1", port), H)
    server.serve_forever()
    print("review page closed")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--serve", action="store_true", help="open the page with buttons")
    p.add_argument("--port", type=int, default=8770)
    a = p.parse_args()
    if a.serve:
        serve(a.port)
        return
    done = decisions()
    for r in queue():
        e = evidence(r)
        print(f"[{done.get(r['id'], {}).get('decision', '?'):5}] {r['name']}  ({r['id']})")
        for k, v in e.items():
            if v:
                print(f"         {k}: {v}")


if __name__ == "__main__":
    main()
