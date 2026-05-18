"""Probe rsc-bd.org public factory pages for location."""
import httpx, re
from bs4 import BeautifulSoup

cli = httpx.Client(verify=False, timeout=20, follow_redirects=True,
                   headers={"User-Agent": "Mozilla/5.0"})

# Known active factory ids from list endpoint
for fid in (9552, 24192, 23698, 9456):
    for url_pat in (
        f"https://rsc-bd.org/en/factory/{fid}",
        f"https://accord2.fairfactories.org/factories/{fid}",
        f"https://rsc-bd.org/en/factories/{fid}",
    ):
        try:
            r = cli.get(url_pat)
            print(f"{r.status_code} {url_pat}  len={len(r.text)}")
            if r.status_code == 200 and len(r.text) > 5000:
                # search for address-ish keywords
                soup = BeautifulSoup(r.text, "html.parser")
                text = soup.get_text(" ", strip=True)
                for kw in ("Address", "Location", "District", "Dhaka", "Narayanganj", "Gazipur"):
                    m = re.search(rf"{kw}[^a-z]{{0,80}}", text, re.I)
                    if m:
                        print(f"   {kw!r:14s} -> {m.group(0)[:200]!r}")
                # Also dump JSON-LD or data-attrs
                for s in soup.find_all("script", type="application/ld+json")[:1]:
                    print("   LD-JSON:", s.string[:400] if s.string else "")
                break
        except Exception as e:
            print(f"ERR {url_pat}: {e}")
    print()
