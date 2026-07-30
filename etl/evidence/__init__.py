"""Per-field provenance for the SourceBD data moat.

Every stored fact is citable to a URL that we have checked is live and still
contains that fact. See `supabase/migrations/0084_evidence_provenance.sql` for
the schema and `context/architecture.md` -> Provenance / evidence for the rules.
"""
from __future__ import annotations

from etl.evidence.locate import (
    api_locator,
    css_locator,
    document_text,
    excerpt_contains,
    iter_claimable,
    json_locator,
    looks_like_html,
    make_excerpt,
    normalise_for_match,
    pdf_locator,
    row_locator,
    strip_tags,
    value_hash,
    value_variants,
)
from etl.evidence.snapshot import SnapshotUrls, bunny_configured, mirror
from etl.evidence.writer import (
    record,
    record_claims,
    record_document,
    reset_document_cache,
    supersede_claims,
)

__all__ = [
    "SnapshotUrls",
    "api_locator",
    "bunny_configured",
    "css_locator",
    "document_text",
    "excerpt_contains",
    "iter_claimable",
    "json_locator",
    "looks_like_html",
    "make_excerpt",
    "mirror",
    "normalise_for_match",
    "pdf_locator",
    "record",
    "record_claims",
    "record_document",
    "reset_document_cache",
    "row_locator",
    "strip_tags",
    "supersede_claims",
    "value_hash",
    "value_variants",
]
