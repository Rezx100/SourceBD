"""Print first 80 lines of pdfplumber-extracted BGMEA PDF text."""
from __future__ import annotations
import pdfplumber
from etl.core.config import settings

p = settings.etl_raw_dir / "BGMEA_Associate_Members.pdf"
with pdfplumber.open(str(p)) as pdf:
    print(f"PAGES: {len(pdf.pages)}")
    for i, page in enumerate(pdf.pages[:2]):
        print(f"===== PAGE {i+1} =====")
        txt = page.extract_text() or ""
        print(repr(txt[:2500]))
