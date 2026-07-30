"""Print the acquisition transport for every registered scraper.

Quick operator check that registry.py, the scraper classes and the admin
catalogue agree on which transport each source uses.

    python ops/show_transports.py
"""
from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from etl.scrapers.registry import SCRAPERS  # noqa: E402


def main() -> int:
    counts: Counter[str] = Counter()
    for code, cls in sorted(SCRAPERS.items()):
        transport = getattr(cls, "transport", "direct")
        acquiring = "yes" if hasattr(cls, "acquire") else "no"
        counts[transport] += 1
        print(f"{code:16s} {transport:10s} source={cls.source_code:12s} acquiring={acquiring}")
    print()
    print("totals:", ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
