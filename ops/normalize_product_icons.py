"""Normalize product icon PNGs to a consistent visual size on 200x200 canvas."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ICONS_DIR = ROOT / "public" / "icons" / "products"

CANVAS = 200
TARGET_MAX = 176  # match legacy Noun Project set (~88% of canvas)
ALPHA_CUTOFF = 20


def normalize_icon(path: Path, *, target_max: int = TARGET_MAX) -> tuple[int, int]:
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    alpha = arr[:, :, 3]
    ys, xs = np.where(alpha > ALPHA_CUTOFF)
    if len(xs) == 0:
        raise ValueError(f"No visible pixels in {path.name}")

    cropped = im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    cw, ch = cropped.size
    scale = target_max / max(cw, ch)
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)

    out = np.zeros((CANVAS, CANVAS, 4), dtype=np.uint8)
    x0 = (CANVAS - nw) // 2
    y0 = (CANVAS - nh) // 2

    r = np.array(resized)
    glyph_alpha = r[:, :, 3]
    visible = glyph_alpha > ALPHA_CUTOFF
    out[y0 : y0 + nh, x0 : x0 + nw, 3] = np.where(visible, glyph_alpha, 0)

    Image.fromarray(out, "RGBA").save(path, optimize=True)
    return nw, nh


def main() -> None:
    slugs = [
        "athletic-wear",
        "back-board",
        "barcode",
        "carton",
        "elastic",
        "hanger",
        "home-textile",
        "lace",
        "leggings",
        "neck-board",
        "pajamas",
        "poly-bag",
        "price-tag",
        "printed-label",
        "t-shirt",
        "tissue-paper",
    ]
    for slug in slugs:
        path = ICONS_DIR / f"{slug}.png"
        if not path.exists():
            print(f"skip missing {slug}")
            continue
        w, h = normalize_icon(path)
        print(f"normalized {slug}.png -> {w}x{h} glyph")


if __name__ == "__main__":
    main()
