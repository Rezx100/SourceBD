"""C4: stop a run that would change too much (spec-etl-freshness §4.6, §8.3).

Founder decision 1 (6 Oct 2026): a run stops for a human when it would change
more than 5% of its source's rows, remove more than 2%, or create more than 20
companies. Records are written one transaction each, so a run cannot be rolled
back at the end; instead every record is classified *before* it is written and
the run stops at the first record that would cross a limit. What landed is at
most the limit the founder allowed; the rest waits for
`run <code> --accept-changes`.

Removals are counted by the reconcile paths that mark rows no longer listed
(sanctions today, certificates in S2); they call `over_removal_limit`.
"""
from __future__ import annotations

from dataclasses import dataclass, field

CHANGED_SHARE = 0.05
CHANGED_FLOOR = 5      # a 40-row source may change 5 rows without a stop
REMOVED_SHARE = 0.02
REMOVED_FLOOR = 3
MAX_CREATED = 20


# A complete read must see at least this share of the rows listed before it, or
# it is treated as partial (a layout change or a truncated download, never a
# mass removal).
COMPLETE_SHARE = 0.9


def over_removal_limit(*, removed: int, listed_before: int) -> bool:
    # ponytail: the floor of 3 keeps a 75-row list (US WRO) from holding on a
    # single genuine removal; revisit if a list grows past ~10k.
    return removed > max(REMOVED_FLOOR, REMOVED_SHARE * listed_before)


def plan_reconcile(
    *, read_complete: bool, listed_before: int, seen: int, missing: int, accept: bool = False
) -> str:
    """What to do with rows a run did not see (sanctions S1, certificates S2).

    'partial'   — do nothing; the read date does not advance.
    'held'      — the read counts, but the removals wait for a human.
    'reconcile' — mark the missing rows no longer listed.
    """
    if not read_complete:
        return "partial"
    if accept:
        return "reconcile"
    if seen < COMPLETE_SHARE * listed_before:
        return "partial"
    if over_removal_limit(removed=missing, listed_before=listed_before):
        return "held"
    return "reconcile"


@dataclass
class Breaker:
    """Counts one run's writes against the limits. Pure; no I/O."""

    stored: int                 # the source's rows before the run
    accept: bool = False        # founder's --accept-changes
    changed: int = 0
    created: int = 0
    held: int = 0
    tripped: str | None = None
    counts: dict[str, int] = field(default_factory=dict)

    @property
    def changed_limit(self) -> int:
        return int(max(CHANGED_FLOOR, CHANGED_SHARE * self.stored))

    def admit(self, kind: str) -> bool:
        """May a record of this kind be written? Once tripped, nothing is.

        kind: 'unchanged' | 'changed' | 'attach' | 'create' | 'hold' | 'wait'
        | 'skip'. A new source row attached to a known company counts as a
        change; a held record changes nothing on screen.
        """
        self.counts[kind] = self.counts.get(kind, 0) + 1
        if self.tripped:
            return False
        if self.accept:
            return True
        if kind in ("changed", "attach") and self.changed + 1 > self.changed_limit:
            self.tripped = (f"more than {self.changed_limit} of {self.stored} rows "
                            f"would change ({CHANGED_SHARE:.0%} limit)")
            return False
        if kind == "create" and self.created + 1 > MAX_CREATED:
            self.tripped = f"more than {MAX_CREATED} new companies"
            return False
        if kind in ("changed", "attach"):
            self.changed += 1
        elif kind == "create":
            self.created += 1
        return True

    def summary(self) -> dict:
        return {
            "tripped": self.tripped,
            "stored": self.stored,
            "changed": self.changed,
            "created": self.created,
            "changed_limit": self.changed_limit,
            "created_limit": MAX_CREATED,
            "accepted": self.accept,
            "seen_by_kind": dict(self.counts),
        }
