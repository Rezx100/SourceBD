"""Dump full HTML body of a BGMEA member page for parser design."""
import urllib.request, ssl, sys, re

ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0 (compatible; SourceBD/1.0)"
mid = sys.argv[1] if len(sys.argv) > 1 else "5276"
req = urllib.request.Request(f"https://www.bgmea.com.bd/member/{mid}", headers={"User-Agent": UA})
with urllib.request.urlopen(req, context=ctx, timeout=30) as r:
    html = r.read().decode("utf-8", errors="replace")
# strip from after first 'Member Details' h1 to end of last table
i = html.find("Company Information")
j = html.rfind("</table>")
print(html[i:j+9])
