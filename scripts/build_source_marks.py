"""Build the one-colour source marks from the founder's logo files.

Reads the originals in public/inapp-logos/ and writes, per source code, the
mono reduction `logos.lock.md` §5.2 allows (the only change to a mark):
every pixel keeps its shape and loses its colour. The result is black with
alpha = how far the pixel is from the logo's own background, so a mark drawn
as a CSS mask takes the kit's ink colour. Trimmed to the mark's bounds.

    python scripts/build_source_marks.py

Re-run when an original changes. Output: public/icons/sources/<group>/<code>.png
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "inapp-logos"
OUT = ROOT / "public" / "icons" / "sources"

# code -> (original file, group, crop box as fractions or None)
MARKS = {
    # BEPZA and DIFE were fetched from their own sites on 27 Sep 2026:
    # bepza.gov.bd (build/theme/images/logo-sm.png) and lima.dife.gov.bd
    # (assets/images/logo-DIFE.png). RJSC publishes no mark of its own —
    # roc.gov.bd shows the government seal, whose one-colour reduction is a
    # solid disc — so RJSC keeps its letters.
    "bepza": ("BEPZA-logo.png", "regulatory", None),
    "dife": ("DIFE-logo.png", "regulatory", None),
    "epb": ("EPB-Logo.png", "regulatory", None),
    "rsc": ("RSC-logo.png", "regulatory", None),
    "bgmea": ("BGMEA logo.png", "associations", None),
    "bkmea": ("bkmea.png", "associations", None),
    "btma": ("BTMA.webp", "associations", None),
    "bgapmea": ("BGAPMEA logo.png", "associations", None),
    "wrap": ("wrap.png", "cert", None),
    "gots": ("gost.png", "cert", None),
    # The corporate OEKO-TEX mark only: the file also carries the "STANDARD
    # 100" hangtag line, which logos.lock.md §3 says never to show.
    "oeko-tex": ("okeo100.png", "cert", (0.0, 0.0, 1.0, 0.62)),
}


def mono(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    # The logo's own background: the corner, if the file has no transparency.
    corner = px[0, 0]
    bg = (255, 255, 255) if corner[3] < 128 else corner[:3]
    out = Image.new("RGBA", (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            dist = max(abs(r - bg[0]), abs(g - bg[1]), abs(b - bg[2]))
            ink = min(1.0, dist / 96)  # anti-aliased edges keep their softness
            op[x, y] = (0, 0, 0, round(a * ink))
    box = out.getbbox()
    return out.crop(box) if box else out


def main() -> None:
    for code, (name, group, crop) in MARKS.items():
        img = Image.open(SRC / name)
        if crop:
            w, h = img.size
            img = img.crop((round(crop[0] * w), round(crop[1] * h), round(crop[2] * w), round(crop[3] * h)))
        m = mono(img)
        m.thumbnail((128, 128), Image.LANCZOS)
        dest = OUT / group / f"{code}.png"
        dest.parent.mkdir(parents=True, exist_ok=True)
        m.save(dest, optimize=True)
        print(f"{code}: {dest.relative_to(ROOT)} {m.size}")


if __name__ == "__main__":
    main()
