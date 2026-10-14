"""The picking rules of the site-images job: which website, which logo, which photos."""
import argparse
import asyncio
import io

import pytest
from PIL import Image

from etl.acquire.models import AcquiredDoc, Adapter, FetchStatus
from etl.jobs import site_images
from etl.jobs.site_images import (
    BudgetSpent,
    Crawler,
    identify,
    logo_candidates,
    manifest,
    parse_page,
    plan,
    product_candidates,
    product_links,
    public_host,
    site_host,
)

HOME = """<html><head>
<link rel="apple-touch-icon" sizes="180x180" href="/apple.png">
<script type="application/ld+json">{"@type":"Organization","logo":"https:\\/\\/acme.com\\/ld-logo.png"}</script>
</head><body>
<header class="site-header"><a href="/"><img src="/wp-content/uploads/acme-logo.png" alt="Acme Apparels"></a>
<nav><a href="/products/">Our Products</a><a href="/gallery">Gallery</a><a href="/about-us">About</a>
<a href="/menu-page">Menu</a><a href="/knitwear">Knit</a><a href="https://other.com/products">x</a>
<a href="/brochure.pdf">Products PDF</a></nav></header>
<section class="our-clients"><img src="/uploads/hm.png" alt="H&amp;M"></section>
<footer><img src="/uploads/bsci-logo.png" alt="BSCI"></footer>
</body></html>"""

PRODUCTS = """<html><body><header><img src="/logo.png"></header>
<div class="grid">
<img data-src="/p/shirt-1.jpg" src="data:image/gif;base64,R0lG" alt="Polo shirt">
<img srcset="/p/jacket-300.jpg 300w, /p/jacket-1200.jpg 1200w" src="/p/jacket-300.jpg">
<img src="/p/icon-cart.png"><img src="/team/chairman.jpg" alt="Chairman">
<img src="/p/spacer.gif">
</div>
<div class="certificates"><img src="/c/oekotex.jpg"></div>
<footer><img src="/p/footer-shirt.jpg"></footer></body></html>"""


def test_site_host_cleans_what_suppliers_typed():
    assert site_host("www.sbstylebd.com") == "www.sbstylebd.com"
    assert site_host("https://najowafashion.com/factory2.php") == "najowafashion.com"
    assert site_host("HTTP://WWW.Kaptexbd.com/ ") == "www.kaptexbd.com"
    assert site_host("www.a.com, www.b.com") == "www.a.com"
    assert site_host("https://") is None
    assert site_host("n/a") is None
    assert site_host(None) is None


def test_plan_crawls_a_shared_site_once_and_skips_social_pages():
    suppliers = [
        {"id": 1, "website": "https://www.rising-group.com"},
        {"id": 2, "website": "rising-group.com/about"},
        {"id": 3, "website": "https://www.facebook.com/somefactory"},
        {"id": 4, "website": "https://"},
    ]
    assert plan(suppliers) == {"rising-group.com": "www.rising-group.com"}
    assert [s["_domain"] for s in suppliers] == ["rising-group.com", "rising-group.com", "facebook.com", None]


def test_header_logo_wins_over_buyer_and_certificate_logos():
    page = parse_page(HOME, "https://acme.com/")
    urls = [u for _, u in logo_candidates(page)]
    # The logo visitors see first, then the one the site declares in its code.
    assert urls[:2] == ["https://acme.com/wp-content/uploads/acme-logo.png", "https://acme.com/ld-logo.png"]
    assert not any("hm.png" in u or "bsci" in u for u in urls)
    assert page.icons == [(180, "https://acme.com/apple.png")]


def test_header_image_without_the_word_logo_still_counts_when_it_links_home():
    page = parse_page('<header><a href="/"><img src="/img/a1.png"></a></header>', "https://x.com/")
    assert [u for _, u in logo_candidates(page)] == ["https://x.com/img/a1.png"]


def test_product_links_stay_on_the_site_and_skip_documents():
    page = parse_page(HOME, "https://acme.com/")
    links = product_links(page, "acme.com", 6)
    assert links == ["https://acme.com/products/", "https://acme.com/gallery", "https://acme.com/knitwear"]
    twice = parse_page('<a href="https://www.x.com/product/2">a</a><a href="http://x.com/product/2/">b</a>',
                       "https://www.x.com/")
    assert product_links(twice, "x.com", 6) == ["https://www.x.com/product/2"]


def test_product_photos_skip_chrome_people_certificates_and_lazy_placeholders():
    page = parse_page(PRODUCTS, "https://acme.com/products/")
    assert product_candidates(page) == [
        "https://acme.com/p/shirt-1.jpg",
        "https://acme.com/p/jacket-1200.jpg",
    ]


def test_photos_in_a_page_title_band_galleries_and_painted_tiles_count():
    html = """<header class="site-header"><img src="/logo.png"></header>
    <main><header class="page-header"><img src="/u/woven.jpg"></header>
    <a class="lightbox" href="/u/shirt-full.jpg"><img src="/u/shirt-thumb.jpg"></a>
    <div class="tile" style="background-image: url('/u/denim.webp')"></div>
    <div data-bg="/u/knit.jpg"></div></main>"""
    page = parse_page(html, "https://x.com/woven/")
    assert product_candidates(page) == [
        "https://x.com/u/woven.jpg", "https://x.com/u/shirt-full.jpg",
        "https://x.com/u/denim.webp", "https://x.com/u/knit.jpg",
    ]
    assert [u for _, u in logo_candidates(page)] == ["https://x.com/logo.png"]


def test_windows_backslash_paths_resolve_like_a_browser():
    page = parse_page(r'<main><img src="images\gallery\102.jpg"></main>', "https://www.knitradix.com/gallery.html")
    assert product_candidates(page) == ["https://www.knitradix.com/images/gallery/102.jpg"]


def test_whole_words_decide_skipped_links():
    html = """<a href="/carton-box">Cartons</a><a href="/cart">Cart</a>
    <a href="/factory-address">Factory Address</a><a href="/dresses">Dresses</a>"""
    links = product_links(parse_page(html, "https://p.com/"), "p.com", 6)
    assert links == ["https://p.com/carton-box", "https://p.com/dresses"]


def test_the_logo_named_like_the_site_beats_a_buyers_logo():
    html = """<header><img src="/u/US-Polo-Assn-logo.png"><a href="/"><img src="/u/valmont-logo.png"></a></header>"""
    urls = [u for _, u in logo_candidates(parse_page(html, "https://www.valmontsweater.com/"))]
    assert urls[0] == "https://www.valmontsweater.com/u/valmont-logo.png"
    # As found on the real site: the own mark has no "logo" in its file name and
    # the buyers' marks sit in a carousel further down.
    real = """<div class="wpr-logo"><a href="/"><img src="/u/VALMONT-SWEATERsS-LTD-white-and-blue.png"></a></div>
    <main><div class="swiper-slide"><img src="/u/US-Polo-Assn-logo-scaled.png"></div></main>"""
    urls = [u for _, u in logo_candidates(parse_page(real, "https://valmontsweater.com/"))]
    assert urls == ["https://valmontsweater.com/u/VALMONT-SWEATERsS-LTD-white-and-blue.png"]


def test_private_and_internal_addresses_are_refused():
    assert public_host("www.acme.com") and public_host("104.21.22.45")
    for host in ("127.0.0.1", "169.254.169.254", "10.0.0.5", "localhost", "supabase", "web.internal", "[::1]"):
        assert not public_host(host), host


def _png(w, h, color):
    buf = io.BytesIO()
    Image.new("RGBA", (w, h), color).save(buf, "PNG")
    return buf.getvalue()


def _jpg(w, h, seed):
    buf = io.BytesIO()
    Image.effect_noise((w, h), 60 + seed).convert("RGB").save(buf, "JPEG", quality=95)
    return buf.getvalue()


class _FakeFirecrawl:
    def __init__(self, pages, refuse=False):
        self.pages, self.refuse, self.calls = pages, refuse, []

    async def fetch(self, req):
        self.calls.append(req.url)
        if self.refuse:
            return AcquiredDoc(url=req.url, adapter=Adapter.FIRECRAWL, fetch_status=FetchStatus.ERROR,
                               http_status=402, error_message="Insufficient credits")
        html = self.pages.get(req.url)
        if html is None:
            return AcquiredDoc(url=req.url, adapter=Adapter.FIRECRAWL, fetch_status=FetchStatus.NOT_FOUND,
                               final_url=req.url, http_status=404)
        return AcquiredDoc(url=req.url, adapter=Adapter.FIRECRAWL, fetch_status=FetchStatus.OK,
                           final_url=req.url, http_status=200, raw_html=html, credits_used=1)


def _crawler(monkeypatch, firecrawl, files, credits=20):
    c = Crawler.__new__(Crawler)
    c.args = argparse.Namespace(max_pages=6, max_products=60)
    c.client, c.firecrawl, c.credits_left = None, firecrawl, credits
    c.stored = {}

    async def fake_get(client, url, referer, cap):
        return (files[url], url, "image/x") if url in files else None

    async def fake_put(domain, name, pic):
        c.stored[f"{domain}/{name}"] = pic.ext
        return f"https://cdn.example/site-images/{domain}/{name}"

    monkeypatch.setattr(site_images, "get_bytes", fake_get)
    c.put = fake_put
    return c


def test_a_whole_site_ends_with_its_logo_and_unique_product_photos(monkeypatch):
    shirt, jacket = _jpg(600, 800, 1), _jpg(800, 800, 2)
    files = {
        "https://acme.com/wp-content/uploads/acme-logo.png": _png(300, 90, (20, 60, 30, 255)),
        "https://acme.com/p/shirt-1.jpg": shirt,
        "https://acme.com/p/jacket-1200.jpg": jacket,
        "https://acme.com/p/shirt-copy.jpg": shirt,                   # same bytes, kept once
        "https://acme.com/p/strip.jpg": _jpg(1600, 300, 3),            # banner shape
        "https://acme.com/p/tiny.jpg": _jpg(120, 120, 4),              # thumbnail
    }
    products = PRODUCTS.replace('<img src="/p/spacer.gif">',
                                '<img src="/p/shirt-copy.jpg"><img src="/p/strip.jpg"><img src="/p/tiny.jpg">')
    fc = _FakeFirecrawl({"https://acme.com/": HOME, "https://acme.com/products/": products})
    c = _crawler(monkeypatch, fc, files)
    meta = asyncio.run(c.crawl("acme.com", "acme.com"))
    assert meta["status"] == "ok" and meta["logo_kind"] == "logo"
    assert meta["logo"]["url"] == "https://acme.com/wp-content/uploads/acme-logo.png"
    assert sorted(p["url"] for p in meta["products"]) == [
        "https://acme.com/p/jacket-1200.jpg", "https://acme.com/p/shirt-1.jpg"]
    assert c.stored["acme.com/logo.png"] == "png"
    assert fc.calls[0] == "https://acme.com/" and "https://acme.com/products/" in fc.calls


def test_firecrawl_refusing_stops_the_run_instead_of_calling_sites_dead(monkeypatch):
    c = _crawler(monkeypatch, _FakeFirecrawl({}, refuse=True), {})
    with pytest.raises(BudgetSpent, match="402"):
        asyncio.run(c.crawl("acme.com", "acme.com"))


def test_the_credit_cap_stops_before_spending_more(monkeypatch):
    fc = _FakeFirecrawl({"https://acme.com/": HOME})
    c = _crawler(monkeypatch, fc, {}, credits=1)
    with pytest.raises(BudgetSpent):
        asyncio.run(c.crawl("acme.com", "acme.com"))  # home page took the only credit
    assert fc.calls == ["https://acme.com/"]


def test_identify_reads_real_images_and_rejects_broken_ones():
    pic = identify(_png(400, 300, (10, 80, 40, 255)))
    assert (pic.ext, pic.width, pic.height, pic.whiteish) == ("png", 400, 300, False)
    white_on_clear = Image.new("RGBA", (200, 80), (0, 0, 0, 0))
    white_on_clear.paste((255, 255, 255, 255), (20, 20, 180, 60))
    buf = io.BytesIO()
    white_on_clear.save(buf, "PNG")
    assert identify(buf.getvalue()).whiteish is True
    assert identify(_png(200, 80, (255, 255, 255, 255))).whiteish is False  # opaque: visible on a page
    assert identify(_png(400, 300, (0, 0, 0, 255))[:200]) is None  # cut off mid-file
    assert identify(b"<html>not an image</html>") is None
    assert identify(b'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>').ext == "svg"


def test_manifest_has_one_row_per_supplier_with_its_sites_files():
    suppliers = [
        {"id": 1, "slug": "a", "company_name": "A", "website": "a.com"},
        {"id": 2, "slug": "b", "company_name": "B", "website": "www.a.com"},
        {"id": 3, "slug": "c", "company_name": "C", "website": "fb.com/c"},
        {"id": 4, "slug": "d", "company_name": "D", "website": "d.com"},
    ]
    plan(suppliers)
    metas = {"a.com": {"status": "ok", "logo_kind": "logo", "logo": {"cdn": "https://cdn/a/logo.png"},
                       "products": [{"cdn": "https://cdn/a/p1.jpg"}, {"cdn": "https://cdn/a/p2.jpg"}]}}
    body, counts = manifest(suppliers, metas)
    rows = body.decode().splitlines()
    assert len(rows) == 5
    assert rows[1].endswith("a.com,ok,logo,https://cdn/a/logo.png,2,https://cdn/a/p1.jpg https://cdn/a/p2.jpg,")
    assert counts == {"ok": 2, "not_own_site": 1, "not_done": 1}
