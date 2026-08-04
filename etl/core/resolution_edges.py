"""Live resolution_edges helpers for the matcher and ops (REZ-64 / A4).

`resolution_edges` holds sticky human rulings: `same` (always one company) and
`different` (never the same). The matcher only consumes live `same` edges for
canonical rewrite; live `different` edges are enforced in merge / audit /
split-detector ops paths, where both supplier ids are known.

Performance: `_find_existing` runs once per scraped record (~2,800 in a BKMEA
run). The live edge set is loaded once per process into
`_SAME_EDGE_INDEX` — do not query `resolution_edges` per matching pass.
Staleness window: one scraper/process run. Edges written mid-run (ops
scripts) are invisible until the next process starts or
`clear_live_same_edge_cache()` is called.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

from etl.core.logging import get_logger

log = get_logger("etl.resolution_edges")

LIVE_EDGES_SQL = """
select e.supplier_a::text as supplier_a,
       e.supplier_b::text as supplier_b,
       e.verdict,
       e.rationale,
       a.is_published as a_published,
       b.is_published as b_published
  from public.resolution_edges e
  join public.suppliers a on a.id = e.supplier_a
  join public.suppliers b on b.id = e.supplier_b
 where e.superseded_at is null
"""

# Process-local index: supplier_id -> live `same` edges touching that id.
# None = not yet loaded this run. See module docstring for staleness.
_SAME_EDGE_INDEX: dict[str, list["LiveEdge"]] | None = None


@dataclass(frozen=True)
class LiveEdge:
    supplier_a: str
    supplier_b: str
    verdict: str
    rationale: str
    a_published: bool
    b_published: bool

    def other(self, sid: str) -> str:
        if sid == self.supplier_a:
            return self.supplier_b
        return self.supplier_a

    def published_for(self, sid: str) -> bool:
        if sid == self.supplier_a:
            return self.a_published
        return self.b_published


def pair_key(a: str, b: str) -> tuple[str, str]:
    """Order-independent pair key (matches resolution_edges CHECK a < b)."""
    return (a, b) if a < b else (b, a)


def clear_live_same_edge_cache() -> None:
    """Drop the process-local same-edge index (tests / new scraper run)."""
    global _SAME_EDGE_INDEX
    _SAME_EDGE_INDEX = None


def load_live_edges(cur) -> list[LiveEdge]:
    """All live (non-superseded) edges with publish flags for both sides."""
    cur.execute(LIVE_EDGES_SQL)
    out: list[LiveEdge] = []
    for r in cur.fetchall():
        out.append(
            LiveEdge(
                supplier_a=str(r["supplier_a"]),
                supplier_b=str(r["supplier_b"]),
                verdict=r["verdict"],
                rationale=r["rationale"],
                a_published=bool(r["a_published"]),
                b_published=bool(r["b_published"]),
            )
        )
    return out


def load_different_pair_rationales(cur) -> dict[tuple[str, str], str]:
    """Live `different` edges as {(supplier_a, supplier_b): rationale}."""
    return {
        (e.supplier_a, e.supplier_b): e.rationale
        for e in load_live_edges(cur)
        if e.verdict == "different"
    }


def different_rationale(
    different_pairs: Mapping[tuple[str, str], str], a: str, b: str
) -> str | None:
    """Rationale if (a, b) has a live `different` ruling, else None."""
    return different_pairs.get(pair_key(a, b))


def _index_same_edges(edges: list[LiveEdge]) -> dict[str, list[LiveEdge]]:
    index: dict[str, list[LiveEdge]] = {}
    for e in edges:
        if e.verdict != "same":
            continue
        index.setdefault(e.supplier_a, []).append(e)
        index.setdefault(e.supplier_b, []).append(e)
    return index


def ensure_same_edge_index(cur) -> dict[str, list[LiveEdge]]:
    """Load live `same` edges once per process; return the supplier index."""
    global _SAME_EDGE_INDEX
    if _SAME_EDGE_INDEX is None:
        # Staleness window: remainder of this process/run (see module docstring).
        _SAME_EDGE_INDEX = _index_same_edges(load_live_edges(cur))
    return _SAME_EDGE_INDEX


def apply_same_edge_canonical(cur, candidate_id: str) -> str:
    """If candidate has a live `same` edge, return the published survivor.

    Canonical is whichever side of the edge still exists and is published.
    If both sides are published that is a data error: log loudly and return
    ``candidate_id`` unmodified — never silently pick one.
    """
    edges = ensure_same_edge_index(cur).get(candidate_id)
    if not edges:
        return candidate_id

    for edge in edges:
        other = edge.other(candidate_id)
        cand_pub = edge.published_for(candidate_id)
        other_pub = edge.published_for(other)
        if cand_pub and other_pub:
            log.error(
                "resolution.same_edge_both_published",
                candidate=candidate_id,
                other=other,
                supplier_a=edge.supplier_a,
                supplier_b=edge.supplier_b,
            )
            return candidate_id
        if other_pub and not cand_pub:
            log.info(
                "resolution.same_edge_canonical",
                from_id=candidate_id,
                to_id=other,
            )
            return other
    return candidate_id
