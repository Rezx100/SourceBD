"""Audit principal_products coverage against downloaded product icons."""
from __future__ import annotations

import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Load .env without committing secrets
env_path = ROOT / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

import psycopg  # noqa: E402

JSON_PATH = Path(r"c:\Users\Hp\Downloads\extract-data-2026-06-29.json")
ICONS_DIR = ROOT / "public" / "icons" / "products"

# Mirror product-icons.ts rules in Python for audit
ICON_BASE = "/icons/products"


def strip_marker(raw: str) -> str:
    s = raw.strip()
    for _ in range(2):
        s = re.sub(r"^\(\s*[A-Za-z0-9]{1,3}\s*\)\s*", "", s)
        s = re.sub(r"\s*\(\s*[A-Za-z0-9]{1,3}\s*\)\s*$", "", s).strip()
    return s


def canonical_key(raw: str) -> str:
    s = strip_marker(raw).lower().strip()
    s = re.sub(r"[`'\u2018\u2019\u02bc]", "'", s)
    s = re.sub(r"^all\s+kinds?\s+of\s+", "", s)
    for a, b in [
        (r"\bpyjamas?\b", "pajamas"),
        (r"\bpajama\b", "pajamas"),
        (r"\btee[\s-]?shirts?\b", "t-shirts"),
        (r"\bt[\s-]?shirts?\b", "t-shirts"),
        (r"\bpolo[\s-]?shirts?\b", "polo shirts"),
        (r"\bsweat[\s-]?shirts?\b", "sweatshirts"),
        (r"\bunder[\s-]?wears?\b", "underwear"),
        (r"\bnight[\s-]?wears?\b", "nightwear"),
        (r"\bsports?[\s-]?wears?\b", "sportswear"),
    ]:
        s = re.sub(a, b, s)
    s = re.sub(r"[-_/+&]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    if s.endswith("ies") and len(s) > 4:
        s = s[:-3] + "y"
    elif s.endswith("es") and len(s) > 3 and not s.endswith("ses"):
        s = s[:-2]
    elif s.endswith("s") and len(s) > 2 and not s.endswith("ss"):
        s = s[:-1]
    return s


def product_icon_slug(product: str) -> str:
    key = canonical_key(product)
    rules: list[tuple[re.Pattern[str], str]] = [
        (re.compile(r"\b(men's|mens|gent's|gents)\s+(denim|jean)"), "jeans"),
        (re.compile(r"\b(women's|womens|ladies)\s+(denim|jean)"), "jeans"),
        (re.compile(r"\b(children's|childrens|kids|boy's|girl's|baby's|babies')\s+(denim|jean)"), "children-clothes"),
        (re.compile(r"\b(denim|jean)\b"), "jeans"),
        (re.compile(r"\bt[\s-]?shirt|tee\b"), "t-shirt"),
        (re.compile(r"\bpolo\b"), "polo"),
        (re.compile(r"\bblouse\b"), "blouse"),
        (re.compile(r"\bknitted shirt\b"), "jumper"),
        (re.compile(r"\bknit and woven\b"), "shirt"),
        (re.compile(r"\bknitwear|knit garment|knitted garment|all kind of knit"), "jumper"),
        (re.compile(r"\bknit\b"), "jumper"),
        (re.compile(r"\bwoven\b"), "shirt"),
        (re.compile(r"\bshirt\b"), "shirt"),
        (re.compile(r"\b(hoody|hoodie|hooded|sweatshirt)\b"), "hoodie"),
        (re.compile(r"\bcardigan\b"), "cardigan"),
        (re.compile(r"\b(sweater|pullover)\b"), "sweater"),
        (re.compile(r"\bjumper\b"), "jumper"),
        (re.compile(r"\b(blazer|jacket|fleece)\b"), "jacket"),
        (re.compile(r"\b(tuxedo)\b"), "tuxedo"),
        (re.compile(r"\b(waistcoat|vest)\b"), "vest"),
        (re.compile(r"\b(lab coat|uniform|workwear|scrub)\b"), "coat"),
        (re.compile(r"\b(coat|outerwear|overcoat)\b"), "coat"),
        (re.compile(r"\bsuit\b"), "suit"),
        (re.compile(r"\bskirt\b"), "skirt"),
        (re.compile(r"\b(trouser|pant)\b"), "trousers"),
        (re.compile(r"\bshort\b"), "shorts"),
        (re.compile(r"\b(jogger|jogging|tracksuit)\b"), "jogger"),
        (re.compile(r"\b(dress|gown|frock)\b"), "dress"),
        (re.compile(r"\b(lingerie|panty|panties|bra|brief|underwear|underpant|bikini)\b"), "bikini"),
        (re.compile(r"\b(boxer|boxers)\b"), "boxers"),
        (re.compile(r"\b(pajama|nightwear|robe|nightdress)\b"), "pajamas"),
        (re.compile(r"\b(sock|hosiery|stocking)\b"), "socks"),
        (re.compile(r"\b(athletic|sport|sportswear|activewear|athleisure|swim)\b"), "jogger"),
        (re.compile(r"\b(infant|baby|babies|newborn)\b"), "infant-clothes"),
        (re.compile(r"\b(children|child|kid|kids)\b"), "children-clothes"),
        (re.compile(r"\b(women's|womens|ladies)\s+(apparel|wear|clothing|garment)"), "dress"),
        (re.compile(r"\b(unisex|gender neutral)\b"), "t-shirt"),
        (re.compile(r"\b(men's|mens|gent's|gents)\b"), "shirt"),
        (re.compile(r"\b(yarn|greige yarn|dyed yarn)\b"), "sweater"),
        (re.compile(r"\b(fabric|textile|greige|undyed fabric|dyed fabric|printed fabric)\b"), "shirt"),
        (re.compile(r"\b(home textile|bed linen|towel|curtain)\b"), "scarf"),
        (re.compile(r"\b(embroidery|embroidered|applique)\b"), "shirt"),
        (re.compile(r"\b(zipper|zip|fastener|elastic|label|lace|trim|button)\b"), "belt"),
        (re.compile(r"\b(bag|purse|wallet|luggage)\b"), "bag"),
        (re.compile(r"\b(hat|cap|headwear)\b"), "cap"),
        (re.compile(r"\b(scarf|shawl)\b"), "scarf"),
        (re.compile(r"\b(belt)\b"), "belt"),
        (re.compile(r"\b(sneaker|trainer|running shoe)\b"), "sneakers"),
        (re.compile(r"\b(shoe|footwear|boot|sandal|slipper|loafer|heel)\b"), "shoes"),
    ]
    for pattern, slug in rules:
        if pattern.search(key):
            return slug
    return "t-shirt"


def fetch_db_products() -> Counter[str]:
    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        raise SystemExit("SUPABASE_DB_URL not set in .env")

    sql = """
        select unnest(principal_products) as product, count(*) as n
        from public.suppliers
        where array_length(principal_products, 1) > 0
        group by 1
        order by n desc, product
    """
    counts: Counter[str] = Counter()
    with psycopg.connect(dsn, prepare_threshold=None, connect_timeout=20) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            for product, n in cur.fetchall():
                if product:
                    counts[product.strip()] += n
    return counts


def json_unique_names() -> dict[str, str]:
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    seen: dict[str, str] = {}
    for icon in data["icons"]:
        name = icon["name"].strip().lower()
        if name not in seen:
            seen[name] = icon["icon_id"]
    return seen


def slug_to_file(slug: str) -> Path:
    return ICONS_DIR / f"{slug}.png"


def main() -> None:
    downloaded = {p.stem for p in ICONS_DIR.glob("*.png")}
    json_names = json_unique_names()

    print("=== Downloaded icon slugs ===")
    print(f"  {len(downloaded)} files in {ICONS_DIR}\n")

    print("=== JSON export names NOT downloaded as dedicated slug ===")
    slug_map = {
        "mini skirt": "skirt",
        "overalls": None,
        "cargo pants": "trousers",
        "bras": "bikini",
        "underpants": "boxers",
        "women suit": "suit",
        "necklace": None,
        "pendant": None,
        "ring": None,
        "bracelet": None,
        "briefcase": None,
        "earrings": None,
        "tie": None,
        "bowtie": None,
        "purse": "bag",
        "wallet": "bag",
        "suitcase": "bag",
        "hat": "cap",
        "watch": None,
        "gloves": None,
        "sunglasses": None,
        "glasses": None,
    }
    missing_from_json: list[str] = []
    for name, icon_id in sorted(json_names.items()):
        normalized = name.replace(" ", "-")
        if normalized in downloaded or name in slug_map:
            continue
        # check if any downloaded slug matches loosely
        if any(name in s or s in name for s in downloaded):
            continue
        missing_from_json.append(f"{name} ({icon_id})")

    for line in missing_from_json:
        print(f"  - {line}")
    if not missing_from_json:
        print("  (none — all JSON names map to downloaded slugs or proxied rules)")

    print("\n=== Database principal_products audit ===")
    counts = fetch_db_products()
    print(f"  Distinct values: {len(counts)}")
    print(f"  Total supplier-product rows: {sum(counts.values())}\n")

    slug_usage: Counter[str] = Counter()
    fallback_only: list[tuple[str, int, str]] = []
    missing_file: list[tuple[str, int, str]] = []
    non_apparel: list[tuple[str, int, str]] = []

    non_apparel_patterns = re.compile(
        r"\b(packaging|label|paperboard|carton|box|polybag|hangtag|"
        r"printing|dyeing|washing|laundry|garment wash|"
        r"machine|equipment|needle|thread|button|rivet|"
        r"leather|accessories|trim|interlining|fusing|"
        r"compliance|consultancy|agent|broker)\b",
        re.I,
    )

    for product, n in counts.items():
        slug = product_icon_slug(product)
        slug_usage[slug] += n
        path = slug_to_file(slug)
        if slug == "t-shirt" and not re.search(
            r"\b(t[\s-]?shirt|tee|unisex|shirt|top|garment|apparel|wear|clothing)\b",
            canonical_key(product),
            re.I,
        ):
            fallback_only.append((product, n, slug))
        if not path.exists():
            missing_file.append((product, n, slug))
        if non_apparel_patterns.search(product) and slug in {"t-shirt", "shirt", "belt"}:
            non_apparel.append((product, n, slug))

    print("=== Slug usage (top 20 by supplier count) ===")
    for slug, n in slug_usage.most_common(20):
        exists = "OK" if slug_to_file(slug).exists() else "MISSING FILE"
        print(f"  {slug:20} {n:5} suppliers  [{exists}]")

    print("\n=== Values falling back to generic t-shirt (no specific rule) ===")
    for product, n, slug in sorted(fallback_only, key=lambda x: -x[1])[:40]:
        print(f"  [{n:4}] {product!r} -> {slug}")

    print("\n=== Non-apparel / trim values using garment proxy ===")
    for product, n, slug in sorted(non_apparel, key=lambda x: -x[1])[:25]:
        print(f"  [{n:4}] {product!r} -> {slug}")

    print("\n=== JSON names with no mapping rule (potential dedicated icons) ===")
    candidates = []
    for name in sorted(json_names):
        key = canonical_key(name)
        slug = product_icon_slug(name)
        if slug == "t-shirt" and name not in {"tee", "t-shirt", "shirt"}:
            candidates.append((name, json_names[name], slug))
    for name, iid, slug in candidates:
        print(f"  {name} ({iid}) -> currently {slug}")

    print("\n=== Recommended missing downloads ===")
    recommendations = []
    # From JSON not downloaded
    want = {
        "overalls": "4213824",
        "cargo pants": "4213825",  # or map to trousers
        "bras": "4213830",
        "tie": "4213848",
        "gloves": "4213875",
        "watch": "4213874",
        "hat": "4213865",
        "women suit": "4213837",
        "underpants": "4213838",
    }
    for slug, iid in want.items():
        file_slug = slug.replace(" ", "-")
        if file_slug not in downloaded:
            recommendations.append((file_slug, iid, slug))
    for file_slug, iid, label in recommendations:
        print(f"  DOWNLOAD {file_slug}.png ({iid}) for '{label}'")

    if missing_file:
        print("\n=== CRITICAL: mapped slugs with missing files ===")
        for product, n, slug in missing_file:
            print(f"  [{n}] {product!r} -> {slug}.png MISSING")


if __name__ == "__main__":
    main()
