"""One-shot probe — download UK OFSI + EU consolidated sanctions XML and dump
schema-discovery info to stdout. Throwaway script (kept under ops/ alongside
other dryrun probes)."""
from __future__ import annotations

import re
import sys
import urllib.request
from collections import Counter

UA = "SourceBD-Research/1.0 (+https://sourcebd.com/data-policy)"
SOURCES = {
    "OFSI": "https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.xml",
    "EU": "https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw==",
}


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    chunks: list[bytes] = []
    with urllib.request.urlopen(req, timeout=60) as r:
        while True:
            buf = r.read(65536)
            if not buf:
                break
            chunks.append(buf)
    return b"".join(chunks)


def main() -> int:
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for label, url in SOURCES.items():
        if only and label != only:
            continue
        print(f">>> fetching {label} ...", flush=True)
        try:
            data = fetch(url)
        except Exception as e:  # noqa: BLE001
            print(f"=== {label} FAILED: {e} ===", flush=True)
            continue
        text = data.decode("utf-8", "ignore")
        print(f"=== {label} {len(data)} bytes ===", flush=True)
        print(text[:3500], flush=True)
        print(f"--- {label} tag freq ---")
        tags = Counter(re.findall(r"<([A-Za-z_][A-Za-z0-9_:.-]*)", text))
        for tag, n in tags.most_common(40):
            print(f"  {n:7d}  {tag}")
        # find a likely entity record (search for one Entity/Group_Type/Subject_Type block)
        m = re.search(
            r"<(FinancialSanctionsTarget|sanctionEntity)[\s\S]{0,3500}?</\1>",
            text,
        )
        if m:
            print(f"--- {label} sample entity ---")
            print(m.group(0)[:3500])
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
