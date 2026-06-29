"""Offline audit: JSON export + platform references vs downloaded icons."""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JSON_PATH = Path(r"c:\Users\Hp\Downloads\extract-data-2026-06-29.json")
ICONS_DIR = ROOT / "public" / "icons" / "products"

# Representative principal_products strings from BGMEA harvest + design brief + filter picks
REFERENCE_PRODUCTS = [
    "Denim Pant",
    "Denim Shirt",
    "All Kinds of Denim Wear",
    "Knitwear",
    "Knit Garments",
    "Knitted Shirt",
    "Knit and Woven",
    "Woven Shirt",
    "Woven Bottom",
    "Woven Garments",
    "Sweater",
    "T-Shirt",
    "Polo Shirt",
    "Jeans",
    "Trouser",
    "Jacket",
    "Hoodie",
    "Sportswear",
    "Childrens Wear",
    "Lingerie",
    "Shirt",
    "Blazer",
    "Cardigan",
    "Dress",
    "Skirt",
    "Shorts",
    "Underwear",
    "Boxer Shorts",
    "Socks",
    "Home Textile",
    "Towel",
    "Bed Linen",
    "Yarn",
    "Fabric",
    "Greige Fabric",
    "Embroidery",
    "Zipper",
    "Label",
    "Footwear",
    "Shoes",
    "Sneakers",
    "Workwear",
    "Uniform",
    "Lab Coat",
    "Swimwear",
    "Activewear",
    "Women's Apparel",
    "Men's Denim",
    "Unisex Apparel",
    "Pajamas",
    "Bikini",
    "Overalls",
    "Cargo Pants",
    "Bras",
    "Tie",
    "Gloves",
    "Hat",
    "Bag",
    "Leather Goods",
    "Printing",
    "Garment Washing",
    "Packaging",
    "Accessories & Trims",
]

# Import slug resolver from audit script inline
exec((ROOT / "ops" / "audit_product_icons.py").read_text(encoding="utf-8").split("def fetch_db_products")[0])


def slug_to_file(slug: str) -> Path:
    return ICONS_DIR / f"{slug}.png"


def json_audit() -> tuple[dict[str, str], list[tuple[str, str, str]]]:
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    seen: dict[str, str] = {}
    for icon in data["icons"]:
        name = icon["name"].strip().lower()
        if name not in seen:
            seen[name] = icon["icon_id"]

    downloaded = {p.stem for p in ICONS_DIR.glob("*.png")}
    gaps: list[tuple[str, str, str]] = []

    proxy = {
        "mini skirt": "skirt",
        "cargo pants": "trousers",
        "overalls": "trousers",
        "bras": "bikini",
        "underpants": "boxers",
        "women suit": "suit",
        "purse": "bag",
        "wallet": "bag",
        "suitcase": "bag",
        "hat": "cap",
    }
    for name, icon_id in sorted(seen.items()):
        slug = proxy.get(name) or product_icon_slug(name)
        file_slug = slug.replace(" ", "-")
        if file_slug not in downloaded:
            gaps.append((name, icon_id, slug))
    return seen, gaps


def main() -> None:
    downloaded = sorted(p.stem for p in ICONS_DIR.glob("*.png"))
    print(f"Downloaded: {len(downloaded)} icons\n")

    json_names, json_gaps = json_audit()
    print(f"JSON unique names: {len(json_names)}")
    print("JSON names without local PNG (after proxy rules):")
    if json_gaps:
        for name, iid, slug in json_gaps:
            print(f"  - {name} ({iid}) -> mapped {slug}, file missing")
    else:
        print("  none")

    print("\n=== Platform reference products ===")
    usage: Counter[str] = Counter()
    fallback: list[tuple[str, str]] = []
    missing: list[tuple[str, str]] = []
    for product in REFERENCE_PRODUCTS:
        slug = product_icon_slug(product)
        usage[slug] += 1
        if not slug_to_file(slug).exists():
            missing.append((product, slug))
        if slug == "t-shirt" and not re.search(
            r"\b(t[\s-]?shirt|tee|unisex)\b", canonical_key(product), re.I
        ):
            fallback.append((product, slug))

    print("Slug coverage for reference set:")
    for slug, n in usage.most_common():
        ok = "OK" if slug_to_file(slug).exists() else "MISSING"
        print(f"  {slug:20} {n:2} refs  [{ok}]")

    print("\nReference values using generic t-shirt fallback:")
    for product, slug in fallback:
        print(f"  {product!r} -> {slug}")

    print("\n=== JSON names in export but NO dedicated download (use proxy) ===")
    proxies = []
    dedicated_missing = []
    for name, icon_id in sorted(json_names.items()):
        slug = product_icon_slug(name)
        file_exists = slug_to_file(slug).exists()
        dedicated = slug.replace(" ", "-") == name.replace(" ", "-") or name.replace(" ", "-") in downloaded
        if not dedicated and name not in {
            "tee", "t-shirt", "shirt", "polo", "blouse", "hoodie", "sweater", "cardigan",
            "jumper", "jacket", "coat", "vest", "suit", "dress", "skirt", "denim", "jeans",
            "trousers", "pants", "shorts", "jogger", "boxers", "bikini", "pajamas",
            "socks", "sneakers", "shoes", "scarf", "cap", "bag", "belt", "robe",
        }:
            entry = (name, icon_id, slug, file_exists)
            if slug == "t-shirt" or not file_exists:
                dedicated_missing.append(entry)
            else:
                proxies.append(entry)

    for name, iid, slug, ok in proxies:
        print(f"  {name:18} ({iid}) -> {slug} [{'file OK' if ok else 'MISSING'}]")

    print("\n=== RECOMMENDED downloads (in JSON, no good dedicated icon yet) ===")
    recommend = {
        "overalls": "4213824",
        "bras": "4213830",
        "tie": "4213848",
        "bowtie": "4213850",
        "gloves": "4213875",
        "hat": "4213865",
        "women suit": "4213837",
        "underpants": "4213838",
        "watch": "4213874",
        "sunglasses": "4213877",
        "glasses": "4213880",
        "necklace": "4213842",
        "briefcase": "4213846",
        "purse": "4213856",
        "mini skirt": "4213816",
        "cargo pants": "4213825",
    }
    for name, iid in recommend.items():
        slug = name.replace(" ", "-")
        if slug not in downloaded:
            mapped = product_icon_slug(name)
            print(f"  {slug}.png ({iid}) — JSON '{name}', currently maps to '{mapped}'")

    print("\n=== Discover quick-picks (filter-rail) ===")
    picks = [
        "Denim", "Knitwear", "Woven", "Sweater", "T-Shirt", "Polo", "Jeans",
        "Trouser", "Jacket", "Hoodie", "Sportswear", "Childrens", "Lingerie", "Shirt",
    ]
    for p in picks:
        slug = product_icon_slug(p)
        print(f"  {p:12} -> {slug} [{'OK' if slug_to_file(slug).exists() else 'MISSING'}]")


if __name__ == "__main__":
    main()
