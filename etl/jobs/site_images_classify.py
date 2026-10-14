"""Claude labels each site's pictures: the company's own logo, a product photo, or neither.

Second step after `site-images` (etl/jobs/site_images.py), started by hand on the
server. For every finished site it sends the stored logo and photos to Claude
Opus through the Message Batches API (half price, results within hours) and
writes the answer next to the files:

    site-images/<domain>/verdict.json   every picture with its label and decision
    site-images/verdicts.csv            one row per picture, all sites
    site-images/_batches.json           batches sent and not yet collected

A decision is `approved` only when Claude is sure: a sure "own logo", or a sure
"product". A sure "something else" is `rejected`. Everything Claude is unsure
about, and anything it could not see (SVG files, a refused or failed request),
is `review`, which is what the founder looks at. Nothing is written to the
database and nothing reaches a profile from here.

Resumable: a site with a verdict is skipped, a site already in a sent batch is
collected rather than sent twice, so an interrupted run is simply run again.

    docker compose run --rm -T etl site-images-classify --limit 40
    docker compose run --rm -T etl site-images-classify
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import csv
import io
import json
import re
import time
from typing import Any

from etl.jobs.site_images import FINISHED, PREFIX, load_suppliers, plan, read_metas

MODEL = "claude-opus-5-5"
THUMB_SIDE = 768
MAX_BATCH_BYTES = 180 * 1024 * 1024  # the API's limit is 256 MB per batch
POLL_SEC = 60
KINDS = ["product", "factory", "people", "certificate", "brand_logo", "text_graphic", "other"]
BATCHES_FILE = f"{PREFIX}/_batches.json"

SYSTEM = """You sort pictures taken from the website of a Bangladesh garment-industry \
supplier (a factory, buying house, or maker of fabric, yarn, trims, labels or packaging). \
A buyer directory will show the company's logo and photos of what it makes, so be strict.

The company's own logo: the brand mark or wordmark of this company or its group. Not a \
buyer's brand it makes goods for (H&M, US Polo Assn, Zara...), not a certifier or \
association (BSCI, OEKO-TEX, GOTS, WRAP, BGMEA...), not a social-media or payment icon.

Kinds for every other picture:
- product: the main subject is something this supplier makes or sells: garments (on a \
model, flat, folded, hanging), fabric, yarn, labels, trims, buttons, zips, hangers, \
cartons, packaging. A collage of products counts.
- factory: machines, production floors, warehouses, buildings, workers at machines.
- people: staff, management, visitors, events, group photos (a model wearing a product \
is product).
- certificate: certificates, audit documents, award plaques.
- brand_logo: any logo or mark on its own.
- text_graphic: a graphic that is mostly words, a slogan or a banner.
- other: anything else (stock photos of cities, nature, abstract backgrounds, icons).

Mark sure only when you would bet on the answer without seeing more. Small, blurry, \
cropped or mixed pictures are not sure."""

SCHEMA = {
    "type": "object",
    "properties": {
        "logo": {
            "type": "object",
            "properties": {
                "is_own_logo": {"type": "string", "enum": ["yes", "no", "unsure", "no_logo_given"]},
                "note": {"type": "string"},
            },
            "required": ["is_own_logo", "note"],
            "additionalProperties": False,
        },
        "pictures": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "index": {"type": "integer"},
                    "kind": {"type": "string", "enum": KINDS},
                    "sure": {"type": "boolean"},
                },
                "required": ["index", "kind", "sure"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["logo", "pictures"],
    "additionalProperties": False,
}


# ------------------------------------------------------------------- pictures
def thumbnail(data: bytes) -> str | None:
    """A JPEG of at most THUMB_SIDE px, base64. None for SVG or unreadable bytes.

    Transparency is laid on mid grey, so a white logo stays visible and a dark
    one does too.
    """
    from PIL import Image

    try:
        with Image.open(io.BytesIO(data)) as im:
            im.load()
            im = im.convert("RGBA")
            ground = Image.new("RGBA", im.size, (200, 200, 200, 255))
            ground.alpha_composite(im)
            rgb = ground.convert("RGB")
            rgb.thumbnail((THUMB_SIDE, THUMB_SIDE))
            out = io.BytesIO()
            rgb.save(out, "JPEG", quality=85)
    except Exception:  # noqa: BLE001 - Pillow raises many types for bad bytes
        return None
    return base64.standard_b64encode(out.getvalue()).decode("ascii")


def custom_id(domain: str) -> str:
    """Batch ids allow [A-Za-z0-9_-] only, up to 64 characters."""
    return re.sub(r"[^A-Za-z0-9_-]", "_", domain)[:64]


def build_request(domain: str, names: list[str], meta: dict[str, Any],
                  thumbs: dict[str, str | None]) -> dict[str, Any]:
    """One Messages request covering a site's logo and every photo.

    `thumbs` maps a stored file name to its thumbnail (None when it could not
    be shown). Pictures are numbered in the order of meta["products"].
    """
    who = ", ".join(names[:8]) + (f" and {len(names) - 8} more" if len(names) > 8 else "")
    content: list[dict[str, Any]] = [{
        "type": "text",
        "text": f"Website: {domain}\nCompanies that list this website: {who or 'unknown'}",
    }]
    logo = meta.get("logo") or {}
    logo_thumb = thumbs.get(logo.get("file", ""))
    if logo_thumb:
        label = "the site's logo" if meta.get("logo_kind") == "logo" else "the site's app icon"
        content += [{"type": "text", "text": f"Logo candidate ({label}):"},
                    _image(logo_thumb)]
    else:
        content.append({"type": "text", "text": "Logo candidate: none given."})
    for i, p in enumerate(meta.get("products") or []):
        t = thumbs.get(p["file"])
        if t:
            content += [{"type": "text", "text": f"Picture {i}:"}, _image(t)]
    content.append({"type": "text", "text": (
        "Say whether the logo candidate is this company's own logo, then give the kind "
        "of every numbered picture, using its number as index.")})
    return {
        "custom_id": custom_id(domain),
        "params": {
            "model": MODEL,
            "max_tokens": 16000,
            "system": SYSTEM,
            "output_config": {"effort": "medium", "format": {"type": "json_schema", "schema": SCHEMA}},
            "messages": [{"role": "user", "content": content}],
        },
    }


def _image(b64: str) -> dict[str, Any]:
    return {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}}


# ------------------------------------------------------------------- decisions
def decide(meta: dict[str, Any], shown: set[str], answer: dict[str, Any] | None) -> dict[str, Any]:
    """Turn Claude's answer into approved / rejected / review per picture.

    `shown` is the files Claude was sent (an SVG or unreadable file is not).
    `answer` is None when the request failed or was refused: everything goes
    to review rather than being guessed.
    """
    rows: list[dict[str, Any]] = []
    logo = meta.get("logo")
    if logo:
        said = (answer or {}).get("logo", {}).get("is_own_logo") if logo["file"] in shown else None
        decision = {"yes": "approved", "no": "rejected"}.get(said or "", "review")
        rows.append({"role": "logo", "file": logo["file"], "cdn": logo.get("cdn", ""),
                     "kind": f"logo:{said or 'not_seen'}", "sure": said in ("yes", "no"),
                     "decision": decision, "note": (answer or {}).get("logo", {}).get("note", "")})
    by_index = {p.get("index"): p for p in (answer or {}).get("pictures", [])}
    for i, p in enumerate(meta.get("products") or []):
        got = by_index.get(i) if p["file"] in shown else None
        if got is None:
            decision, kind, sure = "review", "not_seen", False
        else:
            kind, sure = got["kind"], bool(got["sure"])
            decision = "review" if not sure else ("approved" if kind == "product" else "rejected")
        rows.append({"role": "photo", "file": p["file"], "cdn": p.get("cdn", ""), "kind": kind,
                     "sure": sure, "decision": decision, "note": ""})
    return {"domain": meta["domain"], "model": MODEL, "answered": answer is not None, "pictures": rows}


def answer_from_message(message: Any) -> dict[str, Any] | None:
    """The JSON answer of a finished message, or None for a refusal or bad output."""
    if getattr(message, "stop_reason", None) != "end_turn":
        return None
    text = next((b.text for b in message.content if getattr(b, "type", "") == "text"), "")
    try:
        data = json.loads(text)
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


# ------------------------------------------------------------------------ run
async def _read_json(path: str) -> Any:
    from etl.core import bunny

    raw = await bunny.read(path)
    return json.loads(raw) if raw else None


async def _write_json(path: str, value: Any) -> None:
    from etl.core import bunny

    await bunny.upload(path, json.dumps(value, indent=1).encode(), "application/json")


async def load_thumbs(meta: dict[str, Any], sem: asyncio.Semaphore) -> dict[str, str | None]:
    from etl.core import bunny

    files = ([meta["logo"]["file"]] if meta.get("logo") else []) + [p["file"] for p in meta.get("products") or []]

    async def one(name: str) -> tuple[str, str | None]:
        async with sem:
            try:
                raw = await bunny.read(f"{PREFIX}/{meta['domain']}/{name}")
            except Exception:  # noqa: BLE001 - a missing file is shown as unseen
                raw = None
        return name, await asyncio.to_thread(thumbnail, raw) if raw else None

    return dict(await asyncio.gather(*(one(f) for f in files)))


async def collect(client: Any, batch: dict[str, Any], metas: dict[str, dict[str, Any]]) -> int:
    """Write the verdicts of one ended batch. Returns how many sites got one.

    A request that errored, expired or was cancelled on Anthropic's side gets
    no verdict, so the next run sends it again. A refusal or an unreadable
    answer is a real answer: its pictures go to review.
    """
    results = await asyncio.to_thread(lambda: list(client.messages.batches.results(batch["id"])))
    answers = {
        res.custom_id: answer_from_message(res.result.message)
        for res in results if res.result.type == "succeeded"
    }
    written = 0
    for cid, domain in batch["domains"].items():
        meta = metas.get(domain)
        if not meta or cid not in answers:
            continue
        verdict = decide(meta, set(batch["shown"].get(domain, [])), answers.get(cid))
        await _write_json(f"{PREFIX}/{domain}/verdict.json", verdict)
        written += 1
    return written


def make_client() -> Any:
    import anthropic

    from etl.core.config import settings

    if not settings.anthropic_api_key:
        raise SystemExit("ANTHROPIC_API_KEY must be set in .env")
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


async def run(args: argparse.Namespace) -> None:
    client = make_client()
    suppliers = load_suppliers()
    domains = plan(suppliers)
    names: dict[str, list[str]] = {}
    for s in suppliers:
        if s.get("_domain") in domains:
            names.setdefault(s["_domain"], []).append(s.get("company_name") or "")
    metas = await read_metas(sorted(domains))
    pending: list[dict[str, Any]] = await _read_json(BATCHES_FILE) or []

    # 1. Collect what earlier runs sent.
    for batch in [b for b in pending if not b.get("collected")]:
        state = await asyncio.to_thread(client.messages.batches.retrieve, batch["id"])
        if state.processing_status == "ended":
            n = await collect(client, batch, metas)
            batch["collected"] = True
            print(f"collected batch {batch['id']}: {n} sites", flush=True)
    await _write_json(BATCHES_FILE, pending)
    in_flight = {d for b in pending if not b.get("collected") for d in b["domains"].values()}

    # 2. Send the sites that have pictures and no verdict yet.
    candidates = [d for d in sorted(domains) if metas[d].get("status") in FINISHED
                  and (metas[d].get("logo") or metas[d].get("products"))]
    if args.domain:
        candidates = [d for d in candidates if d == args.domain]
    have = await asyncio.gather(*(_read_json(f"{PREFIX}/{d}/verdict.json") for d in candidates))
    todo = [d for d, v in zip(candidates, have) if (args.force or not v) and d not in in_flight]
    if args.limit:
        todo = todo[: args.limit]
    pictures = sum(len(metas[d].get("products") or []) + bool(metas[d].get("logo")) for d in todo)
    print(f"{len(candidates)} sites with pictures; {len(in_flight)} waiting in sent batches; "
          f"sending {len(todo)} sites, {pictures} pictures", flush=True)

    # Sent as each batch fills, so only one batch of thumbnails is ever in memory.
    sem = asyncio.Semaphore(16)
    chunk: list[dict[str, Any]] = []
    chunk_bytes = 0
    sent_for: dict[str, str] = {}  # custom id -> domain
    shown: dict[str, list[str]] = {}

    async def send() -> None:
        nonlocal chunk, chunk_bytes
        if not chunk:
            return
        batch = await asyncio.to_thread(client.messages.batches.create, requests=chunk)
        ids = {r["custom_id"]: sent_for[r["custom_id"]] for r in chunk}
        pending.append({"id": batch.id, "domains": ids, "shown": {d: shown[d] for d in ids.values()},
                        "collected": False, "sent": time.time()})
        await _write_json(BATCHES_FILE, pending)
        print(f"sent batch {batch.id} with {len(chunk)} sites", flush=True)
        chunk, chunk_bytes = [], 0

    for i, d in enumerate(todo, 1):
        cid = custom_id(d)
        if cid in sent_for:
            print(f"{d}: same batch id as {sent_for[cid]}; left for the next run", flush=True)
            continue
        thumbs = await load_thumbs(metas[d], sem)
        sent_for[cid] = d
        shown[d] = [name for name, t in thumbs.items() if t]
        req = build_request(d, names.get(d, []), metas[d], thumbs)
        size = len(json.dumps(req))
        if chunk and chunk_bytes + size > MAX_BATCH_BYTES:
            await send()
        chunk.append(req)
        chunk_bytes += size
        if i % 50 == 0:
            print(f"  prepared {i}/{len(todo)}", flush=True)
    await send()

    # 3. Wait for every open batch and collect it.
    waiting = [b for b in pending if not b.get("collected")]
    while waiting:
        await asyncio.sleep(POLL_SEC)
        for batch in list(waiting):
            state = await asyncio.to_thread(client.messages.batches.retrieve, batch["id"])
            if state.processing_status != "ended":
                continue
            n = await collect(client, batch, metas)
            batch["collected"] = True
            waiting.remove(batch)
            await _write_json(BATCHES_FILE, pending)
            print(f"collected batch {batch['id']}: {n} sites", flush=True)
        if waiting:
            print(f"waiting for {len(waiting)} batch(es)", flush=True)

    await write_summary(sorted(domains))


async def write_summary(domains: list[str]) -> None:
    from etl.core import bunny

    verdicts = await asyncio.gather(*(_read_json(f"{PREFIX}/{d}/verdict.json") for d in domains))
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=["domain", "role", "file", "cdn", "kind", "sure", "decision", "note"])
    w.writeheader()
    counts: dict[str, int] = {}
    for v in verdicts:
        for p in (v or {}).get("pictures", []):
            w.writerow({"domain": v["domain"], **p})
            key = f"{p['role']} {p['decision']}"
            counts[key] = counts.get(key, 0) + 1
    cdn = await bunny.upload(f"{PREFIX}/verdicts.csv", buf.getvalue().encode("utf-8"), "text/csv")
    print("pictures:", ", ".join(f"{k} {n}" for k, n in sorted(counts.items())))
    print(f"verdicts at {cdn}")
