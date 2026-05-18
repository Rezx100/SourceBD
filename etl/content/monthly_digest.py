"""Monthly digest generator (Spec 15).

Reads `rsc_industry_metrics`, computes month-over-month + year-over-year deltas
for headline KPIs, and writes two `content_drafts` rows per period:

  - kind = 'newsletter_monthly'         → concise email body (~400 words)
  - kind = 'blog_monthly_state_of_rmg'  → long-form blog post (~1000 words)

Both are markdown. Status starts as 'draft' — a human (admin app, future) reviews
and approves before publish/send.

Usage from CLI:
    python -m etl.cli digest 2026-03
    python -m etl.cli digest latest
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from typing import Iterable

from etl.core.db import db
from etl.core.logging import get_logger

log = get_logger("etl.content.monthly_digest")

# Headline KPIs surfaced in both the newsletter and the blog post.
# (scope, metric_key, display_label, unit, higher_is_better)
HEADLINE_KPIS: list[tuple[str, str, str, str, bool]] = [
    ("inspection_remediation", "total_covered_factory",
        "Factories under RSC oversight", "count", True),
    ("inspection_remediation", "factories_initially_inspected",
        "Factories initially inspected", "count", True),
    ("inspection_remediation", "factories_gt90pct_remediated",
        "Factories with >90% initial issues remediated", "count", True),
    ("inspection_remediation", "factories_recognition_letter",
        "Factories receiving Recognition Letter", "count", True),
    ("inspection_remediation", "initial_remediation_progress_rate_pct",
        "Initial remediation progress rate", "pct", True),
    ("inspection_remediation", "initial_findings_progress_fire_pct",
        "Fire-safety initial findings progress", "pct", True),
    ("inspection_remediation", "initial_findings_progress_electrical_pct",
        "Electrical-safety initial findings progress", "pct", True),
    ("inspection_remediation", "initial_findings_progress_structural_pct",
        "Structural-safety initial findings progress", "pct", True),
    ("escalation", "stage_1_factories",
        "Factories on Escalation Stage 1", "count", False),
    ("escalation", "stage_2_factories",
        "Factories on Escalation Stage 2", "count", False),
    ("escalation", "stage_3_factories",
        "Factories on Escalation Stage 3", "count", False),
]


@dataclass
class KpiRow:
    scope: str
    key: str
    label: str
    unit: str
    higher_is_better: bool
    current: float | None
    prev_month: float | None
    prev_year: float | None

    def fmt(self, v: float | None) -> str:
        if v is None:
            return "—"
        if self.unit == "pct":
            return f"{v:.2f}%"
        return f"{int(v):,}" if abs(v - int(v)) < 0.001 else f"{v:,.2f}"

    def delta_mom(self) -> tuple[str, str]:
        """Return (formatted_delta, arrow_emoji_free_marker) for month-over-month."""
        return self._delta(self.prev_month)

    def delta_yoy(self) -> tuple[str, str]:
        return self._delta(self.prev_year)

    def _delta(self, base: float | None) -> tuple[str, str]:
        if self.current is None or base is None:
            return ("—", "")
        diff = self.current - base
        if abs(diff) < 1e-9:
            return ("0", "→")
        marker = "▲" if (diff > 0) == self.higher_is_better else "▼"
        if self.unit == "pct":
            return (f"{diff:+.2f} pp", marker)
        return (f"{diff:+,.0f}", marker)


# --------------------------------------------------------------------------- #
# Data loading
# --------------------------------------------------------------------------- #

def _load_value(period: date, scope: str, key: str) -> float | None:
    """Latest value for a metric in the given month, preferring monthly_report > updates_page."""
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """select value_num
                 from public.rsc_industry_metrics
                where report_month = %s and scope = %s and metric_key = %s
                order by case source
                           when 'rsc_monthly_report' then 1
                           when 'rsc_updates_page'   then 2
                           else 3 end,
                         fetched_at desc
                limit 1""",
            (period, scope, key),
        )
        row = cur.fetchone()
        return float(row["value_num"]) if row and row["value_num"] is not None else None


def latest_period() -> date | None:
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """select max(report_month) as m
                 from public.rsc_industry_metrics
                where source in ('rsc_monthly_report','rsc_updates_page')"""
        )
        row = cur.fetchone()
        return row["m"] if row and row["m"] else None


def _shift_month(d: date, months: int) -> date:
    y, m = d.year, d.month + months
    while m <= 0:
        m += 12
        y -= 1
    while m > 12:
        m -= 12
        y += 1
    return date(y, m, 1)


def collect_kpis(period: date) -> list[KpiRow]:
    rows: list[KpiRow] = []
    pm = _shift_month(period, -1)
    py = _shift_month(period, -12)
    for scope, key, label, unit, hib in HEADLINE_KPIS:
        rows.append(
            KpiRow(
                scope=scope,
                key=key,
                label=label,
                unit=unit,
                higher_is_better=hib,
                current=_load_value(period, scope, key),
                prev_month=_load_value(pm, scope, key),
                prev_year=_load_value(py, scope, key),
            )
        )
    return rows


# --------------------------------------------------------------------------- #
# Markdown rendering
# --------------------------------------------------------------------------- #

_MONTHS = ["", "January", "February", "March", "April", "May", "June",
           "July", "August", "September", "October", "November", "December"]


def _period_label(d: date) -> str:
    return f"{_MONTHS[d.month]} {d.year}"


def render_newsletter(period: date, kpis: list[KpiRow]) -> tuple[str, str, str]:
    """Return (title, subtitle, body_markdown)."""
    label = _period_label(period)
    title = f"SourceBD Compliance Brief — {label}"
    subtitle = "Bangladesh RMG factory safety, in numbers"

    have = [k for k in kpis if k.current is not None]
    headline = next((k for k in have
                     if k.key == "initial_remediation_progress_rate_pct"), None)

    lines: list[str] = []
    lines.append(f"# {title}")
    lines.append("")
    lines.append(f"*{subtitle}*")
    lines.append("")
    lines.append(
        "Each month we summarise the RMG Sustainability Council's published "
        "industry data so sourcing, compliance, and ESG teams have one clean "
        "snapshot of where Bangladesh garment manufacturing stands."
    )
    lines.append("")
    if headline and headline.current is not None:
        d_mom, mark_mom = headline.delta_mom()
        d_yoy, mark_yoy = headline.delta_yoy()
        lines.append(
            f"**Headline:** Initial remediation progress across fire, electrical "
            f"and structural inspections sits at **{headline.fmt(headline.current)}** "
            f"({mark_mom} {d_mom} vs last month, {mark_yoy} {d_yoy} vs same month last year)."
        )
        lines.append("")

    lines.append("## Industry KPIs")
    lines.append("")
    lines.append("| Metric | This month | vs prev month | vs same month last year |")
    lines.append("|---|---:|---:|---:|")
    for k in kpis:
        d_mom, mark_mom = k.delta_mom()
        d_yoy, mark_yoy = k.delta_yoy()
        lines.append(
            f"| {k.label} | {k.fmt(k.current)} | {mark_mom} {d_mom} | {mark_yoy} {d_yoy} |"
        )
    lines.append("")
    lines.append("## What this means for buyers")
    lines.append("")
    lines.append(
        "- Compare any factory in your sourcing pipeline to these industry "
        "averages directly on its SourceBD profile (look for the **Benchmark** badge)."
    )
    lines.append(
        "- Filter by *Recognition Letter received* or *Initial Remediation > 90%* "
        "in Smart Search to short-list factories materially above the industry mean."
    )
    lines.append(
        "- Watch the Escalation Stage counts — these are factories the RSC has "
        "formally flagged for non-compliance. SourceBD blocks them from your "
        "outreach list automatically."
    )
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append(
        f"*Source: RMG Sustainability Council monthly report and updates page, "
        f"{label}. Full methodology and the underlying PDFs are linked from each "
        f"supplier profile on SourceBD.*"
    )
    return title, subtitle, "\n".join(lines)


def render_blog_post(period: date, kpis: list[KpiRow]) -> tuple[str, str, str]:
    label = _period_label(period)
    title = f"State of Bangladesh RMG Compliance — {label}"
    subtitle = (
        "An independent breakdown of the RMG Sustainability Council's "
        f"{label} inspection and remediation data."
    )

    by_key = {k.key: k for k in kpis}

    def get(key: str) -> KpiRow | None:
        return by_key.get(key)

    lines: list[str] = []
    lines.append(f"# {title}")
    lines.append("")
    lines.append(f"_{subtitle}_")
    lines.append("")
    lines.append(
        "More than a decade after the Rana Plaza collapse, factory safety in "
        "Bangladesh's ready-made garment sector is the most measured supply-chain "
        "compliance regime on earth. Each month, the RMG Sustainability Council "
        "(RSC) — successor to the Bangladesh Accord — publishes a snapshot of "
        f"every covered factory's progress. Here's what {label} looked like."
    )
    lines.append("")

    # Coverage paragraph
    cov = get("total_covered_factory")
    brand = get("brand_factory")
    indep = get("independent_factory")
    if cov and cov.current is not None:
        d_mom, mark = cov.delta_mom()
        sentence = (
            f"## Coverage\n\n"
            f"As of {label}, **{cov.fmt(cov.current)} factories** are under RSC "
            f"oversight ({mark} {d_mom} vs the previous month)."
        )
        if brand and indep and brand.current and indep.current:
            sentence += (
                f" Of these, {brand.fmt(brand.current)} are linked to international "
                f"brand signatories and {indep.fmt(indep.current)} are independent / "
                f"no-brand factories — a meaningful indicator that the RSC framework "
                f"is reaching beyond the original Accord brand network."
            )
        lines.append(sentence)
        lines.append("")

    # Inspection paragraph
    insp = get("factories_initially_inspected")
    wait = get("factories_waiting_for_inspection")
    if insp and insp.current is not None:
        d_mom, mark = insp.delta_mom()
        body = (
            f"## Inspection throughput\n\n"
            f"**{insp.fmt(insp.current)} factories** have completed an initial "
            f"safety inspection ({mark} {d_mom} vs last month)."
        )
        if wait and wait.current is not None:
            body += f" {wait.fmt(wait.current)} factories remain on the inspection waiting list."
        lines.append(body)
        lines.append("")

    # Progress paragraph
    prog = get("initial_remediation_progress_rate_pct")
    fire = get("initial_findings_progress_fire_pct")
    elec = get("initial_findings_progress_electrical_pct")
    struct_ = get("initial_findings_progress_structural_pct")
    if prog and prog.current is not None:
        d_mom, mark_mom = prog.delta_mom()
        d_yoy, mark_yoy = prog.delta_yoy()
        body = (
            f"## Remediation progress\n\n"
            f"The headline number is the **Initial Remediation Progress Rate** — "
            f"the share of safety findings closed out by RSC engineers across the "
            f"three core inspection disciplines. This month it stands at "
            f"**{prog.fmt(prog.current)}** ({mark_mom} {d_mom} month-over-month, "
            f"{mark_yoy} {d_yoy} year-over-year)."
        )
        lines.append(body)
        lines.append("")
        if fire or elec or struct_:
            lines.append("Broken down by discipline:")
            lines.append("")
            for k in (elec, fire, struct_):
                if k and k.current is not None:
                    d, mark = k.delta_mom()
                    lines.append(f"- **{k.label}** — {k.fmt(k.current)} ({mark} {d} vs prev month)")
            lines.append("")
            lines.append(
                "Structural progress historically lags electrical and fire because "
                "structural retrofits — pillar reinforcement, beam strengthening, "
                "soft-storey conversion — are the most disruptive and capital-"
                "intensive remediations a factory can undertake."
            )
            lines.append("")

    # Recognition / well-remediated
    rec = get("factories_recognition_letter")
    well = get("factories_gt90pct_remediated")
    if rec or well:
        lines.append("## Factories near or at full compliance")
        lines.append("")
        if well and well.current is not None:
            d, mark = well.delta_mom()
            lines.append(
                f"- **{well.fmt(well.current)} factories** have remediated more "
                f"than 90% of their initial findings ({mark} {d} vs prev month). "
                f"These are the suppliers any responsible buyer should treat as a baseline."
            )
        if rec and rec.current is not None:
            d, mark = rec.delta_mom()
            lines.append(
                f"- **{rec.fmt(rec.current)} factories** have received an RSC "
                f"Recognition Letter — confirming 100% closure of initial findings "
                f"({mark} {d} vs prev month). On SourceBD these factories carry "
                f"a verified *Recognition Letter* badge and rank highest in our SBI score."
            )
        lines.append("")

    # Escalation paragraph
    s1, s2, s3 = get("stage_1_factories"), get("stage_2_factories"), get("stage_3_factories")
    if s1 or s2 or s3:
        lines.append("## Escalation: factories the RSC has flagged")
        lines.append("")
        lines.append(
            "The RSC's escalation protocol moves non-cooperating factories through "
            "three stages — from formal warning (Stage 1) to brand notification "
            "(Stage 2) to potential business termination (Stage 3). These factories "
            "are flagged in red on SourceBD and excluded from automated buyer outreach lists."
        )
        lines.append("")
        for k in (s1, s2, s3):
            if k and k.current is not None:
                d, mark = k.delta_mom()
                lines.append(f"- **{k.label}** — {k.fmt(k.current)} factories ({mark} {d} vs prev month)")
        lines.append("")

    # Methodology
    lines.append("## Methodology")
    lines.append("")
    lines.append(
        "All figures in this post are sourced from the RMG Sustainability "
        f"Council's published {label} monthly report and the live data on "
        f"[rsc-bd.org/updates/](https://rsc-bd.org/updates/). SourceBD ingests "
        "and parses these monthly. The full PDF is mirrored on every individual "
        "factory profile in our database, so subscribers can audit any number "
        "we publish back to its primary source. Month-over-month and year-over-"
        "year deltas are computed from our historical store of RSC reports going back to 2022."
    )
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append(
        f"*SourceBD is a B2B intelligence platform for the Bangladesh RMG supply "
        f"chain — used by sourcing, compliance, and ESG teams in the UK, US, EU "
        f"and Canada to discover, vet, and message verified factories. "
        f"[Browse factories](/) · [Smart Search](/search) · [Newsletter signup](/newsletter)*"
    )
    return title, subtitle, "\n".join(lines)


# --------------------------------------------------------------------------- #
# Persistence
# --------------------------------------------------------------------------- #

def _save_draft(kind: str, period: date, title: str, subtitle: str,
                body: str, kpis: Iterable[KpiRow]) -> int:
    metrics_used = [
        {
            "scope": k.scope,
            "metric_key": k.key,
            "current": k.current,
            "prev_month": k.prev_month,
            "prev_year": k.prev_year,
        }
        for k in kpis if k.current is not None
    ]
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """insert into public.content_drafts
                 (kind, period, title, subtitle, body_markdown, metrics_used, status, updated_at)
               values (%s,%s,%s,%s,%s,%s,'draft', now())
               on conflict (kind, period) do update set
                 title         = excluded.title,
                 subtitle      = excluded.subtitle,
                 body_markdown = excluded.body_markdown,
                 metrics_used  = excluded.metrics_used,
                 status        = case
                                   when public.content_drafts.status = 'published'
                                   then public.content_drafts.status
                                   else 'draft' end,
                 updated_at    = now()
               returning id""",
            (kind, period, title, subtitle, body, json.dumps(metrics_used)),
        )
        row = cur.fetchone()
        c.commit()
        return int(row["id"])


def generate(period: date) -> dict[str, int]:
    """Generate both newsletter + blog drafts for `period`. Returns row ids."""
    kpis = collect_kpis(period)
    if not any(k.current is not None for k in kpis):
        log.warn("digest.no_data", period=period.isoformat())
        return {}

    nl_title, nl_sub, nl_body = render_newsletter(period, kpis)
    blog_title, blog_sub, blog_body = render_blog_post(period, kpis)

    nl_id = _save_draft("newsletter_monthly", period, nl_title, nl_sub, nl_body, kpis)
    blog_id = _save_draft("blog_monthly_state_of_rmg", period, blog_title, blog_sub, blog_body, kpis)
    log.info("digest.generated", period=period.isoformat(),
             newsletter_id=nl_id, blog_id=blog_id)
    return {"newsletter_id": nl_id, "blog_id": blog_id}
