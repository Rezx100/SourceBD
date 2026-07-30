"""Locator and excerpt capture.

A citation is only trustworthy if we can re-check it. That needs two things
beyond the URL:

* a **locator** — where on the document the value was found, so a human can
  find it too (`table.members tr:nth-child(14) td:nth-child(3)`, `pdf:page=7`,
  `json:/items/3/gtb_license_number`);
* an **excerpt** — a short verbatim snippet of the source that contains the
  value, so the verifier can later assert the page still says it.

The excerpt is deliberately *source text*, never our parsed value. Comparing a
parsed value against a re-parse would only prove our parser is consistent;
comparing against the raw snippet proves the publisher still asserts the fact.
"""
from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Iterable

_WS_RE = re.compile(r"\s+")
_TAG_RE = re.compile(r"<[^>]+>")
_SCRIPT_RE = re.compile(r"<(script|style)\b[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
_HTMLISH_RE = re.compile(r"<(?:/?[a-z][a-z0-9]*)(?:\s[^>]*)?>", re.IGNORECASE)
EXCERPT_RADIUS = 90
MAX_EXCERPT = 320
# Minimum context (characters each side of the value) accepted when an excerpt
# no longer matches verbatim. Prevents a bare number being "confirmed" by an
# unrelated occurrence elsewhere on the page.
MIN_ANCHOR_CHARS = 10


def normalise_for_match(text: str | None) -> str:
    """Collapse whitespace and case so trivial re-rendering is not 'drift'.

    Deliberately conservative: it does not strip punctuation or digits, because
    a changed digit in an employee count IS the drift we want to catch.
    """
    if not text:
        return ""
    return _WS_RE.sub(" ", text).strip().casefold()


def strip_tags(html: str | None) -> str:
    if not html:
        return ""
    without_code = _SCRIPT_RE.sub(" ", html)
    return _WS_RE.sub(" ", _TAG_RE.sub(" ", without_code)).strip()


def looks_like_html(text: str | None) -> bool:
    if not text:
        return False
    return bool(_HTMLISH_RE.search(text[:4000]))


def strips_tags_for(content_type: str | None, raw: str | None = None) -> bool:
    """Whether a document of this content type should have its tags stripped.

    HTML carries facts between its tags, so stripping them isolates what the
    page asserts. **XML is the opposite**: sanctions feeds put the payload in
    attributes (`wholeName="ABC Trading Ltd"`, `designationDate="2022-03-15"`),
    so stripping tags would delete every value and leave every claim with a NULL
    excerpt — unverifiable by construction.

    Both the writer and the verifier route through this one function, so an
    excerpt is always re-checked under the same rules that produced it.
    """
    ct = (content_type or "").split(";")[0].strip().lower()
    if ct:
        if "xhtml" in ct or "html" in ct:
            return True
        if "xml" in ct:
            return False
        if ct.startswith("text/") or "json" in ct or "csv" in ct:
            return looks_like_html(raw)
    return looks_like_html(raw)


def document_text(raw: str | None, *, is_html: bool | None = None) -> str:
    """Reduce a document to the visible text a citation should be checked against.

    Excerpts are taken from, and compared against, *text* rather than markup.
    Publishers reflow tags constantly — adding a class, wrapping a `<td>` — and
    none of that changes what the page asserts. Matching on markup would report
    every cosmetic redeploy as a factual change and bury the real ones.
    """
    if not raw:
        return ""
    html = looks_like_html(raw) if is_html is None else is_html
    return strip_tags(raw) if html else _WS_RE.sub(" ", raw).strip()


def value_hash(value: Any) -> str:
    return hashlib.sha256(str(value).encode("utf-8", errors="replace")).hexdigest()


def value_variants(value: Any) -> list[str]:
    """Plausible renderings of a stored value as the source might print it.

    Parsers normalise as they go — `"1,240"` becomes `1240`, a checkbox becomes
    `True` — so the value we store is often not the string on the page. Without
    this, every normalised field would land with a NULL excerpt and be
    permanently unverifiable, which quietly guts the provenance guarantee for
    exactly the numeric fields buyers care about (machines, employees, capacity).

    Ordered most-literal first, so the excerpt we keep is the closest match.
    """
    out: list[str] = []

    def add(candidate: Any) -> None:
        text = str(candidate).strip()
        if text and text not in out:
            out.append(text)

    add(value)

    if isinstance(value, bool):
        add("yes" if value else "no")
        add("true" if value else "false")
    elif isinstance(value, int):
        add(f"{value:,}")
    elif isinstance(value, float):
        if value.is_integer():
            add(int(value))
            add(f"{int(value):,}")
        add(f"{value:,}")
    elif isinstance(value, str):
        bare = value.replace(",", "").replace(" ", "")
        if bare.isdigit():
            add(bare)
            if len(bare) > 3:
                add(f"{int(bare):,}")

    return out


# Pass as `document_text` when a record could not be isolated within a
# multi-record document. Distinct from None, which means "search the whole
# document body": on a page carrying hundreds of records, a page-wide search for
# a shared value like "active" or a repeated worker count can match a *different*
# record and attach it as this one's citation. An unciteable claim is recoverable;
# a claim citing the wrong supplier is not, so we keep the locator and drop the
# excerpt rather than guess.
NO_EXCERPT = ""


def make_excerpt(
    haystack: str | None,
    value: Any,
    radius: int = EXCERPT_RADIUS,
    *,
    is_html: bool | None = None,
) -> str | None:
    """Return a verbatim text window of `haystack` around the first hit for `value`.

    Returns None when the value cannot be located, which is itself meaningful:
    a claim with no excerpt cannot be drift-verified and is recorded as such
    rather than being silently treated as verified. `NO_EXCERPT` forces that
    outcome for every field, for records we could not isolate.
    """
    if haystack is None or value is None or str(value).strip() == "":
        return None

    flat = document_text(haystack, is_html=is_html)
    if not flat:
        return None
    flat_l = flat.casefold()

    for candidate in value_variants(value):
        needle_l = _WS_RE.sub(" ", candidate).casefold()
        idx = flat_l.find(needle_l)
        if idx < 0:
            continue
        start = max(0, idx - radius)
        end = min(len(flat), idx + len(needle_l) + radius)
        snippet = flat[start:end].strip()
        if start > 0:
            snippet = "…" + snippet
        if end < len(flat):
            snippet = snippet + "…"
        return snippet[:MAX_EXCERPT]

    return None


def excerpt_contains(
    excerpt: str | None,
    haystack: str | None,
    value: Any = None,
    *,
    is_html: bool | None = None,
) -> bool:
    """True when the recorded excerpt still appears in the document.

    Matching is layered, and the layers exist for opposite reasons:

    1. Verbatim match on visible text. Handles the overwhelming majority and is
       immune to markup reflow because tags are stripped from both sides.
    2. If that fails and the caller supplies the claimed `value`, fall back to
       the largest window of the excerpt **that still contains the value**. This
       tolerates a row moving or neighbouring content changing while keeping the
       check honest.

    The value anchor in (2) is load-bearing. An unanchored window search will
    happily match a slice of the excerpt that excludes the very number that
    changed, reporting a stale fact as confirmed — the same class of
    silent-success bug as REZ-30. If the value is gone, this returns False.
    """
    if not excerpt:
        return False
    body = normalise_for_match(document_text(haystack, is_html=is_html))
    if not body:
        return False

    core = normalise_for_match(excerpt.strip("… "))
    if not core:
        return False
    if core in body:
        return True

    if value is None or str(value).strip() == "":
        return False

    # Try each rendering the source might use, for the same reason make_excerpt
    # does: the stored value is often normalised (1240 vs "1,240").
    for candidate in value_variants(value):
        needle = normalise_for_match(candidate)
        if not needle or needle not in body:
            continue
        idx = core.find(needle)
        if idx < 0:
            continue

        # Shrink the context around the value until something matches. The value
        # stays inside every candidate window, so a changed value can never pass,
        # and we never drop below MIN_ANCHOR_CHARS of context — a bare "860" must
        # not be confirmed by an unrelated "860" elsewhere on the page.
        end = idx + len(needle)
        for pad in (EXCERPT_RADIUS, 48, 32, 20, MIN_ANCHOR_CHARS):
            lo = max(0, idx - pad)
            hi = min(len(core), end + pad)
            if core[lo:hi] in body:
                return True
    return False


def raw_window(raw: str | None, anchor: str | None, radius: int = 6000) -> str | None:
    """A verbatim slice of `raw` around the first occurrence of `anchor`.

    Feed documents carry hundreds of records in one response, and excerpting a
    single record against the whole document is wrong twice over. It is slow —
    the text is re-normalised once per claim — and, worse, it is unsound: a
    search for `"active"` or `"1,200"` will happily match a *different* record
    and attach that as the citation for this one.

    Narrowing to the record's own neighbourhood fixes both. The result stays a
    literal substring of the document, so excerpts cut from it are still found
    when the verifier re-reads the full response later.
    """
    if not raw or not anchor:
        return None
    idx = raw.find(anchor)
    if idx < 0:
        return None
    return raw[max(0, idx - radius // 4) : idx + len(anchor) + radius]


def json_record_window(
    raw: str | None, anchor: str | None, limit: int = 40_000
) -> str | None:
    """The enclosing JSON object around `anchor`, as a verbatim slice of `raw`.

    Sharper than `raw_window` for JSON feeds, where a fixed radius either clips a
    long record or spills into the next one. Braces are matched without tracking
    string literals — cheap, and self-checked: the slice is returned only if it
    parses as JSON, which is exactly the condition under which the brace
    matching was right. Otherwise this falls back to a fixed window, so the
    result is always a literal substring of the document either way.
    """
    if not raw or not anchor:
        return None
    idx = raw.find(anchor)
    if idx < 0:
        return None

    lo = max(0, idx - limit)
    start = -1
    depth = 0
    for i in range(idx, lo - 1, -1):
        ch = raw[i]
        if ch == "}":
            depth += 1
        elif ch == "{":
            if depth == 0:
                start = i
                break
            depth -= 1
    if start < 0:
        return raw_window(raw, anchor)

    hi = min(len(raw), start + limit)
    depth = 0
    for i in range(start, hi):
        ch = raw[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                candidate = raw[start : i + 1]
                try:
                    json.loads(candidate)
                except ValueError:
                    return raw_window(raw, anchor)
                return candidate
    return raw_window(raw, anchor)


def css_locator(*parts: str) -> str:
    """Join CSS locator fragments."""
    return " ".join(p.strip() for p in parts if p and p.strip())


def row_locator(table: str, row_index: int, column: str | int | None = None) -> str:
    """Locator for a tabular source: `table#members row=14 col=3`."""
    out = f"{table} row={row_index}"
    if column is not None:
        out += f" col={column}"
    return out


def pdf_locator(page: int, hint: str | None = None) -> str:
    out = f"pdf:page={page}"
    if hint:
        out += f" near={hint[:60]}"
    return out


def json_locator(pointer: str) -> str:
    """RFC-6901-style pointer for API transports: `json:/items/3/name`."""
    if not pointer.startswith("/"):
        pointer = "/" + pointer
    return f"json:{pointer}"


def api_locator(field: str) -> str:
    return json_locator(field.replace(".", "/"))


def iter_claimable(
    payload: dict[str, Any], skip: Iterable[str] = ()
) -> list[tuple[str, Any]]:
    """Flatten a scraper payload into (field_key, scalar_value) pairs.

    Only scalars are citable — a nested dict or list has no single excerpt, so
    it is expanded one level (`employees.total`) and otherwise skipped.
    """
    skipset = set(skip)
    out: list[tuple[str, Any]] = []
    for key, value in payload.items():
        if key in skipset or value is None or value == "" or value == []:
            continue
        if isinstance(value, (str, int, float, bool)):
            out.append((key, value))
        elif isinstance(value, dict):
            for sub, subval in value.items():
                if isinstance(subval, (str, int, float, bool)) and subval not in (None, ""):
                    out.append((f"{key}.{sub}", subval))
    return out
