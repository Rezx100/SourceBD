#!/usr/bin/env python3
"""Assemble dashboard component previews.

  python3 build.py            -> project/components/<Name>/preview.html  (photos by CDN URL, onerror hides)
  python3 build.py --inline   -> out/render/<Name>.html                   (photos as data URIs, for render.py)

Fragments live in screens/. Expansions: {{inc:name}} -> screens/_name.html, {{img:6109}} -> photo URL,
{{hs:6109}} -> short heading, {{ico:name}} -> inline 16px SVG icon.
"""
import os, re, json, sys, base64, mimetypes
HERE = os.path.dirname(os.path.abspath(__file__))
BASE = open(f"{HERE}/dash.css").read()
INLINE = "--inline" in sys.argv

CAT = json.load(open(f"{HERE}/../assets/products/hs/manifest.json"))
CDN = CAT["generator"]["cdn_base"]
ASSETS = f"{HERE}/../assets/products"
PHOTO = {p["hs"]: p for p in CAT["products"]}          # heading -> record (file, short, exporters, local)
HS = {p["hs"]: p["short"] for p in CAT["products"]}     # short captions: fit a 132px caption at 12px, never clamped
COUNT = {p["hs"]: p["exporters"] for p in CAT["products"]}

def local_photo(code):
    """Path of a local copy if one exists: hs/hs-<code>.png|.min.webp or the aboni-knitwear folder."""
    for f in (f"{ASSETS}/hs/hs-{code}.min.webp", f"{ASSETS}/hs/hs-{code}.png", f"{ASSETS}/aboni-knitwear/hs-{code}.min.webp"):
        if os.path.exists(f): return f
    return None

def photo_url(code):
    """None when the heading has no photo. Inline mode: data URI of the local copy, else None (slot shows the code)."""
    p = PHOTO.get(code)
    if not p: return None
    if INLINE:
        f = local_photo(code)
        if not f: return None
        mime = "image/png" if f.endswith(".png") else "image/webp"
        return f"data:{mime};base64," + base64.b64encode(open(f, "rb").read()).decode()
    return CDN + p["file"].replace(".png", "_min.webp")

def rarest(codes, n):
    """A supplier's lines, least-common first (a code outside the catalogue counts as rarest)."""
    return sorted(codes, key=lambda c: (COUNT.get(c, 0), c))[:n]

def tile(code):
    url = photo_url(code)
    cap = f'<div class="pc"><div class="code">HS {code}</div><div class="n">{HS.get(code, "No photo for this heading")}</div></div>'
    if url:
        return f'<div class="pt"><div class="ph"><img src="{url}" alt=""></div>{cap}</div>'
    return f'<div class="pt"><div class="ph code-only"><span class="code">{code}</span><span class="cap">no photo yet</span></div>{cap}</div>'

def thumb(code):
    url = photo_url(code)
    if url:
        return f'<span class="th"><img src="{url}" alt=""></span>'
    return f'<span class="th code-only"><span>{code}</span></span>'

ICONS = {
 "search": '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14"/>',
 "bookmark": '<path d="M4 2.5h8v11l-4-2.6-4 2.6z"/>',
 "send": '<path d="M14 2 2 6.8l5.2 2 2 5.2z"/><path d="M14 2 7.2 8.8"/>',
 "arrow-r": '<path d="M3 8h10"/><path d="m9 4 4 4-4 4"/>',
 "chev-r": '<path d="m6 3 5 5-5 5"/>',
 "chev-l": '<path d="m10 3-5 5 5 5"/>',
 "caret": '<path d="m4 6.5 4 4 4-4"/>',
 "check": '<path d="m3 8.5 3 3 7-7"/>',
 "x": '<path d="m4 4 8 8M12 4l-8 8"/>',
 "plus": '<path d="M8 3v10M3 8h10"/>',
 "cards": '<rect x="2.5" y="2.5" width="11" height="4.5" rx="1"/><rect x="2.5" y="9" width="11" height="4.5" rx="1"/>',
 "table": '<path d="M2.5 4h11M2.5 8h11M2.5 12h11"/>',
 "sort": '<path d="M5 3v10M5 13l-2.5-2.5M5 13l2.5-2.5M11 13V3M11 3 8.5 5.5M11 3l2.5 2.5"/>',
 "download": '<path d="M8 2.5v8M8 10.5 5 7.5M8 10.5l3-3M3 13.5h10"/>',
 "external": '<path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5M12 9.5v4h-9.5v-9.5h4"/>',
 "funnel": '<path d="M2.5 3h11L9.5 8v4.5l-3 1.5V8z"/>',
 "lock": '<rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
 "warn": '<path d="M8 2.5 14 13H2z"/><path d="M8 6.5v3M8 11.2v.1"/>',
 "clock": '<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.2l2 1.3"/>',
 "check-c": '<circle cx="8" cy="8" r="5.5"/><path d="m5.5 8.2 1.8 1.8 3.4-3.6"/>',
 "shield": '<path d="M8 2.5 13 4.5v4c0 3-2.5 4.8-5 5.5-2.5-.7-5-2.5-5-5.5v-4z"/><path d="m6 8 1.5 1.5L10.2 7"/>',
 "building": '<rect x="3" y="2.5" width="10" height="11" rx="1"/><path d="M6 5.5h1.5M8.5 5.5H10M6 8h1.5M8.5 8H10M6.5 13.5V11h3v2.5"/>',
 "tag": '<path d="M2.5 8.5V3h5.5l5.5 5.5-5.5 5.5z"/><circle cx="5.7" cy="6.2" r="1"/>',
 "chat": '<path d="M2.5 3.5h11v7.5H6l-3.5 2.5z"/>',
 "list": '<path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.5M2.5 8h.5M2.5 12h.5"/>',
 "star-o": '<path d="M8 2.5 9.6 6l3.7.4-2.8 2.5.8 3.7L8 10.7l-3.3 1.9.8-3.7L2.7 6.4 6.4 6z"/>',
 "sparkle": '<path d="M8 2.5 9.3 6.7 13.5 8l-4.2 1.3L8 13.5 6.7 9.3 2.5 8l4.2-1.3z"/>',
 "grid": '<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>',
 "image": '<rect x="2.5" y="3" width="11" height="10" rx="1"/><path d="m2.5 11 3-3 2.5 2.5 2-2 3.5 3.5"/><circle cx="10.5" cy="6" r="1"/>',
 "dots": '<circle cx="4" cy="8" r=".8"/><circle cx="8" cy="8" r=".8"/><circle cx="12" cy="8" r=".8"/>',
 "share": '<path d="M8 2.5v8M8 2.5 5.5 5M8 2.5 10.5 5M3.5 9v4.5h9V9"/>',
 "paperclip": '<path d="m11.5 6.5-4.6 4.6a2 2 0 0 1-2.8-2.8l5-5a1.3 1.3 0 0 1 1.8 1.8l-5 5"/>',
 "compare": '<path d="M6 2.5v11M2.5 5.5 6 2.5l3.5 3M10 13.5v-11M13.5 10.5 10 13.5l-3.5-3"/>',
}

def ico(name, small=False):
    return f'<svg class="i{" s" if small else ""}" viewBox="0 0 16 16" aria-hidden="true">{ICONS[name]}</svg>'

def expand(src):
    # {{strip:6102 6103 ... |n=6|more=+7}} -> the n rarest tiles ; {{thumbs:... |n=3}} -> table thumbs ; {{tile:6105}} ; {{img:6105}}
    def strip(m):
        codes = m.group(1).split(); n = int(m.group(2) or 6)
        return "".join(tile(c) for c in rarest(codes, n))
    src = re.sub(r"\{\{strip:([\d ]+?)(?:\|n=(\d+))?\}\}", strip, src)
    def thumbs(m):
        codes = m.group(1).split(); n = int(m.group(2) or 3)
        return "".join(thumb(c) for c in rarest(codes, n))
    src = re.sub(r"\{\{thumbs:([\d ]+?)(?:\|n=(\d+))?\}\}", thumbs, src)
    src = re.sub(r"\{\{tile:(\d+)\}\}", lambda m: tile(m.group(1)), src)
    src = re.sub(r"\{\{img:(\d+)\}\}", lambda m: photo_url(m.group(1)) or "", src)
    src = re.sub(r"\{\{hs:(\d+)\}\}", lambda m: HS[m.group(1)], src)
    src = re.sub(r"\{\{ico:([\w-]+)\}\}", lambda m: ico(m.group(1)), src)
    src = re.sub(r"\{\{icos:([\w-]+)\}\}", lambda m: ico(m.group(1), True), src)
    if not INLINE:
        src = src.replace('<img src=', '<img onerror="this.style.display=\'none\'" src=')
    def inc(m):
        frag = open(f"{HERE}/screens/_{m.group(1)}.html").read()
        if m.group(2):  # {{inc:sidebar|on=rfqs}} -> move the active nav class to data-nav="rfqs"
            key = m.group(2).split("=", 1)[1]
            frag = frag.replace(' class="on"', '').replace(f'data-nav="{key}"', f'data-nav="{key}" class="on"')
        return expand(frag)
    return re.sub(r"\{\{inc:([\w-]+)(\|on=[\w-]+)?\}\}", inc, src)

def preview(name, group, height, body, extra_css=""):
    return (f'<!-- @dsCard group="{group}" height={height} -->\n<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            f'<title>{name} — preview</title>\n<style>\n{BASE}\n{extra_css}\n</style>\n</head>\n<body>\n{body}\n</body>\n</html>\n')

if __name__ == "__main__":
    spec = json.load(open(f"{HERE}/screens/spec.json"))
    only = [a for a in sys.argv[1:] if not a.startswith("--")]
    out_dir = f"{HERE}/out/render" if INLINE else f"{HERE}/project/components"
    os.makedirs(out_dir, exist_ok=True)
    n = 0
    for c in spec["components"]:
        if only and c["name"] not in only: continue
        body = expand(open(f"{HERE}/screens/{c['file']}").read())
        css = c.get("css", "")
        page = preview(c["name"], c["group"], c["height"], body, css)
        if INLINE:
            open(f"{out_dir}/{c['name']}.html", "w").write(page)
        else:
            d = f"{out_dir}/{c['name']}"; os.makedirs(d, exist_ok=True)
            open(f"{d}/preview.html", "w").write(page)
            if c.get("readme"):
                open(f"{d}/README.md", "w").write(c["readme"].strip() + "\n")
        n += 1
    print("built", n, "components", "(inline photos)" if INLINE else "(CDN photos)")
