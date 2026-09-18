import asyncio, os, sys, json
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
AF = os.environ.get("DS_FONTS", "./fonts")  # woff2 files read from the artifact (project/fonts/)
TOK = open(f"{HERE}/tokens.css").read()
import base64
def b64(f): return base64.b64encode(open(f"{AF}/{f}","rb").read()).decode()
FONTS = f"""
@font-face{{font-family:Geist;src:url(data:font/woff2;base64,{b64('Geist-Variable.woff2')}) format('woff2');font-weight:100 900}}
@font-face{{font-family:'Geist Mono';src:url(data:font/woff2;base64,{b64('GeistMono-Variable.woff2')}) format('woff2');font-weight:100 900}}
@font-face{{font-family:'Instrument Serif';src:url(data:font/woff2;base64,{b64('InstrumentSerif-Italic.woff2')}) format('woff2');font-style:italic}}
"""
WIDTHS = {"AppShell":1440,"Dashboard":1440,"SupplierSheet":900,"RFQComposer":1240,"RFQList":1140,"ProductSheet":780}
async def main(names, themes):
    spec = json.load(open(f"{HERE}/screens/spec.json"))
    os.makedirs(f"{HERE}/shots", exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for c in spec["components"]:
            if names and c["name"] not in names: continue
            html = open(f"{HERE}/project/components/{c['name']}/preview.html").read()
            for theme in themes:
                html2 = html.replace("<html lang=\"en\">", f"<html lang=\"en\" data-theme=\"{theme}\">").replace("<style>", f"<style>{TOK}{FONTS}", 1)
                w = WIDTHS.get(c["name"], 1040)
                pg = await b.new_page(viewport={"width": w, "height": c["height"]}, device_scale_factor=1)
                await pg.set_content(html2, wait_until="load")
                await pg.wait_for_timeout(600)
                await pg.screenshot(path=f"{HERE}/shots/{c['name']}-{theme}.png", full_page=True)
                await pg.close()
        await b.close()
names = sys.argv[1].split(",") if len(sys.argv) > 1 and sys.argv[1] else []
themes = sys.argv[2].split(",") if len(sys.argv) > 2 else ["light"]
asyncio.run(main(names, themes))
