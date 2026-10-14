"""How Claude's answers about a site's pictures become approved, rejected or review."""
import asyncio
import base64
import io
import json
from types import SimpleNamespace

from PIL import Image

from etl.jobs import site_images_classify as sic
from etl.jobs.site_images_classify import (
    SCHEMA,
    answer_from_message,
    build_request,
    custom_id,
    decide,
    thumbnail,
)

META = {
    "domain": "acme.com",
    "logo_kind": "logo",
    "logo": {"file": "logo.png", "cdn": "https://cdn/acme.com/logo.png"},
    "products": [
        {"file": "products/a.jpg", "cdn": "https://cdn/acme.com/products/a.jpg"},
        {"file": "products/b.jpg", "cdn": "https://cdn/acme.com/products/b.jpg"},
        {"file": "products/c.jpg", "cdn": "https://cdn/acme.com/products/c.jpg"},
        {"file": "products/d.jpg", "cdn": "https://cdn/acme.com/products/d.jpg"},
    ],
}
ALL = {"logo.png", "products/a.jpg", "products/b.jpg", "products/c.jpg", "products/d.jpg"}


def _decisions(verdict):
    return {p["file"]: p["decision"] for p in verdict["pictures"]}


def test_only_sure_answers_are_decided_and_everything_unsure_goes_to_review():
    answer = {
        "logo": {"is_own_logo": "yes", "note": ""},
        "pictures": [
            {"index": 0, "kind": "product", "sure": True},
            {"index": 1, "kind": "product", "sure": False},
            {"index": 2, "kind": "factory", "sure": True},
            {"index": 3, "kind": "people", "sure": False},
        ],
    }
    assert _decisions(decide(META, ALL, answer)) == {
        "logo.png": "approved",
        "products/a.jpg": "approved",
        "products/b.jpg": "review",
        "products/c.jpg": "rejected",
        "products/d.jpg": "review",
    }


def test_a_buyers_logo_is_rejected_and_an_unsure_one_is_reviewed():
    for said, decision in (("no", "rejected"), ("unsure", "review"), ("no_logo_given", "review")):
        verdict = decide(META, ALL, {"logo": {"is_own_logo": said, "note": "H&M"}, "pictures": []})
        assert _decisions(verdict)["logo.png"] == decision


def test_pictures_claude_never_saw_or_never_answered_are_reviewed():
    shown = ALL - {"logo.png", "products/b.jpg"}  # an SVG logo and an unreadable photo
    answer = {
        "logo": {"is_own_logo": "yes", "note": ""},
        "pictures": [{"index": 1, "kind": "product", "sure": True}],  # about a picture it was not sent
    }
    got = _decisions(decide(META, shown, answer))
    assert got["logo.png"] == "review"
    assert got["products/b.jpg"] == "review"
    assert got["products/a.jpg"] == "review"  # no answer for index 0


def test_a_failed_or_refused_request_sends_everything_to_review():
    assert set(_decisions(decide(META, ALL, None)).values()) == {"review"}


def test_answer_from_message_reads_only_finished_json():
    ok = SimpleNamespace(stop_reason="end_turn", content=[
        SimpleNamespace(type="thinking", thinking=""),
        SimpleNamespace(type="text", text='{"logo": {"is_own_logo": "yes", "note": ""}, "pictures": []}'),
    ])
    assert answer_from_message(ok)["logo"]["is_own_logo"] == "yes"
    refused = SimpleNamespace(stop_reason="refusal", content=[])
    cut = SimpleNamespace(stop_reason="max_tokens", content=[SimpleNamespace(type="text", text='{"logo"')])
    assert answer_from_message(refused) is None and answer_from_message(cut) is None


def _png_bytes(w, h, rgba):
    buf = io.BytesIO()
    Image.new("RGBA", (w, h), rgba).save(buf, "PNG")
    return buf.getvalue()


def test_thumbnails_are_small_jpegs_and_white_on_clear_stays_visible():
    big = thumbnail(_png_bytes(3000, 1500, (10, 120, 60, 255)))
    with Image.open(io.BytesIO(base64.b64decode(big))) as im:
        assert im.format == "JPEG" and max(im.size) == 768
    white_logo = Image.new("RGBA", (300, 100), (0, 0, 0, 0))
    white_logo.paste((255, 255, 255, 255), (50, 30, 250, 70))
    buf = io.BytesIO()
    white_logo.save(buf, "PNG")
    with Image.open(io.BytesIO(base64.b64decode(thumbnail(buf.getvalue())))) as im:
        assert im.getpixel((5, 5))[0] < 230  # the clear area became grey, not white
    assert thumbnail(b'<svg xmlns="http://www.w3.org/2000/svg"/>') is None
    assert thumbnail(b"not an image") is None


def test_the_request_numbers_pictures_by_their_place_and_skips_unshown_ones():
    thumbs = {"logo.png": "TE9HTw==", "products/a.jpg": "QQ==", "products/b.jpg": None,
              "products/c.jpg": "Qw==", "products/d.jpg": "RA=="}
    req = build_request("www.acme-group.com.bd", ["Acme Knit Ltd", "Acme Denim Ltd"], META, thumbs)
    assert req["custom_id"] == "www_acme-group_com_bd"
    params = req["params"]
    assert params["model"] == "claude-opus-5-5"
    assert params["output_config"]["format"]["schema"] == SCHEMA
    content = params["messages"][0]["content"]
    texts = [c["text"] for c in content if c["type"] == "text"]
    assert "Acme Knit Ltd, Acme Denim Ltd" in texts[0]
    assert [t for t in texts if t.startswith("Picture")] == ["Picture 0:", "Picture 2:", "Picture 3:"]
    assert sum(c["type"] == "image" for c in content) == 4  # logo + three photos


def test_custom_ids_fit_the_api_pattern():
    cid = custom_id("very-long-subdomain." * 6 + "example.com")
    assert len(cid) <= 64 and all(ch.isalnum() or ch in "_-" for ch in cid)


def test_collect_writes_one_verdict_per_site_from_batch_results(monkeypatch):
    written = {}

    async def fake_write(path, value):
        written[path] = value

    monkeypatch.setattr(sic, "_write_json", fake_write)
    answer = {"logo": {"is_own_logo": "yes", "note": ""},
              "pictures": [{"index": i, "kind": "product", "sure": True} for i in range(4)]}
    message = SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text=json.dumps(answer))])
    results = [
        SimpleNamespace(custom_id="acme_com", result=SimpleNamespace(type="succeeded", message=message)),
        SimpleNamespace(custom_id="other_com", result=SimpleNamespace(type="errored", message=None)),
    ]
    client = SimpleNamespace(messages=SimpleNamespace(batches=SimpleNamespace(results=lambda _id: iter(results))))
    other = {**META, "domain": "other.com"}
    batch = {"id": "msgbatch_1", "domains": {"acme_com": "acme.com", "other_com": "other.com"},
             "shown": {"acme.com": sorted(ALL), "other.com": sorted(ALL)}}
    n = asyncio.run(sic.collect(client, batch, {"acme.com": META, "other.com": other}))
    assert n == 1
    assert set(_decisions(written["site-images/acme.com/verdict.json"]).values()) == {"approved"}
    assert "site-images/other.com/verdict.json" not in written  # errored on their side: sent again next run


def test_a_run_sends_full_batches_then_collects_them_and_a_rerun_sends_nothing(monkeypatch):
    store = {}  # path -> value, standing in for Bunny
    sites = {f"s{i}.com": {**META, "domain": f"s{i}.com", "status": "ok"} for i in range(5)}

    async def fake_read(path):
        return store.get(path)

    async def fake_write(path, value):
        store[path] = value

    async def fake_metas(domains):
        return {d: sites[d] for d in domains}

    async def fake_thumbs(meta, sem):
        return {name: "QQ==" for name in ALL}

    async def fake_summary(domains):
        store["summary"] = domains

    sent, created = [], []

    class Batches:
        def create(self, requests):
            created.append([r["custom_id"] for r in requests])
            sent.extend(requests)
            return SimpleNamespace(id=f"msgbatch_{len(created)}")

        def retrieve(self, batch_id):
            return SimpleNamespace(processing_status="ended")

        def results(self, batch_id):
            answer = {"logo": {"is_own_logo": "yes", "note": ""}, "pictures": []}
            msg = SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text=json.dumps(answer))])
            for cid in created[int(batch_id.split("_")[1]) - 1]:
                yield SimpleNamespace(custom_id=cid, result=SimpleNamespace(type="succeeded", message=msg))

    client = SimpleNamespace(messages=SimpleNamespace(batches=Batches()))
    monkeypatch.setattr(sic, "make_client", lambda: client)
    monkeypatch.setattr(sic, "load_suppliers", lambda: [
        {"id": i, "company_name": f"Co {i}", "website": d} for i, d in enumerate(sites)])
    monkeypatch.setattr(sic, "read_metas", fake_metas)
    monkeypatch.setattr(sic, "_read_json", fake_read)
    monkeypatch.setattr(sic, "_write_json", fake_write)
    monkeypatch.setattr(sic, "load_thumbs", fake_thumbs)
    monkeypatch.setattr(sic, "write_summary", fake_summary)
    monkeypatch.setattr(sic, "POLL_SEC", 0)
    one_request = len(json.dumps(build_request("s0.com", ["Co 0"], sites["s0.com"], {n: "QQ==" for n in ALL})))
    monkeypatch.setattr(sic, "MAX_BATCH_BYTES", one_request * 2 + 10)  # two sites per batch

    args = SimpleNamespace(limit=0, domain=None, force=False)
    asyncio.run(sic.run(args))
    assert [len(c) for c in created] == [2, 2, 1]
    assert all(store[f"site-images/{d}/verdict.json"] for d in sites)
    assert all(b["collected"] for b in store["site-images/_batches.json"])

    asyncio.run(sic.run(args))  # everything has a verdict now
    assert len(created) == 3
