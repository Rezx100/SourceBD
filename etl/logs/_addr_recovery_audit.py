"""Quantify how many of the 789 no-address suppliers are recoverable.

Three cohorts:
  A. "(Extension)/(Expansion)" RSC records whose parent factory (same base name)
     exists in our DB with an address.
  B. Non-extension RSC-only records whose exact-norm name matches another
     supplier in our DB that already carries an address.
  C. Remainder — name unknown to all other sources; no Tier 1-3 address
     evidence available anywhere in our DB. These must stay null.
"""
from etl.core.config import settings
import psycopg, re

url = settings.supabase_db_url + ("&" if "?" in settings.supabase_db_url else "?") + "sslmode=require"
c = psycopg.connect(url, prepare_threshold=None, connect_timeout=30)
cur = c.cursor()

# Pull the 789 no-address suppliers with all the bits we need to match.
cur.execute("""
with addr_have as (select distinct supplier_id from public.v_supplier_addresses)
select s.id, s.company_name, s.company_name_norm, s.slug, s.source_tags
from public.suppliers s
left join addr_have ah on ah.supplier_id = s.id
where coalesce(nullif(btrim(s.address_raw),''), null) is null
  and ah.supplier_id is null;
""")
rows = cur.fetchall()
print(f"total no-address suppliers: {len(rows)}")

# Build a lookup map: company_name_norm -> (id, address_raw, has_view_addr, source_tags)
cur.execute("""
with addr_have as (select distinct supplier_id from public.v_supplier_addresses)
select s.id, s.company_name_norm, s.address_raw, (ah.supplier_id is not null) as has_view_addr,
       s.source_tags
from public.suppliers s
left join addr_have ah on ah.supplier_id = s.id;
""")
by_norm = {}
for sid, norm, addr_raw, has_view, tags in cur.fetchall():
    has_addr = (addr_raw is not None and addr_raw.strip()) or has_view
    by_norm.setdefault(norm, []).append((sid, has_addr, tags))

# Helper: strip extension/expansion suffixes to find the parent.
# Patterns observed in RSC data:
#   "Foo Ltd (Extension)"
#   "Foo Ltd. -Extension"
#   "Foo Ltd (Expansion)"
#   "Foo Ltd (Expansion Buildings)"
#   "Foo Ltd (Previously Bar Ltd)"
_EXT_RE = re.compile(
    r"\s*[\(\-]\s*(extension|expansion(?:\s+building[s]?)?)\s*\)?\s*$",
    re.IGNORECASE,
)
_PREV_RE = re.compile(r"\s*\(\s*previously.+?\)\s*$", re.IGNORECASE)

def strip_extension(name: str) -> str | None:
    """Return the base/parent name if `name` carries an extension marker."""
    cleaned = _PREV_RE.sub("", name).strip()
    m = _EXT_RE.search(cleaned)
    if not m:
        return None
    return _EXT_RE.sub("", cleaned).strip()

# We need a normaliser that matches public.suppliers.company_name_norm. We don't
# want to import etl.core.normalize here (would pull in a lot); we'll instead
# look up the parent by exact match on company_name (case-fold) after stripping
# the suffix, then read its company_name_norm via a server query.
ext_candidates = []  # (sid, original_name, base_name_guess)
non_ext = []         # (sid, name, norm)
for sid, name, norm, slug, tags in rows:
    base = strip_extension(name)
    if base and base.lower() != name.lower():
        ext_candidates.append((sid, name, base))
    else:
        non_ext.append((sid, name, norm))

print(f"  cohort A candidates (extension/expansion-suffixed): {len(ext_candidates)}")
print(f"  cohort B/C candidates (no extension suffix):        {len(non_ext)}")

# Cohort A: for each extension candidate, find a parent row by company_name match
if ext_candidates:
    cur.execute("""
    with addr_have as (select distinct supplier_id from public.v_supplier_addresses)
    select s.id, lower(s.company_name) as ln, s.address_raw, (ah.supplier_id is not null) as has_view_addr,
           s.source_tags
    from public.suppliers s
    left join addr_have ah on ah.supplier_id = s.id;
    """)
    by_lower_name = {}
    for sid, ln, addr_raw, has_view, tags in cur.fetchall():
        has_addr = (addr_raw is not None and addr_raw.strip()) or has_view
        by_lower_name.setdefault(ln, []).append((sid, has_addr, tags))

    matched_with_addr = 0
    matched_no_addr = 0
    unmatched = 0
    for sid, name, base in ext_candidates:
        cands = by_lower_name.get(base.lower(), [])
        # exclude self
        cands = [(p_sid, p_has, p_tags) for (p_sid, p_has, p_tags) in cands if p_sid != sid]
        if not cands:
            unmatched += 1
            continue
        if any(p_has for (p_sid, p_has, p_tags) in cands):
            matched_with_addr += 1
        else:
            matched_no_addr += 1

    print()
    print(f"--- Cohort A (extension records) ---")
    print(f"  parent in DB with address       : {matched_with_addr}   (LEGITIMATELY RECOVERABLE)")
    print(f"  parent in DB but parent also no-addr: {matched_no_addr}")
    print(f"  no parent row found in DB       : {unmatched}")

# Cohort B/C: non-extension RSC-only — try exact-norm match against another
# supplier in DB that has an address.
b_count = 0
b_register_tier1to2 = 0
c_count = 0
for sid, name, norm in non_ext:
    twins = [(p_sid, p_has, p_tags) for (p_sid, p_has, p_tags) in by_norm.get(norm, []) if p_sid != sid]
    has_addr_twin = [t for t in twins if t[1]]
    if has_addr_twin:
        b_count += 1
        if any(set(p_tags) & {"BGMEA","BKMEA","BTMA","BGAPMEA","EPB","RJSC"} for (p_sid, p_has, p_tags) in has_addr_twin):
            b_register_tier1to2 += 1
    else:
        c_count += 1

print()
print(f"--- Cohort B/C (non-extension RSC-only) ---")
print(f"  has exact-norm twin WITH address in DB    : {b_count}")
print(f"    of which the twin is a Tier-1/2 register: {b_register_tier1to2}")
print(f"  no exact-norm twin with address anywhere  : {c_count}")

print()
print("--- Cohort C examples (first 10) ---")
i = 0
for sid, name, norm in non_ext:
    twins = [(p_sid, p_has, p_tags) for (p_sid, p_has, p_tags) in by_norm.get(norm, []) if p_sid != sid]
    if not any(t[1] for t in twins):
        print(f"  {name!r}  norm={norm!r}")
        i += 1
        if i >= 10:
            break

c.close()
