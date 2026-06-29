"""Download Principal products icon set from Noun Project JSON export."""
from __future__ import annotations

import json
import ssl
import urllib.request
from pathlib import Path

JSON_PATH = Path(r"c:\Users\Hp\Downloads\extract-data-2026-06-29.json")
OUT_DIR = Path(__file__).resolve().parents[1] / "public" / "icons" / "products"

# One icon per slug — first consistent pick from the Principal products set.
ICON_MANIFEST: dict[str, str] = {
    "t-shirt": "4214599",
    "tee": "4214594",
    "shirt": "4214592",
    "polo": "4214595",
    "blouse": "1444151",  # dedicated blouse line icon (4213818 in export is a dress silhouette)
    "gloves": "4213875",
    "hat": "4213865",
    "hoodie": "4213811",
    "sweater": "4213805",
    "cardigan": "4213806",
    "jumper": "4214602",
    "jacket": "4213807",
    "coat": "4213809",
    "vest": "4213835",
    "waistcoat": "4214601",
    "suit": "4213839",
    "tuxedo": "4214600",
    "dress": "4213810",
    "skirt": "4213817",
    "denim": "4213808",
    "jeans": "4213822",
    "trousers": "4213826",
    "pants": "4213829",
    "shorts": "4213827",
    "jogger": "4213823",
    "boxers": "4213832",
    "bras": "4213830",
    "bikini": "4213834",
    "overalls": "4213824",
    "pajamas": "4213836",
    "cargo-pants": "4213825",
    "children-clothes": "4213833",
    "infant-clothes": "4213840",
    "shoes": "4214299",
    "sneakers": "4213881",
    "socks": "4214302",
    "stockings": "4213871",
    "scarf": "4213870",
    "cap": "4213868",
    "bag": "4213851",
    "belt": "4213852",
    "zipper": "7823664",  # not in Principal products JSON; dedicated trim icon
    "tie": "4213848",
    "bowtie": "4213850",
    "robe": "4213841",
    # Supplemental icons (not in Principal products apparel set)
    "carton": "8165428",
    "cardboard": "6961114",
    "fabric-roll": "7626151",
    "yarn": "7792080",
    "care-label": "5936190",
    "elastic": "7327468",
    "tape": "7005459",
    "thread": "7384372",
}


def download(icon_id: str, dest: Path) -> None:
    url = f"https://static.thenounproject.com/png/{icon_id}-200.png"
    req = urllib.request.Request(url, headers={"User-Agent": "SourceBD/1.0"})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
        data = resp.read()
    if len(data) < 100:
        raise RuntimeError(f"Suspiciously small download for {icon_id}")
    dest.write_bytes(data)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest_out = OUT_DIR / "manifest.json"

    with JSON_PATH.open(encoding="utf-8") as f:
        source = json.load(f)

    saved: list[dict[str, str]] = []
    for slug, icon_id in ICON_MANIFEST.items():
        dest = OUT_DIR / f"{slug}.png"
        print(f"Downloading {slug} ({icon_id}) -> {dest.name}")
        download(icon_id, dest)
        saved.append({"slug": slug, "icon_id": icon_id, "file": f"{slug}.png"})

    manifest_out.write_text(
        json.dumps(
            {
                "collection_name": source.get("collection_name"),
                "source": str(JSON_PATH),
                "icons": saved,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\nSaved {len(saved)} icons to {OUT_DIR}")


if __name__ == "__main__":
    main()
