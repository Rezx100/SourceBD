"""Store each supplier website's logo and product photos in Bunny for review.

Runs on the SourceBD server, started by hand (`etl.cli site-images`), never on
a schedule. Read-only against the database: suppliers are read over PostgREST and nothing
is written back. Firecrawl reads the pages, rendered, so JavaScript sites and
blocked sites work; our own code picks the logo and photos out of the HTML; the
image files are fetched straight from the site. One folder per website (group
companies share one site, so a domain is done once however many list it):

    site-images/<domain>/logo.<ext>        the site's own logo, when found
    site-images/<domain>/icon.<ext>        the touch icon, only when no logo was
    site-images/<domain>/products/*.<ext>  photos from the site's product pages
    site-images/<domain>/meta.json         every source URL, so each file traces
    site-images/manifest.csv               one row per supplier, with CDN links

Nothing links to these files from the site; they wait for review.

Credits: one per page read, so a site costs 1 + up to --max-pages. The run
stops cleanly at --firecrawl-credits. A finished site is skipped next run and a
failed one is tried again, so runs can be repeated in batches until done.

    docker compose run --rm etl site-images --limit 50 --firecrawl-credits 400
    docker compose run --rm etl site-images --domain rising-group.com --firecrawl-credits 10
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import hashlib
import io
import json
import re
import time
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import unquote, urljoin, urlsplit

import httpx
import lxml.html

from etl.core.config import settings

PREFIX = "site-images"
MAX_IMAGE_BYTES = 20 * 1024 * 1024
DOMAIN_TIMEOUT_SEC = 300
MIN_PRODUCT_SIDE = 250
MIN_PRODUCT_BYTES = 8 * 1024
MAX_PRODUCT_ASPECT = 2.5
LOGO_MIN_SCORE = 8
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0 Safari/537.36 SourceBD-Research/1.0"
)

# Listed as a "website" but not the company's own site.
NOT_OWN_SITE = {
    "facebook.com", "fb.com", "m.facebook.com", "linkedin.com", "instagram.com",
    "twitter.com", "x.com", "youtube.com", "google.com", "sites.google.com",
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "alibaba.com",
    "bgmea.com.bd", "bkmea.com", "btmadhaka.com", "wa.me", "whatsapp.com",
}

# Marks of someone else's logo (buyers, certifiers, social) or of page chrome.
BAD_SUBSTR = (
    "client", "partner", "buyer", "customer", "certif", "award", "facebook",
    "linkedin", "youtube", "whatsapp", "instagram", "twitter", "pinterest",
    "payment", "loader", "testimonial",
)
BAD_TOKENS = {
    "wrap", "iso", "gots", "grs", "ocs", "bci", "oeko", "bsci", "amfori", "sedex",
    "higg", "fsc", "bgmea", "bkmea", "btma", "accord", "alliance", "member",
    "members", "flag", "flags", "visa", "brands", "fb", "wrc",
}
PRODUCT_BAD_TOKENS = BAD_TOKENS | {
    "logo", "logos", "icon", "icons", "sprite", "banner", "placeholder", "spinner",
    "arrow", "avatar", "team", "chairman", "director", "ceo", "founder", "md",
    "map", "social", "bg", "background", "blank", "pixel", "qr", "signature",
}
PRODUCT_LINK_RE = re.compile(
    r"product|collection|gallery|portfolio|catalog|categor|our-?work|garment|"
    r"apparel|knit|woven|sweater|denim|jean|jacket|shirt|polo|trouser|pant|"
    r"kids|child|baby|ladies|women|\bmen'?s?\b|outerwear|lingerie|intimate|"
    r"swim|sportswear|activewear|hoodie|fleece|uniform|workwear|dress|towel|"
    r"home-?textile|yarn|fabric|accessor|label|trims?\b|button|zipper|packag|"
    r"carton|hanger|thread"
)
STRONG_PRODUCT_LINK_RE = re.compile(r"product|collection|gallery|catalog|portfolio")
LINK_SKIP_RE = re.compile(
    r"\.(pdf|docx?|xlsx?|zip|rar|jpe?g|png|gif|webp|svg|mp4)(\?|$)|^(mailto|tel|javascript):|"
    r"login|signin|sign-in|register|cart|checkout|my-account|wp-admin|wp-login|/feed|"
    r"/tag/|add-to-cart|career|job|news|blog|contact|about|certif|compliance|csr|"
    r"privacy|terms|policy|sitemap"
)
HOME_PATHS = {"", "/", "/index.html", "/index.htm", "/index.php", "/home"}
EXT = {"JPEG": "jpg", "MPO": "jpg", "PNG": "png", "WEBP": "webp", "GIF": "gif",
       "BMP": "bmp", "ICO": "ico", "AVIF": "avif", "TIFF": "tif"}


# --------------------------------------------------------------------- urls
def site_host(raw: str | None) -> str | None:
    """The host a supplier's website field points at, or None if it is junk."""
    s = (raw or "").strip()
    if not s:
        return None
    s = re.split(r"[\s,;|]+", s)[0].strip().strip("/")
    if "://" not in s:
        s = "https://" + s
    try:
        host = (urlsplit(s).hostname or "").lower().rstrip(".")
    except ValueError:
        return None
    if "." not in host or not re.fullmatch(r"[a-z0-9.-]+", host):
        return None
    return host


def domain_key(host: str) -> str:
    return host[4:] if host.startswith("www.") else host


def same_site(url: str, domain: str) -> bool:
    host = (urlsplit(url).hostname or "").lower()
    return domain_key(host) == domain


def tokens(text: str) -> set[str]:
    return set(re.split(r"[^a-z0-9]+", text))


def is_foreign(ctx: str, bad_tokens: set[str]) -> bool:
    return any(s in ctx for s in BAD_SUBSTR) or bool(tokens(ctx) & bad_tokens)


def best_src(el: Any, base: str) -> str | None:
    """The largest real image URL an <img> offers, lazy-loading included."""
    srcset = el.get("data-srcset") or el.get("srcset") or ""
    best, best_w = None, -1.0
    for part in srcset.split(","):
        bits = part.strip().split()
        if not bits:
            continue
        w = 1.0
        if len(bits) > 1:
            try:
                w = float(bits[1].rstrip("wx"))
            except ValueError:
                pass
        if w > best_w:
            best, best_w = bits[0], w
    for attr in ("data-src", "data-lazy-src", "data-original", "data-lazy", "src"):
        val = (el.get(attr) or "").strip()
        if val and not val.startswith("data:"):
            best = best or val
            break
    if not best or best.startswith("data:"):
        return None
    url = urljoin(base, best)
    return url if url.startswith(("http://", "https://")) else None


# -------------------------------------------------------------------- parse
@dataclass
class Img:
    url: str
    own: str          # the image's own src, alt, class, id and its link
    around: str       # classes and ids of the four nearest ancestors
    chrome: bool      # inside header or nav
    footer: bool
    home_link: bool
    order: int
    kind: str = "img"  # img, link (a gallery link to the file) or bg (painted)


CHROME_CLASS_RE = re.compile(
    r"^(site-header|main-header|header|header-main|navbar|masthead|site-branding|"
    r"top-?bar|elementor-location-header|logo|site-logo)$"
)
IMAGE_FILE_RE = re.compile(r"\.(jpe?g|png|webp)(\?.*)?$", re.I)


def _whereabouts(el: Any) -> tuple[bool, bool, str]:
    """(in the site's header or menu, in the footer, nearest ancestors' marks).

    A page-title band (`page-header`, `entry-header`) sits inside the content,
    so only whole class names and the <header>/<nav> outside <main> count.
    """
    ancestors = [
        (anc.tag if isinstance(anc.tag, str) else "", f"{anc.get('class') or ''} {anc.get('id') or ''}".lower())
        for anc in el.iterancestors()
    ]
    in_content = any(tag in ("main", "article") for tag, _ in ancestors)
    chrome = any(tag == "nav" for tag, _ in ancestors) or (not in_content and any(
        tag == "header" or any(CHROME_CLASS_RE.match(n) for n in names.split()) for tag, names in ancestors
    ))
    footer = any(tag == "footer" or "footer" in names for tag, names in ancestors)
    return chrome, footer, " ".join(names for _, names in ancestors[:4])


@dataclass
class Page:
    url: str
    imgs: list[Img] = field(default_factory=list)
    links: list[tuple[str, str]] = field(default_factory=list)  # (url, text)
    jsonld_logos: list[str] = field(default_factory=list)
    og_image: str | None = None
    icons: list[tuple[int, str]] = field(default_factory=list)  # (size, url)


def parse_page(html: bytes | str, url: str) -> Page:
    page = Page(url=url)
    try:
        doc = lxml.html.document_fromstring(html)
    except (ValueError, lxml.etree.ParserError):
        return page
    base_el = doc.find(".//base[@href]")
    base = urljoin(url, base_el.get("href")) if base_el is not None else url
    root = urlsplit(base)

    def add(el: Any, src: str, kind: str, extra: str = "") -> None:
        parent_a = el if el.tag == "a" else next((a for a in el.iterancestors("a")), None)
        href = urljoin(base, parent_a.get("href") or "") if parent_a is not None else ""
        hs = urlsplit(href) if href else None
        own = " ".join([
            unquote(urlsplit(src).path), el.get("alt") or "", el.get("title") or "",
            el.get("class") or "", el.get("id") or "", extra,
            (parent_a.get("class") or "") + " " + (parent_a.get("id") or "") if parent_a is not None else "",
        ]).lower()
        chrome, footer, around = _whereabouts(el)
        page.imgs.append(Img(
            url=src, own=own, around=around, chrome=chrome, footer=footer,
            home_link=bool(hs and hs.hostname == root.hostname and hs.path in HOME_PATHS),
            order=len(page.imgs), kind=kind,
        ))

    for el in doc.iter():
        if not isinstance(el.tag, str):
            continue
        if el.tag == "img":
            src = best_src(el, base)
            parent = el.getparent()
            linked_full_size = parent is not None and parent.tag == "a" and IMAGE_FILE_RE.search(parent.get("href") or "")
            if src and not linked_full_size:  # a thumbnail; its link was taken instead
                add(el, src, "img")
            continue
        # Galleries link the full-size photo; sliders and grids often paint it.
        if el.tag == "a" and IMAGE_FILE_RE.search(el.get("href") or ""):
            add(el, urljoin(base, el.get("href").strip()), "link")
        painted = el.get("data-bg") or el.get("data-background") or el.get("data-background-image")
        m = re.search(r"background(?:-image)?\s*:[^;]*url\(\s*['\"]?([^'\")]+)", el.get("style") or "")
        for raw in (painted, m.group(1) if m else None):
            if raw and not raw.startswith("data:"):
                add(el, urljoin(base, raw.strip()), "bg")

    for a in doc.iter("a"):
        href = (a.get("href") or "").strip()
        if href and not href.startswith("#"):
            page.links.append((urljoin(base, href).split("#")[0], (a.text_content() or "").strip().lower()))

    for script in doc.iter("script"):
        if (script.get("type") or "").lower() == "application/ld+json" and script.text:
            for m in re.finditer(r'"logo"\s*:\s*(?:\{[^}]*?"url"\s*:\s*)?"([^"]+)"', script.text):
                page.jsonld_logos.append(urljoin(base, m.group(1).replace("\\/", "/")))

    for meta in doc.iter("meta"):
        if (meta.get("property") or meta.get("name") or "").lower() == "og:image" and meta.get("content"):
            page.og_image = urljoin(base, meta.get("content").strip())

    for link in doc.iter("link"):
        rel = (link.get("rel") or "").lower()
        if "icon" in rel and link.get("href"):
            m = re.match(r"(\d+)", link.get("sizes") or "")
            size = int(m.group(1)) if m else (180 if "apple-touch" in rel else 16)
            page.icons.append((size, urljoin(base, link.get("href").strip())))
    return page


def logo_candidates(page: Page) -> list[tuple[int, str]]:
    """Logo URLs, best first. Only candidates with a real logo signal survive."""
    scored: dict[str, int] = {}
    imgs = [im for im in page.imgs if im.kind == "img"]
    first_chrome = next((im.order for im in imgs if im.chrome), None)
    for im in imgs:
        if is_foreign(im.own, BAD_TOKENS) or any(s in im.around for s in BAD_SUBSTR):
            continue
        score = 0
        if "logo" in im.own:
            score += 10
        elif "logo" in im.around:
            score += 6
        if im.chrome:
            score += 4
        if im.order == first_chrome:
            score += 2
        if im.home_link:
            score += 3
        if im.footer:
            score -= 3
        if score >= LOGO_MIN_SCORE:
            scored[im.url] = max(scored.get(im.url, -99), score * 1000 - im.order)
    for url in page.jsonld_logos:
        if not is_foreign(unquote(url).lower(), BAD_TOKENS):
            scored[url] = max(scored.get(url, -99), 9000)
    if page.og_image and "logo" in unquote(page.og_image).lower():
        scored[page.og_image] = max(scored.get(page.og_image, -99), 8000)
    return sorted(((s, u) for u, s in scored.items()), reverse=True)


def product_links(page: Page, domain: str, limit: int) -> list[str]:
    def key(u: str) -> tuple[str, str, str]:  # http/https and www. are the same page
        s = urlsplit(u)
        return domain_key((s.hostname or "").lower()), s.path.rstrip("/"), s.query

    seen = {key(page.url)}
    ranked: list[tuple[int, int, str]] = []
    for i, (url, text) in enumerate(page.links):
        if key(url) in seen or not same_site(url, domain):
            continue
        hay = (unquote(urlsplit(url).path) + "?" + (urlsplit(url).query) + " " + text).lower()
        if LINK_SKIP_RE.search(hay.split(" ")[0]) or not PRODUCT_LINK_RE.search(hay):
            continue
        seen.add(key(url))
        ranked.append((0 if STRONG_PRODUCT_LINK_RE.search(hay) else 1, i, url))
    return [u for _, _, u in sorted(ranked)[:limit]]


def product_candidates(page: Page) -> list[str]:
    out: list[str] = []
    for im in page.imgs:
        path = urlsplit(im.url).path.lower()
        if im.chrome or im.footer or path.endswith((".svg", ".gif", ".ico")):
            continue
        if is_foreign(im.own, PRODUCT_BAD_TOKENS) or re.search(r"client|partner|certif|award|team|testimonial|social", im.around):
            continue
        if im.url not in out:
            out.append(im.url)
    return out


# ------------------------------------------------------------------- images
@dataclass
class Picture:
    data: bytes
    ext: str
    width: int
    height: int
    whiteish: bool = False


def identify(data: bytes) -> Picture | None:
    """Decode the bytes fully. Anything that is not a whole image is rejected."""
    from PIL import Image  # only the crawl needs Pillow; the parsing tests do not

    head = data[:2048].lstrip().lower()
    if head.startswith(b"<svg") or (head.startswith(b"<?xml") and b"<svg" in data[:8192].lower()):
        return Picture(data, "svg", 0, 0)
    try:
        with Image.open(io.BytesIO(data)) as im:
            im.load()
            fmt = im.format or ""
            w, h = im.size
            whiteish = False
            if im.mode in ("RGBA", "LA", "P"):
                raw = im.convert("RGBA").resize((48, 48)).tobytes()
                px = [raw[i:i + 4] for i in range(0, len(raw), 4) if raw[i + 3] > 32]
                if px:
                    whiteish = sum(0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2] for p in px) / len(px) > 235
    except Exception:  # noqa: BLE001 - Pillow raises many types for bad bytes
        return None
    ext = EXT.get(fmt)
    return Picture(data, ext, w, h, whiteish) if ext else None


async def get_bytes(client: httpx.AsyncClient, url: str, referer: str, cap: int) -> tuple[bytes, str, str] | None:
    """(body, final url, content type), or None on any failure."""
    try:
        async with client.stream("GET", url, headers={"Referer": referer}) as r:
            if r.status_code != 200:
                return None
            buf = bytearray()
            async for chunk in r.aiter_bytes():
                buf += chunk
                if len(buf) > cap:
                    return None
            return bytes(buf), str(r.url), r.headers.get("content-type", "").lower()
    except (httpx.HTTPError, httpx.InvalidURL, OSError, ValueError):
        return None


# ------------------------------------------------------------------- crawl
class BudgetSpent(Exception):
    """The run's Firecrawl credits are used up; the site is retried next run."""


class Crawler:
    def __init__(self, args: argparse.Namespace) -> None:
        from etl.acquire.firecrawl import FirecrawlAdapter

        self.args = args
        # Image files come straight from the sites. Many factory sites run
        # expired or self-signed certificates; we only read public images and
        # send nothing, so certificate checks are off.
        self.client = httpx.AsyncClient(
            headers={"User-Agent": UA, "Accept-Language": "en"},
            timeout=httpx.Timeout(30.0, connect=15.0),
            limits=httpx.Limits(max_connections=args.workers * 8, max_keepalive_connections=args.workers * 2),
            follow_redirects=True,
            verify=False,
        )
        self.firecrawl = FirecrawlAdapter(max_concurrency=args.firecrawl_concurrency)
        self.credits_left = args.firecrawl_credits

    async def aclose(self) -> None:
        await self.client.aclose()
        await self.firecrawl.aclose()

    async def html(self, url: str) -> tuple[str, str] | None:
        """(final url, rendered html) through Firecrawl, or None if unreadable."""
        from etl.acquire.models import AcquireRequest, FetchStatus

        if self.credits_left <= 0:
            raise BudgetSpent
        self.credits_left -= 1
        doc = await self.firecrawl.fetch(AcquireRequest(url=url, formats=("rawHtml",), parse_pdf=False))
        self.credits_left -= max(0, doc.credits_used - 1)
        if doc.fetch_status != FetchStatus.OK or not doc.raw_html:
            return None
        return doc.final_url or url, doc.raw_html

    async def put(self, domain: str, name: str, pic: Picture) -> str:
        from etl.core import bunny

        return await bunny.upload(f"{PREFIX}/{domain}/{name}", pic.data, CONTENT_TYPE.get(pic.ext))

    async def save_logo(self, cands: list[tuple[int, str]], referer: str, domain: str, name: str) -> dict[str, str] | None:
        """Store the first candidate that is a real, visible image."""
        fallback: tuple[Picture, str] | None = None
        chosen: tuple[Picture, str] | None = None
        for _, url in cands[:5]:
            got = await get_bytes(self.client, url, referer, MAX_IMAGE_BYTES)
            pic = identify(got[0]) if got else None
            if not pic or (pic.ext != "svg" and max(pic.width, pic.height) < 40):
                continue
            if pic.whiteish:  # a white logo for a dark header; keep looking
                fallback = fallback or (pic, url)
                continue
            chosen = (pic, url)
            break
        chosen = chosen or fallback
        if not chosen:
            return None
        fname = f"{name}.{chosen[0].ext}"
        cdn = await self.put(domain, fname, chosen[0])
        return {"file": fname, "cdn": cdn, "url": chosen[1]}

    async def crawl(self, domain: str, host: str) -> dict[str, Any]:
        meta: dict[str, Any] = {"domain": domain, "host": host, "status": "ok", "logo": None,
                                "logo_kind": "none", "products": [], "pages": []}
        home = await self.html(f"https://{host}/") or await self.html(f"http://{host}/")
        if home is None:
            meta["status"] = "unreachable"
            return meta
        page = parse_page(home[1], home[0])
        meta["final_url"] = page.url

        logo = await self.save_logo(logo_candidates(page), page.url, domain, "logo")
        if logo:
            meta.update(logo=logo, logo_kind="logo")
        else:
            icons = [(s, u) for s, u in sorted(page.icons, reverse=True) if s >= 120]
            icon = await self.save_logo(icons, page.url, domain, "icon")
            if icon:
                meta.update(logo=icon, logo_kind="icon")
            else:
                meta["status"] = "no_logo"

        # The home page may redirect to another domain; its links live there.
        site = domain_key((urlsplit(page.url).hostname or host).lower())
        links = product_links(page, site, self.args.max_pages)
        got_pages = await asyncio.gather(*(self.html(u) for u in links), return_exceptions=True)
        if any(isinstance(g, BudgetSpent) for g in got_pages):
            raise BudgetSpent
        pages = [parse_page(g[1], g[0]) for g in got_pages if isinstance(g, tuple)]
        meta["pages"] = [p.url for p in pages]

        logo_url = (meta["logo"] or {}).get("url")
        jobs: dict[str, str] = {}
        for p in pages:
            for url in product_candidates(p):
                if url != logo_url:
                    jobs.setdefault(url, p.url)

        sem = asyncio.Semaphore(8)
        hashes: set[str] = set()
        cap = self.args.max_products

        async def one(url: str, referer: str) -> None:
            async with sem:
                if len(hashes) >= cap:
                    return
                got = await get_bytes(self.client, url, referer, MAX_IMAGE_BYTES)
                if not got or len(got[0]) < MIN_PRODUCT_BYTES:
                    return
                pic = identify(got[0])
                if not pic or pic.ext == "svg" or min(pic.width, pic.height) < MIN_PRODUCT_SIDE:
                    return
                if max(pic.width, pic.height) / min(pic.width, pic.height) > MAX_PRODUCT_ASPECT:
                    return  # a banner or slider strip, not a product shot
                digest = hashlib.sha1(pic.data).hexdigest()
                if digest in hashes or len(hashes) >= cap:
                    return
                hashes.add(digest)
                fname = f"products/{digest[:16]}.{pic.ext}"
                try:
                    cdn = await self.put(domain, fname, pic)
                except (RuntimeError, httpx.HTTPError):
                    hashes.discard(digest)
                    return
                meta["products"].append({"file": fname, "cdn": cdn, "url": url, "page": referer,
                                         "width": pic.width, "height": pic.height})

        await asyncio.gather(*(one(u, r) for u, r in jobs.items()))
        return meta


# ------------------------------------------------------------------- run
FINISHED = {"ok", "no_logo"}


def load_suppliers() -> list[dict[str, Any]]:
    base = settings.supabase_url.rstrip("/")
    key = settings.supabase_service_role_key
    if not base or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    rows: list[dict[str, Any]] = []
    with httpx.Client(timeout=60, headers={"apikey": key, "Authorization": f"Bearer {key}"}) as c:
        while True:
            r = c.get(f"{base}/rest/v1/suppliers", params={
                "select": "id,slug,company_name,website", "website": "not.is.null",
                "order": "id", "limit": 1000, "offset": len(rows)})
            r.raise_for_status()
            batch = r.json()
            rows.extend(batch)
            if len(batch) < 1000:
                return rows


def plan(suppliers: list[dict[str, Any]]) -> dict[str, str]:
    """domain -> host to fetch. Sets each supplier's `_domain` (None for junk)."""
    domains: dict[str, str] = {}
    for s in suppliers:
        host = site_host(s.get("website"))
        s["_domain"] = domain_key(host) if host else None
        if host and s["_domain"] not in NOT_OWN_SITE:
            domains.setdefault(s["_domain"], host)
    return domains


async def read_metas(domains: list[str]) -> dict[str, dict[str, Any]]:
    from etl.core import bunny

    sem = asyncio.Semaphore(32)

    async def one(d: str) -> tuple[str, dict[str, Any]]:
        async with sem:
            raw = await bunny.read(f"{PREFIX}/{d}/meta.json")
        return d, json.loads(raw) if raw else {}

    return dict(await asyncio.gather(*(one(d) for d in domains)))


async def run(args: argparse.Namespace) -> None:
    from etl.core import bunny

    suppliers = load_suppliers()
    domains = plan(suppliers)
    metas = await read_metas(sorted(domains))
    todo = sorted(domains.items())
    if args.domain:
        todo = [(d, h) for d, h in todo if d == domain_key(args.domain.lower())]
    elif not args.force:  # a site that failed last time is tried again
        todo = [(d, h) for d, h in todo if metas[d].get("status") not in FINISHED]
    if args.limit:
        todo = todo[: args.limit]
    print(f"{len(suppliers)} suppliers with a website, {len(domains)} sites, "
          f"{len(todo)} to do now, {args.firecrawl_credits} Firecrawl credits allowed", flush=True)

    crawler = Crawler(args)
    queue: asyncio.Queue[tuple[str, str]] = asyncio.Queue()
    for item in todo:
        queue.put_nowait(item)
    done = 0
    started = time.monotonic()

    async def worker() -> None:
        nonlocal done
        while not queue.empty():
            domain, host = queue.get_nowait()
            t0 = time.monotonic()
            try:
                meta = await asyncio.wait_for(crawler.crawl(domain, host), DOMAIN_TIMEOUT_SEC)
            except BudgetSpent:
                print(f"credits used up; {domain} and the rest wait for the next run", flush=True)
                while not queue.empty():
                    queue.get_nowait()
                return
            except asyncio.TimeoutError:
                meta = {"domain": domain, "host": host, "status": "timeout", "logo_kind": "none", "products": []}
            except Exception as exc:  # noqa: BLE001 - one bad site never stops the run
                meta = {"domain": domain, "host": host, "status": "error", "logo_kind": "none",
                        "products": [], "error": f"{type(exc).__name__}: {exc}"[:300]}
            meta["seconds"] = round(time.monotonic() - t0, 1)
            metas[domain] = meta
            try:
                await bunny.upload(f"{PREFIX}/{domain}/meta.json", json.dumps(meta, indent=1).encode(),
                                   "application/json")
            except (RuntimeError, httpx.HTTPError) as exc:
                print(f"{domain}: could not store meta.json ({exc}); it is redone next run", flush=True)
            done += 1
            print(f"[{done}/{len(todo)}] {domain:<40} {meta['status']:<11} logo={meta['logo_kind']:<4} "
                  f"products={len(meta['products']):<3} {meta['seconds']}s", flush=True)

    try:
        await asyncio.gather(*(worker() for _ in range(args.workers)))
    finally:
        await crawler.aclose()

    csv_bytes, counts = manifest(suppliers, metas)
    cdn = await bunny.upload(f"{PREFIX}/manifest.csv", csv_bytes, "text/csv")
    print("suppliers by status:", ", ".join(f"{k} {v}" for k, v in sorted(counts.items())))
    print(f"done in {time.monotonic() - started:.0f}s; about {args.firecrawl_credits - crawler.credits_left} "
          f"Firecrawl credits used; manifest at {cdn}")


def manifest(suppliers: list[dict[str, Any]], metas: dict[str, dict[str, Any]]) -> tuple[bytes, dict[str, int]]:
    """One CSV row per supplier, and how many suppliers ended in each status."""
    cols = ["supplier_id", "slug", "company_name", "website", "domain", "status", "logo_kind",
            "logo_url", "product_count", "product_urls", "error"]
    counts: dict[str, int] = {}
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=cols)
    w.writeheader()
    for s in suppliers:
        d = s["_domain"]
        if d is None:
            meta: dict[str, Any] = {"status": "invalid_url"}
        elif d in NOT_OWN_SITE:
            meta = {"status": "not_own_site"}
        else:
            meta = metas.get(d) or {"status": "not_done"}
        counts[meta["status"]] = counts.get(meta["status"], 0) + 1
        products = meta.get("products") or []
        w.writerow({
            "supplier_id": s["id"], "slug": s.get("slug"), "company_name": s.get("company_name"),
            "website": s.get("website"), "domain": d, "status": meta["status"],
            "logo_kind": meta.get("logo_kind", "none"),
            "logo_url": (meta.get("logo") or {}).get("cdn", ""),
            "product_count": len(products),
            "product_urls": " ".join(p["cdn"] for p in products),
            "error": meta.get("error", ""),
        })
    return buf.getvalue().encode("utf-8"), counts
