#!/usr/bin/env python3
"""Assemble dashboard component previews (artifact) + standalone mockup (browser)."""
import os, re, json, glob, html
HERE = os.path.dirname(os.path.abspath(__file__))
BASE = open(f"{HERE}/base.css").read()
TOKENS = open(f"{HERE}/tokens.css").read()

CDN = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/"
PHOTOS = {
 "6102":"hf_20260918_053910_0973a0a9-4470-4fbb-b716-7d9817803f85",
 "6103":"hf_20260918_053910_e286dd20-9d42-4119-9a8e-4ec1170040aa",
 "6104":"hf_20260918_053910_b074fbfd-68ae-45d0-bf79-b63489d1ab13",
 "6105":"hf_20260918_053911_a35f4b25-5687-4eb1-84eb-4d95907a9744",
 "6106":"hf_20260918_053910_f3819fdb-212b-472c-a4b3-705bbfb720f7",
 "6107":"hf_20260918_053910_9a64a194-dd11-4c06-90c0-4ec48daa842c",
 "6108":"hf_20260918_053911_e5bb124b-ea2a-4f14-93ae-8e6380343c52",
 "6109":"hf_20260918_053910_dced786b-f91c-416f-8edf-4f4c49ad9c96",
 "6110":"hf_20260918_053910_7692a1ed-097a-410b-81b3-3bdbf2a8b0bc",
 "6111":"hf_20260918_053910_96fdfa8a-0cc9-4334-be38-649dbf6f616c",
 "6114":"hf_20260918_053910_c619cbc2-f799-4cef-825a-f8e6fc5eb0a8",
 "6115":"hf_20260918_053910_c00662e0-6971-48a3-b42c-66e7a07c4bb0",
}
HS = {
 "6102":"Women's knitted overcoats","6103":"Men's knitted suits, ensembles","6104":"Women's knitted suits, ensembles",
 "6105":"Men's knitted shirts","6106":"Women's knitted blouses","6107":"Men's knitted underwear","6108":"Women's knitted nightwear",
 "6109":"T-shirts, singlets, vests","6110":"Jerseys, pullovers, cardigans","6111":"Babies' knitted garments",
 "6114":"Other knitted garments","6115":"Tights, socks, hosiery",
}
def img(code, size="min"):
    return f"{CDN}{PHOTOS[code]}{'_min.webp' if size=='min' else '.png'}"

def expand(src):
    # {{img:6109}} -> url ; {{hs:6109}} -> description
    src = re.sub(r"\{\{img:(\d+)\}\}", lambda m: img(m.group(1)), src)
    src = src.replace('<img src=', '<img onerror="this.style.display=\'none\'" src=')
    src = re.sub(r"\{\{hs:(\d+)\}\}", lambda m: HS[m.group(1)], src)
    # {{inc:name}} -> screens/_name.html
    def inc(m):
        return expand(open(f"{HERE}/screens/_{m.group(1)}.html").read())
    return re.sub(r"\{\{inc:([\w-]+)\}\}", inc, src)

def preview(name, group, height, body, extra_css=""):
    return (f'<!-- @dsCard group="{group}" height={height} -->\n<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            f'<title>{name} — preview</title>\n<style>\n{BASE}\n{extra_css}\n</style>\n</head>\n<body>\n{body}\n</body>\n</html>\n')

def standalone(title, sections):
    fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">'
    parts = []
    for cap, body, css in sections:
        parts.append(f'<section class="scr"><div class="scap"><span class="eyebrow">{cap}</span></div><div class="frame">{body}</div><style>{css}</style></section>')
    page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title>{fonts}
<style>{TOKENS}\n{BASE}
body{{background:var(--surface-sunken);padding:var(--space-8) var(--space-6);}}
.scr{{max-width:1400px;margin:0 auto var(--space-12);}} .scap{{padding:0 0 var(--space-2);}} .frame{{background:var(--canvas);border:1px solid var(--line);border-radius:var(--radius-md);overflow:hidden;box-shadow:var(--shadow-sm);}}
.intro{{max-width:1400px;margin:0 auto var(--space-8);}}
</style></head><body>
<div class="intro"><div class="h-lg">SourceBD dashboard — end-to-end flow</div><div class="muted" style="margin-top:4px">Search → results → supplier record → RFQ. Every record shown is real (production, 18 Sep 2026). Product photos generated per EPB HS code for Aboni Knitwear Ltd. Lavender = V2 (AI), design-only for V1.</div></div>
{"".join(parts)}
</body></html>'''
    return page

if __name__ == "__main__":
    spec = json.load(open(f"{HERE}/screens/spec.json"))
    out_components = f"{HERE}/project/components"
    os.makedirs(out_components, exist_ok=True)
    sections = []
    for c in spec["components"]:
        body = expand(open(f"{HERE}/screens/{c['file']}").read())
        css = c.get("css", "")
        d = f"{out_components}/{c['name']}"
        os.makedirs(d, exist_ok=True)
        open(f"{d}/preview.html", "w").write(preview(c["name"], c["group"], c["height"], body, css))
        if c.get("readme"):
            open(f"{d}/README.md", "w").write(c["readme"].strip() + "\n")
        if c.get("mockup", True):
            sections.append((c.get("caption", c["name"]), body, css))
    os.makedirs(f"{HERE}/out", exist_ok=True)
    open(f"{HERE}/out/dashboard-flow.html", "w").write(standalone("SourceBD dashboard — flow", sections))
    print("built", len(spec["components"]), "components")
