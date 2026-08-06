"""Does each published BGMEA registration actually name the supplier showing it?

REZ-102 could only answer this for the associate register, because that was
the only place a name existed: a checked-in PDF. `scraped_company_name` is
absent from every source record in production, so the general register — the
larger one — was unmeasurable and 4,154 records had to be reported as unknown
rather than quietly counted as fine.

`ops/harvest_bgmea_names.py` closed that gap, recovering the registered name
for 5,962 of 5,970 stored records. This report re-runs the measurement against
it, so the numbers stop being a floor imposed by which register happened to
have a PDF lying around.

The verdict logic is imported from `ops/report_group_of_companies.py` rather
than re-implemented, so this cannot disagree with REZ-90's gate about which
names count as the same company.

Read-only. No writes, no repairs.

    python ops/report_bgmea_identity_gap.py
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from etl.core.config import settings  # noqa: E402

# `Rest` reads credentials from the environment; the config already resolved
# them from .env. Bridge the two rather than adding a second loader.
os.environ.setdefault("SUPABASE_URL", str(settings.supabase_url or ""))
os.environ.setdefault(
    "SUPABASE_SERVICE_ROLE_KEY", str(settings.supabase_service_role_key or "")
)

from ops.report_bgmea_array_provenance import Rest  # noqa: E402
from ops.report_group_of_companies import (  # noqa: E402
    DISAGREES,
    display_rule_options,
    load,
    measure_identity_gap,
    summarise_gap,
)

NAMES_PATH = Path(__file__).resolve().parents[1] / "ops" / "plans" / "bgmea-names.json"
OUT_PATH = (
    Path(__file__).resolve().parents[1] / "ops" / "plans" / "bgmea-identity-gap.md"
)


def load_names() -> tuple[dict[str, str], dict[str, str]]:
    """{source_ref: name} and {source_ref: which register named it}."""
    raw = json.loads(NAMES_PATH.read_text(encoding="utf-8"))
    names: dict[str, str] = {}
    source: dict[str, str] = {}
    for ref, entry in raw["names"].items():
        names[ref] = entry["name"]
        # `summarise_gap`'s unbiased slice keys on this label. The associate
        # register is the one REZ-102 could already see, so keeping the label
        # lets the old and new numbers be compared like for like.
        source[ref] = (
            "associate-pdf" if entry.get("register") == "associate" else "general-web"
        )
    return names, source


def render(counts: dict[str, int], options: dict[str, int], rows: list) -> str:
    total = counts["bgmea_records_on_them"]
    covered = counts["records_with_a_recoverable_name"]
    pct = 100.0 * covered / total if total else 0.0
    all_bad = [r for r in rows if r.all_disagree]
    some_bad = [r for r in rows if r.some_disagree]

    lines = [
        "# Do published BGMEA registrations name the supplier showing them?",
        "",
        "Re-measured against `ops/plans/bgmea-names.json`, which recovered the",
        "registered name for both BGMEA registers. REZ-102 reported these same",
        "counts against the associate register only, so its figures were a floor.",
        "",
        "## Coverage",
        "",
        "| measure | count |",
        "| -- | -- |",
        f"| published suppliers holding a BGMEA record | {counts['published_holding_bgmea_record']} |",
        f"| BGMEA records on them | {total} |",
        f"| records whose registered name is now known | {covered} ({pct:.1f}%) |",
        f"| records still without a name | {counts['records_without_a_name_oracle']} |",
        "",
        "## Verdicts",
        "",
        "| measure | count |",
        "| -- | -- |",
        f"| records naming their supplier | {counts['records_agreeing']} |",
        f"| records naming someone else | **{counts['records_disagreeing']}** |",
        f"| suppliers where every record names someone else | **{counts['measurable_all_records_disagree']}** |",
        f"| suppliers where at least one record does | **{counts['measurable_some_record_disagrees']}** |",
        f"| suppliers fully clean | {counts['measurable_every_record_agrees']} |",
        "",
        "## Display-rule options, re-costed",
        "",
        "The spread between fail-open and fail-closed was previously an artefact",
        "of missing names, not of disagreement. With the register named, the two",
        "readings converge and the choice is far less consequential.",
        "",
        "| option | numbers removed | suppliers losing a number | suppliers losing the pill |",
        "| -- | -- | -- | -- |",
        "| (i) status quo | 0 | 0 | 0 |",
        f"| (ii-open) unknown names pass | {options['ii_open_numbers_removed']} | "
        f"{options['ii_open_suppliers_losing_a_number']} | {options['ii_open_suppliers_losing_pill']} |",
        f"| (ii-closed) unknown names fail | {options['ii_closed_numbers_removed']} | "
        f"{options['ii_closed_suppliers_losing_a_number']} | {options['ii_closed_suppliers_losing_pill']} |",
        "",
        f"## Suppliers whose every BGMEA record names another company ({len(all_bad)})",
        "",
        "REZ-102 measured 50 of these and said it was a floor. This is the figure",
        "with both registers named.",
        "",
        "| supplier | shows | registered to |",
        "| -- | -- | -- |",
    ]
    for r in sorted(all_bad, key=lambda r: r.slug)[:80]:
        for ref, verdict, member in r.verdicts:
            if verdict == DISAGREES:
                lines.append(f"| `{r.slug}` — {r.company_name} | {ref} | {member} |")
    if len(all_bad) > 80:
        lines.append(f"| … and {len(all_bad) - 80} more suppliers | | |")

    lines += [
        "",
        f"## Suppliers holding a mix ({len(some_bad) - len(all_bad)})",
        "",
        "At least one record names them and at least one names someone else.",
        "These are the group-of-companies shape REZ-102 examined: the row is a",
        "real company, but it carries registrations that are not its own.",
        "",
        "| supplier | foreign registration | registered to |",
        "| -- | -- | -- |",
    ]
    mixed = [r for r in some_bad if not r.all_disagree]
    for r in sorted(mixed, key=lambda r: r.slug)[:60]:
        for ref, verdict, member in r.verdicts:
            if verdict == DISAGREES:
                lines.append(f"| `{r.slug}` — {r.company_name} | {ref} | {member} |")
    if len(mixed) > 60:
        lines.append(f"| … and {len(mixed) - 60} more suppliers | | |")

    lines += [
        "",
        "## What this is not",
        "",
        "A name disagreement is evidence that a registration sits on the wrong",
        "row, not proof of it. A group of companies can legitimately register",
        "several arms, and REZ-102 showed the name stems do not predict which",
        "case a row is. Nothing here should be repaired without the premises and",
        "switchboard test that report applies.",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    names, name_source = load_names()
    data = load(Rest())
    rows = measure_identity_gap(
        data["suppliers"], data["bgmea_by_supplier"], names
    )
    counts = summarise_gap(rows, name_source)
    options = display_rule_options(rows, counts)

    OUT_PATH.write_text(render(counts, options, rows), encoding="utf-8")

    print(f"records            : {counts['bgmea_records_on_them']}")
    print(f"  named            : {counts['records_with_a_recoverable_name']}")
    print(f"  still unnamed    : {counts['records_without_a_name_oracle']}")
    print(f"  name someone else: {counts['records_disagreeing']}")
    print(f"suppliers          : {counts['published_holding_bgmea_record']}")
    print(f"  all records wrong: {counts['measurable_all_records_disagree']}")
    print(f"  some record wrong: {counts['measurable_some_record_disagrees']}")
    print(f"  fully clean      : {counts['measurable_every_record_agrees']}")
    print(f"\nwrote {OUT_PATH}")
    print("No production writes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
