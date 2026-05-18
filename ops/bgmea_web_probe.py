"""Probe BGMEA member-list and member-detail pages to figure out HTML structure."""
from __future__ import annotations
import urllib.request, ssl, re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

UA = "Mozilla/5.0 (compatible; SourceBD/1.0; +https://sourcebd.example)"


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, context=ctx, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


print("=== LIST PAGE 1 — first 5 'Details' anchors ===")
html = fetch("https://www.bgmea.com.bd/page/member-list")
for m in re.finditer(r'<a[^>]+href="([^"]*member[^"]*)"[^>]*>\s*Details', html, re.IGNORECASE)[0:5] if False else list(re.finditer(r'<a[^>]+href="([^"]*member[^"]*)"[^>]*>\s*(?:<[^>]+>)*\s*Details', html, re.IGNORECASE))[:6]:
    print(" ", m.group(1))

print("\n=== MEMBER PAGE 5276 — full HTML length & tab structure ===")
detail = fetch("https://www.bgmea.com.bd/member/5276")
print(f"len={len(detail)}")
# Look for tab content blocks
for tag in ("Company Information", "Address Information", "Final Informaiton",
            "BGMEA Reg", "Factory Address", "Office Address", "Date of Establishment",
            "Factory Type", "Production Capacity", "Principal Exportable",
            "Annual Turnover", "Certifications", "Director Informaiton", "Website"):
    pos = detail.find(tag)
    print(f"  {tag!r:35s} -> pos={pos}")

# Print raw region around the first <table> containing Reg No
m = re.search(r"<table[^>]*>.*?</table>", detail, re.DOTALL)
if m:
    print("\n--- first table (truncated 2000 chars) ---")
    print(m.group(0)[:2000])
