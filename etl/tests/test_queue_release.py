"""Release-queue classifier: buyer destination, not ticket-close-only.

Named counterexamples from production (13 Aug 2026):
- Bori Garment / Bori Garmaent → merge
- Friends Knit Fashion / Fashions → merge
- Mega Knit vs Meghna Knit → keep separate
- M.A. vs N.M. Accessories → keep separate
- Fakir Knitwears (Extension) already attached → close as already_attached
- knit/trims/extension/euro token clusters → keep separate (already on Discover)
- brand-only unmatched → needs_human (cannot publish)
- Section Seven with Tier 1–3 → publish
- Liz Fashion Valuka Unit pair → keep separate (buildings, not a merge)
- Azim & Son Unit 1 as named mother → needs_human (building, not company)
"""

from __future__ import annotations

import re
from pathlib import Path

from etl.core.queue_release import (
    classify_brand,
    classify_cluster,
    classify_extension,
    classify_fuzzy,
    classify_queue_row,
    is_building_shaped_name,
    names_are_legal_form_variants,
    names_are_same_company,
    paren_building_strip,
    pick_merge_winner,
    refuse_nested_parent,
)

REPO = Path(__file__).resolve().parents[2]
MIGRATION = REPO / "supabase" / "migrations" / "0102_admin_queue_release.sql"
HUB = REPO / "supabase" / "migrations" / "0062_admin_queue_hub.sql"
DECIDE_ROUTE = REPO / "app" / "api" / "v1" / "admin" / "queue" / "decide" / "route.ts"
DECIDE_BUTTON = REPO / "components" / "admin-queue-decide-button.tsx"

_SQL = MIGRATION.read_text(encoding="utf-8")
_PAREN_END_SQL = r"\(\s*[^()]*\y(?:unit|building|shed|extension)\y[^()]*\)\s*$"
_DISTINCTIVE = (
    "printing",
    "packaging",
    "dyeing",
    "spinning",
    "weaving",
    "washing",
    "knitting",
    "embroidery",
)
_PACIFIC_MOTHER = {
    "id": "mother",
    "slug": "pacific-jeans",
    "company_name": "Pacific Jeans Ltd.",
    "company_name_norm": "pacific jeans",
}


def _sql_fn(name: str) -> str:
    key = f"create or replace function public.{name}"
    return _SQL.split(key, 1)[1].split("create or replace function", 1)[0]


def sql_paren_building_strip(name: str) -> str | None:
    body = _sql_fn("_queue_paren_building_strip")
    assert _PAREN_END_SQL in body
    assert "'gi'" not in body
    stripped = re.sub(
        r"\(\s*[^()]*\b(?:unit|building|shed|extension)\b[^()]*\)\s*$",
        "",
        name,
        count=1,
        flags=re.I,
    ).strip(" -,")
    if not stripped or stripped.lower() == name.strip().lower():
        return None
    if re.search(r"[()]", stripped):
        return None
    return stripped


def sql_abbrev_name(name: str) -> str | None:
    body = _sql_fn("_queue_abbrev_name")
    assert r"\yindustry\y" in body
    n = name.lower().strip()
    n = re.sub(r"\s*&\s*", " and ", n)
    n = re.sub(r"\binds\.?\b", "industries", n)
    n = re.sub(r"\bind\.?\b", "industries", n)
    n = re.sub(r"\bindus\.?\b", "industries", n)
    n = re.sub(r"\bindustry\b", "industries", n)
    n = re.sub(r"[^a-z0-9\s]+", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    suffix = re.compile(
        r"\s+(ltd|lts|limited|plc|pvt|private|co|company|corp|"
        r"corporation|inc|incorporated|llc|llp)\s*$",
        re.I,
    )
    for _ in range(4):
        nxt = suffix.sub("", n).strip()
        if nxt == n:
            break
        n = nxt
    return n or None


def sql_legal_stem(name: str) -> str:
    n = re.sub(r"[^a-z0-9\s]+", " ", name.lower()).strip()
    n = re.sub(r"\s+", " ", n)
    stop = {"and", "bangladesh", "bd", "co", "company", "limited", "ltd", "plc", "private", "pvt", "the"}
    parts = []
    for tok in n.split():
        if not tok or tok in stop:
            continue
        if len(tok) > 4 and tok.endswith("s"):
            tok = tok[:-1]
        parts.append(tok)
    return "".join(parts)


def sql_legal_form_variants(a: str, b: str) -> bool:
    assert "_queue_abbrev_name" in _sql_fn("_queue_legal_form_variants")
    if not a or not b:
        return False
    if a.strip().lower() == b.strip().lower():
        return True
    for tok in _DISTINCTIVE:
        if bool(re.search(rf"\b{tok}\b", a, re.I)) != bool(
            re.search(rf"\b{tok}\b", b, re.I)
        ):
            return False
    sa = sql_legal_stem(sql_abbrev_name(a) or a.lower())
    sb = sql_legal_stem(sql_abbrev_name(b) or b.lower())
    return len(sa) >= 10 and sa == sb


def sql_distinctive_mismatch(a: str, b: str) -> bool:
    assert "_queue_distinctive_mismatch" in _SQL
    for tok in _DISTINCTIVE:
        if bool(re.search(rf"\b{tok}\b", a, re.I)) != bool(
            re.search(rf"\b{tok}\b", b, re.I)
        ):
            return True
    return False


def sql_brand_facility_action(brand_name: str, mother_name: str) -> str:
    """Review SQL brand-building destination without applying 0102."""
    brand = _sql_fn("admin_queue_release_plan")
    brand = brand.split("if q.queue_type::text = 'brand_disclosure_match_review'", 1)[1]
    assert "_queue_paren_building_strip(public._queue_building_base_name" not in _SQL
    from etl.core.queue_release import queue_building_base_name

    bases = []
    ext = queue_building_base_name(brand_name)
    if ext:
        bases.append(ext)
    stripped = sql_paren_building_strip(brand_name)
    if stripped:
        bases.append(stripped)
    for base in bases:
        if sql_legal_form_variants(mother_name, base) or (
            sql_abbrev_name(base) == sql_abbrev_name(mother_name)
        ):
            return "attach_facility"
    return "needs_human"


def test_typo_and_plural_are_same_company():
    assert names_are_same_company(
        "BORI GARMENT ACCESSORIES CO., LTD.",
        "Bori Garmaent Accessories Co.Ltd",
    )
    assert names_are_same_company(
        "Friends Knit Fashion Ltd.",
        "FRIENDS KNIT FASHIONS LTD",
    )
    assert names_are_same_company(
        "Euro Knitspin Garments Ltd",
        "EURO KNIT SPIN GARMENTS LTD.",
    )
    assert names_are_same_company(
        "Shah Sharifs (R.) Accessories",
        "Shah Sharif's (R.) Accessories",
    )
    assert names_are_same_company(
        "American & Efird (Bangladesh) Ltd.",
        "American & Efried (Bangladesh) Ltd",
    )


def test_different_companies_are_not_same():
    assert not names_are_same_company(
        "Meghna Knit Composite Ltd.",
        "Mega Knit Composite (Pvt.) Ltd.",
    )
    assert not names_are_same_company(
        "M.A. Accessories Industries Ltd.",
        "N. M. Accessories Industry Ltd",
    )
    assert not names_are_same_company(
        "MKM Packaging & Accessories Industries Ltd.",
        "MS Packaging & Accessories Ind",
    )
    assert not names_are_same_company(
        "Sadia Packaging & Accessories",
        "S. D. Packaging & Accessories Ltd",
    )
    assert not names_are_same_company(
        "A. H TEXTILE MILLS LIMITED",
        "H.H. Textile Mills Limited",
    )
    assert not names_are_same_company(
        "Rio Fashion Wear Ltd",
        "Reo Fashion Wears",
    )
    assert not names_are_same_company(
        "PRETOM FASHION WEAR",
        "Pritom Fashion Wears",
    )
    assert not names_are_same_company(
        "SHINE EMBROIDERY LTD",
        "SHINE EMBROIDERY & PRINTING LTD",
    )
    assert not names_are_same_company(
        "Noman Terry Towel Mills Ltd",
        "NOMAN TERRY TOWEL & Y/D MILLS LTD",
    )
    assert not names_are_same_company(
        "Kenpark Bangladesh Apparel (Pvt.) Ltd (K-3)",
        "KenPark Bangladesh Apparel  (Pvt.) Limited (K5)",
    )


def test_fuzzy_merge_moves_certs_onto_register_row():
    plan = classify_fuzzy(
        queue_id="q1",
        cert_id="cert",
        target_id="reg",
        cert_name="BORI GARMENT ACCESSORIES CO., LTD.",
        target_name="Bori Garmaent Accessories Co.Ltd",
        cert_has_rsc=False,
        target_has_rsc=False,
        cert_is_facility=False,
        target_is_facility=False,
    )
    assert plan.action == "merge_into"
    assert plan.winner_id == "cert"
    assert plan.loser_id == "reg"


def test_fuzzy_merge_prefers_side_with_more_register_evidence():
    plan = classify_fuzzy(
        queue_id="q1b",
        cert_id="efird",
        target_id="efried",
        cert_name="American & Efird (Bangladesh) Ltd.",
        target_name="American & Efried (Bangladesh) Ltd",
        cert_has_rsc=False,
        target_has_rsc=False,
        cert_is_facility=False,
        target_is_facility=False,
        cert_tier13=2,
        target_tier13=1,
    )
    assert plan.action == "merge_into"
    assert plan.winner_id == "efird"
    assert plan.loser_id == "efried"


def test_merge_winner_prefers_longer_legal_name_on_a_tie():
    winner, loser = pick_merge_winner(
        cert_id="garment",
        target_id="garmaent",
        cert_name="BORI GARMENT ACCESSORIES CO., LTD.",
        target_name="Bori Garmaent Accessories Co.Ltd",
        cert_tier13=1,
        target_tier13=1,
        cert_records=1,
        target_records=1,
    )
    assert winner == "garment"
    assert loser == "garmaent"


def test_refuse_nested_parent_on_a_building_name():
    assert refuse_nested_parent(None)
    assert refuse_nested_parent({"id": "u", "facility_of": "m", "company_name": "Foo Ltd"})
    assert refuse_nested_parent({"id": "u", "facility_of": None, "company_name": "Azim & Son Unit 1"})
    assert refuse_nested_parent(
        {"id": "u2", "facility_of": None, "company_name": "Mark Fashion Wear (Pvt.) Ltd. (U-2)"}
    )
    assert not refuse_nested_parent(
        {"id": "m", "facility_of": None, "company_name": "Azim & Sons (Pvt.) Ltd."}
    )


def test_fuzzy_valuka_unit_attaches_to_liz_fashion():
    plan = classify_fuzzy(
        queue_id="q1c",
        cert_id="a",
        target_id="b",
        cert_name="Liz Fashion Industry Ltd. (Valuka Unit)",
        target_name="LIZ FASHION INDUSTRY LTD (Valuka Unit)",
        cert_has_rsc=False,
        target_has_rsc=False,
        cert_is_facility=False,
        target_is_facility=False,
        published_matches=[
            {
                "id": "liz",
                "slug": "liz-fashion-industry",
                "company_name": "LIZ FASHION INDUSTRY LIMITED",
                "company_name_norm": "liz fashion industry",
            }
        ],
    )
    assert plan.action == "attach_facility"
    assert plan.parent_id == "liz"
    assert set(plan.member_ids) == {"a", "b"}


def test_u2_paren_is_building_shaped():
    assert is_building_shaped_name("Mark Fashion Wear (Pvt.) Ltd. (U-2)")
    assert not is_building_shaped_name("Mark Fashion Wear (Pvte) Limited")


def test_fuzzy_u2_without_unique_mother_needs_human():
    plan = classify_fuzzy(
        queue_id="a5c7886c-ce38-4bfc-b749-4ccd02ddafa2",
        cert_id="60a14799",
        target_id="0f4dee78",
        cert_name="Mark Fashion Wear (Pvt.) Ltd. (U-2)",
        target_name="Mark Fashion Wear (Pvte) Limited",
        cert_has_rsc=False,
        target_has_rsc=False,
        cert_is_facility=False,
        target_is_facility=False,
        published_matches=[
            {
                "id": "60a14799",
                "slug": "mark-fashion-wear-pvt-ltd-u-2",
                "company_name": "Mark Fashion Wear (Pvt.) Ltd. (U-2)",
                "company_name_norm": "mark fashion wear u 2",
            },
            {
                "id": "0f4dee78",
                "slug": "mark-fashion-wear-pvte-limited",
                "company_name": "Mark Fashion Wear (Pvte) Limited",
                "company_name_norm": "mark fashion wear pvte",
            },
        ],
    )
    assert plan.action == "needs_human"
    assert plan.action != "keep_separate"


def test_fuzzy_u2_attaches_only_the_building_when_mother_found():
    plan = classify_fuzzy(
        queue_id="a5c7886c",
        cert_id="60a14799",
        target_id="0f4dee78",
        cert_name="Mark Fashion Wear (Pvt.) Ltd. (U-2)",
        target_name="Mark Fashion Wear (Pvte) Limited",
        cert_has_rsc=False,
        target_has_rsc=False,
        cert_is_facility=False,
        target_is_facility=False,
        published_matches=[
            {
                "id": "mother",
                "slug": "mark-fashion-wear",
                "company_name": "Mark Fashion Wear (Pvt.) Ltd.",
                "company_name_norm": "mark fashion wear",
            }
        ],
    )
    assert plan.action == "attach_facility"
    assert plan.parent_id == "mother"
    assert plan.member_ids == ("60a14799",)
    assert "0f4dee78" not in plan.member_ids


def test_fuzzy_does_not_attach_printing_sister():
    plan = classify_fuzzy(
        queue_id="shine",
        cert_id="print",
        target_id="unit1",
        cert_name="Shine Embroidery & Printing Ltd",
        target_name="Shine Embroidery Ltd (Unit 1)",
        cert_has_rsc=False,
        target_has_rsc=False,
        cert_is_facility=False,
        target_is_facility=False,
        published_matches=[
            {
                "id": "emb",
                "slug": "shine-embroidery",
                "company_name": "Shine Embroidery Ltd",
                "company_name_norm": "shine embroidery",
            },
            {
                "id": "print",
                "slug": "shine-embroidery-printing",
                "company_name": "Shine Embroidery & Printing Ltd",
                "company_name_norm": "shine embroidery printing",
            },
        ],
    )
    assert plan.action == "attach_facility"
    assert plan.parent_id == "emb"
    assert plan.member_ids == ("unit1",)
    assert "print" not in plan.member_ids


def test_fuzzy_hurricane_member_ids_exclude_mother():
    plan = classify_fuzzy(
        queue_id="ae1935ab-2672-4928-8188-28afc04c7eff",
        cert_id="ed35695c",
        target_id="766d04d7",
        cert_name="Bengal Hurricane Ltd (Printing Unit)",
        target_name="Bengal Hurricane Ltd",
        cert_has_rsc=False,
        target_has_rsc=False,
        cert_is_facility=False,
        target_is_facility=False,
        published_matches=[
            {
                "id": "766d04d7",
                "slug": "bengal-hurricane",
                "company_name": "Bengal Hurricane Ltd",
                "company_name_norm": "bengal hurricane",
            }
        ],
    )
    assert plan.action == "attach_facility"
    assert plan.parent_id == "766d04d7"
    assert plan.member_ids == ("ed35695c",)


def test_fuzzy_trailing_unit_without_mother_needs_human():
    plan = classify_fuzzy(
        queue_id="q1d",
        cert_id="a",
        target_id="b",
        cert_name="Liz Fashion Valuka Unit",
        target_name="Liz Fashion Valuka Unit",
        cert_has_rsc=False,
        target_has_rsc=False,
        cert_is_facility=False,
        target_is_facility=False,
        published_matches=[],
    )
    assert plan.action == "needs_human"


def test_fuzzy_keeps_meghna_and_mega_apart():
    plan = classify_fuzzy(
        queue_id="q2",
        cert_id="a",
        target_id="b",
        cert_name="Meghna Knit Composite Ltd.",
        target_name="Mega Knit Composite (Pvt.) Ltd.",
        cert_has_rsc=False,
        target_has_rsc=False,
        cert_is_facility=False,
        target_is_facility=False,
    )
    assert plan.action == "keep_separate"


def test_fuzzy_never_merges_two_rsc_buildings():
    plan = classify_fuzzy(
        queue_id="q3",
        cert_id="a",
        target_id="b",
        cert_name="Same Name Ltd",
        target_name="Same Name Ltd",
        cert_has_rsc=True,
        target_has_rsc=True,
        cert_is_facility=False,
        target_is_facility=False,
    )
    assert plan.action == "keep_separate"


def test_fuzzy_never_merges_a_facility():
    plan = classify_fuzzy(
        queue_id="q4",
        cert_id="a",
        target_id="b",
        cert_name="Foo Ltd (Extension)",
        target_name="Foo Ltd",
        cert_has_rsc=False,
        target_has_rsc=False,
        cert_is_facility=True,
        target_is_facility=False,
    )
    assert plan.action == "keep_separate"


def test_extension_already_attached_closes_without_retarget():
    plan = classify_extension(
        queue_id="q5",
        parent_id="mother",
        child_id="child",
        parent_published=True,
        child_facility_of="mother",
        child_published=False,
        parent_exists=True,
    )
    assert plan.action == "already_attached"


def test_extension_still_published_attaches_to_mother():
    plan = classify_extension(
        queue_id="q6",
        parent_id="mother",
        child_id="child",
        parent_published=True,
        child_facility_of=None,
        child_published=True,
        parent_exists=True,
    )
    assert plan.action == "attach_facility"
    assert plan.parent_id == "mother"


def test_extension_wrong_parent_needs_human():
    plan = classify_extension(
        queue_id="q7",
        parent_id="named",
        child_id="child",
        parent_published=True,
        child_facility_of="other",
        child_published=False,
        parent_exists=True,
    )
    assert plan.action == "needs_human"


def test_knit_cluster_stays_separate_companies():
    plan = classify_cluster(
        queue_id="q8",
        token="knit",
        members=[
            {"id": "1", "company_name_norm": "knit attire"},
            {"id": "2", "company_name_norm": "knit city"},
            {"id": "3", "company_name_norm": "abc knit dyeing"},
        ],
    )
    assert plan.action == "keep_separate"


def test_extension_building_parent_attaches_to_register_company():
    plan = classify_extension(
        queue_id="q6b",
        parent_id="unit1",
        child_id="ext",
        parent_published=True,
        child_facility_of=None,
        child_published=True,
        parent_exists=True,
        parent_name="Azim & Son Unit 1",
        published_matches=[
            {
                "id": "azim",
                "slug": "azim-and-sons",
                "company_name": "Azim & Sons (Pvt.) Ltd.",
                "company_name_norm": "azim sons",
            }
        ],
    )
    assert plan.action == "attach_facility"
    assert plan.parent_id == "azim"
    assert set(plan.member_ids) == {"ext", "unit1"}


def test_euro_cluster_stays_separate_companies():
    plan = classify_cluster(
        queue_id="q9",
        token="euro",
        members=[
            {"id": "1", "company_name_norm": "euro jeans", "facility_of": None},
            {"id": "2", "company_name_norm": "euro knitwear", "facility_of": None},
            {"id": "3", "company_name_norm": "d.h. euro hi-tech", "facility_of": None},
            {"id": "4", "company_name_norm": "euro centra", "facility_of": None},
        ],
    )
    assert plan.action == "keep_separate"
    assert plan.group_name is None


def test_euro_single_member_stays_separate():
    plan = classify_cluster(
        queue_id="q9b",
        token="euro",
        members=[
            {"id": "1", "company_name_norm": "euro jeans", "facility_of": None},
            {"id": "2", "company_name_norm": "other host company", "facility_of": None},
        ],
    )
    assert plan.action == "keep_separate"


def test_brand_with_tier13_publishes():
    plan = classify_brand(
        queue_id="q10",
        supplier_id="ss",
        company_name="Section Seven Ltd",
        is_published=False,
        is_facility=False,
        facility_of=None,
        tier13_count=1,
        published_matches=[],
    )
    assert plan.action == "publish"


def test_brand_shafipur_unit_attaches_to_liz_fashion():
    plan = classify_brand(
        queue_id="aefbd03e-liz-shafipur",
        supplier_id="30db28d1",
        company_name="Liz Fashion Industry Limited (Shafipur Unit)",
        is_published=False,
        is_facility=False,
        facility_of=None,
        tier13_count=0,
        published_matches=[
            {
                "id": "55c13ea8",
                "slug": "liz-fashion-industry",
                "company_name": "LIZ FASHION INDUSTRY LIMITED",
                "company_name_norm": "liz fashion industries",
            }
        ],
    )
    assert plan.action == "attach_facility"
    assert plan.parent_id == "55c13ea8"
    assert plan.child_id == "30db28d1"
    assert (
        sql_brand_facility_action(
            "Liz Fashion Industry Limited (Shafipur Unit)",
            "LIZ FASHION INDUSTRY LIMITED",
        )
        == "attach_facility"
    )
    assert (
        sql_brand_facility_action(
            "Liz Fashion Industry Limited (Shafipur Unit)",
            "LIZ FASHION INDUSTRIES LIMITED",
        )
        == "attach_facility"
    )


def test_building_extras_are_shaped_and_bare_unit_is_not_a_mother_candidate():
    assert is_building_shaped_name("Shangu Tex Ltd.-2")
    assert is_building_shaped_name("MNR Sweaters Ltd Extension Building")
    assert is_building_shaped_name("Foo Ltd (relocated)")
    assert is_building_shaped_name("Liz Fashion Valuka Unit")
    from etl.core.queue_release import mother_name_candidates

    assert mother_name_candidates("Liz Fashion Valuka Unit") == []
    assert mother_name_candidates("Ananta Unit") == []


def test_fuzzy_two_mothers_across_names_needs_human():
    plan = classify_fuzzy(
        queue_id="two-mothers",
        cert_id="u1",
        target_id="u2",
        cert_name="Northern Apparels Ltd (Unit 1)",
        target_name="Northern Ltd (Unit 2)",
        cert_has_rsc=False,
        target_has_rsc=False,
        cert_is_facility=False,
        target_is_facility=False,
        published_matches=[
            {
                "id": "a",
                "slug": "northern-apparels",
                "company_name": "Northern Apparels Ltd",
                "company_name_norm": "northern apparels",
            },
            {
                "id": "b",
                "slug": "northern",
                "company_name": "Northern Ltd",
                "company_name_norm": "northern",
            },
        ],
    )
    assert plan.action == "needs_human"


def test_sql_brand_and_unique_mother_are_wired():
    sql = MIGRATION.read_text(encoding="utf-8")
    brand = sql.split("if q.queue_type::text = 'brand_disclosure_match_review'", 1)[1]
    brand = brand.split("create or replace function public.admin_queue_decide", 1)[0]
    assert "_queue_brand_name_match" in brand
    assert "_queue_building_base_name(brand.company_name)" in brand
    assert "_queue_paren_building_strip(brand.company_name)" in brand
    assert "_queue_find_mother" not in brand
    assert "_queue_mother_hits" not in brand
    fuzzy = sql.split("fuzzy_match_review", 1)[1].split(
        "brand_disclosure_match_review", 1
    )[0]
    assert "_queue_unique_mother" in fuzzy
    assert "coalesce(v_m1, v_m2)" not in fuzzy
    base_fn = sql.split("create or replace function public._queue_building_base_name", 1)[
        1
    ].split("create or replace function public._queue_paren_building_strip", 1)[0]
    assert r"\yunit([\s-]+[0-9]+)?\s*$" not in base_fn
    assert r"\(\s*[^)]*\y(?:unit|building|shed|extension)\y[^)]*\)" not in base_fn
    assert "relocated" in base_fn
    assert r"\s+extension\s+buildings?" in base_fn
    assert "for i in 1..8 loop" in base_fn
    paren_fn = sql.split(
        "create or replace function public._queue_paren_building_strip", 1
    )[1].split("create or replace function public._queue_mother_hits", 1)[0]
    assert _PAREN_END_SQL in paren_fn
    assert "'gi'" not in paren_fn
    assert "stripped ~ '[()]'" in paren_fn
    hits_fn = sql.split("create or replace function public._queue_mother_hits", 1)[1]
    hits_fn = hits_fn.split("create or replace function public._queue_find_mother", 1)[0]
    assert "_queue_names_same_company" not in hits_fn
    assert "between 0 and 1" in hits_fn
    assert "between 0 and 2" not in hits_fn
    lfv = sql.split("create or replace function public._queue_legal_form_variants", 1)[
        1
    ].split("create or replace function public._queue_distinctive_mismatch", 1)[0]
    assert "_queue_abbrev_name" in lfv
    assert "_queue_paren_building_strip(public._queue_building_base_name" not in sql
    assert "_queue_distinctive_mismatch" in lfv


def test_brand_only_unmatched_stays_hidden():
    plan = classify_brand(
        queue_id="q11",
        supplier_id="ss",
        company_name="Nurunnabi Bamboo Crafts",
        is_published=False,
        is_facility=False,
        facility_of=None,
        tier13_count=0,
        published_matches=[],
    )
    assert plan.action == "needs_human"


def test_brand_exact_match_attaches_to_published_company():
    plan = classify_brand(
        queue_id="q12",
        supplier_id="hidden",
        company_name="Hop Lun Apparel Limited",
        is_published=False,
        is_facility=False,
        facility_of=None,
        tier13_count=0,
        published_matches=[
            {
                "id": "live",
                "slug": "hop-lun-apparel",
                "company_name_norm": "hop lun apparel",
            }
        ],
    )
    assert plan.action == "attach_brand"
    assert plan.winner_id == "live"
    assert plan.loser_id == "hidden"


def test_brand_limited_ltd_twin_attaches_to_published_company():
    plan = classify_brand(
        queue_id="q12b",
        supplier_id="hidden",
        company_name="Shafipur Unit Limited",
        is_published=False,
        is_facility=False,
        facility_of=None,
        tier13_count=0,
        published_matches=[
            {
                "id": "live",
                "slug": "shafipur-unit",
                "company_name": "Shafipur Unit Ltd",
                "company_name_norm": "shafipur unit",
            }
        ],
    )
    assert plan.action == "attach_brand"
    assert plan.winner_id == "live"
    assert plan.loser_id == "hidden"


def test_brand_unit_attaches_as_facility():
    plan = classify_brand(
        queue_id="q13",
        supplier_id="unit",
        company_name="Alif Embroidery Village Ltd. Unit-2",
        is_published=False,
        is_facility=False,
        facility_of=None,
        tier13_count=0,
        published_matches=[
            {
                "id": "mother",
                "slug": "alif-embroidery-village",
                "company_name": "Alif Embroidery Village Ltd.",
                "company_name_norm": "alif embroidery village",
            }
        ],
    )
    assert plan.action == "attach_facility"
    assert plan.parent_id == "mother"


def test_brand_sister_concern_is_not_attached_as_facility():
    plan = classify_brand(
        queue_id="q13b",
        supplier_id="sister",
        company_name="Jinnat Apparels & Fashion Ltd",
        is_published=False,
        is_facility=False,
        facility_of=None,
        tier13_count=0,
        published_matches=[
            {
                "id": "mother",
                "slug": "jinnat-apparels",
                "company_name_norm": "jinnat apparels",
            }
        ],
    )
    assert plan.action == "needs_human"


def test_brand_does_not_attach_printing_sister_or_other_building():
    printing = classify_brand(
        queue_id="q13c",
        supplier_id="print",
        company_name="SHINE EMBROIDERY & PRINTING LTD",
        is_published=False,
        is_facility=False,
        facility_of=None,
        tier13_count=0,
        published_matches=[
            {
                "id": "emb",
                "slug": "shine-embroidery",
                "company_name": "SHINE EMBROIDERY LTD",
                "company_name_norm": "shine embroidery",
            }
        ],
    )
    assert printing.action == "needs_human"

    k5 = classify_brand(
        queue_id="q13d",
        supplier_id="k5",
        company_name="KenPark Bangladesh Apparel  (Pvt.) Limited (K5)",
        is_published=False,
        is_facility=False,
        facility_of=None,
        tier13_count=0,
        published_matches=[
            {
                "id": "k3",
                "slug": "kenpark-k3",
                "company_name": "Kenpark Bangladesh Apparel (Pvt.) Ltd (K-3)",
                "company_name_norm": "kenpark bangladesh apparel k 3",
            }
        ],
    )
    assert k5.action == "needs_human"


def test_brand_kenpark_unit_2_does_not_attach_to_k3():
    plan = classify_brand(
        queue_id="5d17c2ce-2a0a-4615-8a8a-c3c5c4707505",
        supplier_id="dd738823",
        company_name="Kenpark Bangladesh Apparel Pvt. Ltd. (Unit 2)",
        is_published=False,
        is_facility=False,
        facility_of=None,
        tier13_count=0,
        published_matches=[
            {
                "id": "89652ef0",
                "slug": "kenpark-k3",
                "company_name": "Kenpark Bangladesh Apparel (Pvt.) Ltd (K-3)",
                "company_name_norm": "kenpark bangladesh apparel pvt ltd k 3",
            }
        ],
    )
    assert plan.action == "needs_human"


def test_brand_ckl_unit_does_not_attach_to_cmt_sister():
    plan = classify_brand(
        queue_id="33cbb2d5-5fe8-4a3f-a27f-0e269e99632e",
        supplier_id="04742eea",
        company_name="Consumer Knitex Limited (Ckl) – Unit 01",
        is_published=False,
        is_facility=False,
        facility_of=None,
        tier13_count=0,
        published_matches=[
            {
                "id": "3e8db214",
                "slug": "consumer-knitex-cmt",
                "company_name": "Consumer Knitex Limited (CMT Bangladesh)",
                "company_name_norm": "consumer knitex cmt bangladesh",
            }
        ],
    )
    assert plan.action == "needs_human"


def test_brand_industry_vs_industries_is_legal_form():
    assert names_are_legal_form_variants(
        "Liz Fashion Industry Limited",
        "LIZ FASHION INDUSTRIES LIMITED",
    )
    assert sql_legal_form_variants(
        "Liz Fashion Industry Limited",
        "LIZ FASHION INDUSTRIES LIMITED",
    )


def test_brand_washing_unit_then_unit_2_needs_human():
    names = (
        "Pacific Jeans Ltd. (Washing Unit) Unit-2",
        "Pacific Jeans Ltd. (Washing Unit) (Unit-2)",
        "Pacific Jeans Ltd. (Washing Unit) (Unit 2)",
        "Pacific Jeans Ltd. (Washing Unit) (Building 5)",
        "Pacific Jeans Ltd. (Building 5) Unit-2",
        "Pacific Jeans Ltd. (Building 5) (Unit-2)",
        "Pacific Jeans Ltd. (Unit (Building 5))",
        "Pacific Jeans Ltd. (Knit Unit) Unit-2",
    )
    for company_name in names:
        plan = classify_brand(
            queue_id="pacific-fold",
            supplier_id="child",
            company_name=company_name,
            is_published=False,
            is_facility=False,
            facility_of=None,
            tier13_count=0,
            published_matches=[_PACIFIC_MOTHER],
        )
        assert plan.action == "needs_human", company_name
        assert sql_brand_facility_action(company_name, "Pacific Jeans Ltd.") == (
            "needs_human"
        ), company_name
        stripped = paren_building_strip(company_name)
        if stripped:
            assert stripped != "Pacific Jeans Ltd.", company_name
        sql_stripped = sql_paren_building_strip(company_name)
        if sql_stripped:
            assert sql_stripped != "Pacific Jeans Ltd.", company_name


def test_fuzzy_kenpark_unit_2_does_not_attach_to_k3():
    plan = classify_fuzzy(
        queue_id="5d17c2ce-2a0a-4615-8a8a-c3c5c4707505",
        cert_id="dd738823",
        target_id="89652ef0",
        cert_name="Kenpark Bangladesh Apparel Pvt. Ltd. (Unit 2)",
        target_name="Kenpark Bangladesh Apparel (Pvt.) Ltd (K-3)",
        cert_has_rsc=False,
        target_has_rsc=False,
        cert_is_facility=False,
        target_is_facility=False,
        published_matches=[
            {
                "id": "89652ef0",
                "slug": "kenpark-k3",
                "company_name": "Kenpark Bangladesh Apparel (Pvt.) Ltd (K-3)",
                "company_name_norm": "kenpark bangladesh apparel pvt ltd k 3",
            }
        ],
    )
    assert plan.action == "needs_human"


def test_fuzzy_ckl_unit_does_not_attach_to_cmt_sister():
    plan = classify_fuzzy(
        queue_id="33cbb2d5-5fe8-4a3f-a27f-0e269e99632e",
        cert_id="04742eea",
        target_id="3e8db214",
        cert_name="Consumer Knitex Limited (Ckl) – Unit 01",
        target_name="Consumer Knitex Limited (CMT Bangladesh)",
        cert_has_rsc=False,
        target_has_rsc=False,
        cert_is_facility=False,
        target_is_facility=False,
        published_matches=[
            {
                "id": "3e8db214",
                "slug": "consumer-knitex-cmt",
                "company_name": "Consumer Knitex Limited (CMT Bangladesh)",
                "company_name_norm": "consumer knitex cmt bangladesh",
            }
        ],
    )
    assert plan.action == "needs_human"


def test_fuzzy_missing_supplier_needs_human():
    plan = classify_queue_row(
        queue_id="q14b",
        queue_type="fuzzy_match_review",
        source_data={
            "cert_supplier_id": "gone",
            "target_supplier_id": "live",
            "cert_supplier_name": "Bori Garment Accessories Co. Ltd",
            "target_supplier_name": "Bori Garmaent Accessories Co.Ltd",
        },
        supplier_a_id="gone",
        cert={},
        target={"id": "live", "company_name": "Bori Garmaent Accessories Co.Ltd"},
    )
    assert plan.action == "needs_human"


def test_queue_row_routes_extension_rule():
    plan = classify_queue_row(
        queue_id="q14",
        queue_type="group_parent_review",
        source_data={
            "rule": "rsc_extension_rollup_v1",
            "parent_supplier_id": "p",
            "extension_supplier_id": "c",
        },
        supplier_a_id="c",
        child={"id": "c", "is_published": True, "facility_of": None},
        parent={"id": "p", "is_published": True},
    )
    assert plan.action == "attach_facility"


def test_queue_row_building_parent_needs_human():
    plan = classify_queue_row(
        queue_id="q14c",
        queue_type="group_parent_review",
        source_data={
            "rule": "rsc_extension_rollup_v1",
            "parent_supplier_id": "unit1",
            "extension_supplier_id": "ext",
        },
        supplier_a_id="ext",
        child={"id": "ext", "is_published": True, "facility_of": None},
        parent={
            "id": "unit1",
            "is_published": True,
            "company_name": "Azim & Son Unit 1",
        },
    )
    assert plan.action == "needs_human"


def test_migration_decide_mutates_suppliers_not_only_the_ticket():
    sql = MIGRATION.read_text(encoding="utf-8")
    assert MIGRATION.name.startswith("0102_")
    assert not (REPO / "supabase" / "migrations" / "0101_admin_queue_release.sql").exists()
    assert (REPO / "supabase" / "migrations" / "0101_rez115_bgmea_register_identity.sql").exists()
    assert "create or replace function public.admin_queue_decide" in sql
    assert "set facility_of" in sql
    assert "is_published = true" in sql
    assert "classified buyer-facing mutation" in sql.lower()
    assert "update public.rsc_remediation" in sql
    assert "update public.compliance_documents" in sql
    assert "w.doc_type = d.doc_type" in sql
    assert "w.sha256 = d.sha256" in sql
    assert "_queue_is_building_shaped(parent.company_name)" in sql
    assert "_queue_is_building_shaped" in sql
    assert r"\(\s*u[\s-]*[0-9]+\s*\)+" in sql
    assert "_queue_unique_mother" in sql
    assert "coalesce(v_m1, v_m2)" not in sql
    assert "relocated" in sql
    assert r"\s+extension\s+buildings?" in sql
    assert "jsonb_build_array(v_cert_id, v_target_id)" not in sql
    assert "v_cert_tier13 > v_target_tier13" in sql
    assert "Building-shaped names need a register mother" in sql
    assert "Named mother is itself a building" in sql
    assert "_queue_find_mother" in sql
    assert "\\yknitting\\y" in sql
    assert "\\yembroidery\\y" in sql
    cluster = sql.split("cluster_token", 1)[1].split("fuzzy_match_review", 1)[0]
    assert "'action', 'label_group'" not in cluster
    assert "'action', 'keep_separate'" in cluster
    assert "refuse nested facility" in sql
    assert "[^a-z0-9\\s]+" in sql
    assert "grant execute on function public.admin_queue_release_plan" not in sql
    body = sql.rsplit("create or replace function public.admin_queue_decide", 1)[1]
    assert "update public.suppliers" in body
    assert "perform public._queue_absorb_supplier" in body
    assert "update public.source_records" in sql
    assert "update public.verification_queue" in body
    assert "elsif v_action = 'label_group'" not in body
    assert "if v_decision = 'release'" in body
    assert "member_ids" in body
    brand = sql.split("if q.queue_type::text = 'brand_disclosure_match_review'", 1)[1]
    brand = brand.split("create or replace function public.admin_queue_decide", 1)[0]
    assert "_queue_is_building_shaped(brand.company_name)" in brand
    assert "_queue_brand_name_match" in brand
    assert "_queue_building_base_name(brand.company_name)" in brand
    assert "_queue_paren_building_strip(brand.company_name)" in brand
    assert "_queue_find_mother" not in brand
    assert "_queue_mother_hits" not in brand
    assert "_queue_names_same_company(s.company_name, brand.company_name)" not in brand
    assert "create or replace function public._queue_legal_stem" in sql
    assert "create or replace function public._queue_abbrev_name" in sql
    lfv = sql.split("create or replace function public._queue_legal_form_variants", 1)[
        1
    ].split("create or replace function public._queue_distinctive_mismatch", 1)[0]
    assert "_queue_abbrev_name" in lfv


def test_unmigrated_decide_rejects_release():
    sql = HUB.read_text(encoding="utf-8")
    body = sql.rsplit("create or replace function public.admin_queue_decide", 1)[1]
    allowed = body.split("v_decision not in", 1)[1].split("then", 1)[0]
    assert "'release'" not in allowed
    assert "'approve'" in allowed
    assert "set facility_of" not in body
    assert "_queue_absorb_supplier" not in body


def test_decide_route_still_calls_admin_queue_decide():
    src = DECIDE_ROUTE.read_text(encoding="utf-8")
    assert 'rpc("admin_queue_decide"' in src
    assert "revalidatePath(\"/admin/queue\")" in src
    assert "revalidatePath(\"/discover\")" in src
    assert "queueDecideFromRequest" in src
    assert "status: response.status," in src
    assert "approve|release" not in src


def test_ops_script_is_dry_run_by_default():
    src = (REPO / "ops" / "release_review_queue.py").read_text(encoding="utf-8")
    assert "Dry-run by default" in src
    assert "--expect-fingerprint" in src
    assert "FINGERPRINT MISMATCH" in src
    assert "rsc_remediation" in src
    assert "compliance_documents" in src
    assert "sys.path.insert" in src
    assert "doc_type" in src
    assert "refuse_nested_parent" in src


def test_http_approve_is_rejected():
    src = DECIDE_ROUTE.read_text(encoding="utf-8")
    assert "queueDecideFromRequest" in src
    assert "status: response.status," in src
    helper = (REPO / "lib" / "admin" / "queue-decide-decision.ts").read_text(
        encoding="utf-8"
    )
    assert "queueDecideFromRequest" in helper
    assert "Response.json(result.json, { status: result.status })" in helper
    route_test = DECIDE_ROUTE.with_name("route.test.ts").read_text(encoding="utf-8")
    assert 'import { POST } from "./route"' in route_test
    assert 'decision: "approve"' in route_test
    assert 'decision: "release"' in route_test
    assert "res.status, 400" in route_test
    assert "res.status, 200" in route_test
    assert "rpcCalls.length, 0" in route_test
    assert "admin_queue_decide" in route_test


def test_sql_absorb_skips_unique_source_collision():
    sql = MIGRATION.read_text(encoding="utf-8")
    absorb = sql.split("create or replace function public._queue_absorb_supplier", 1)[1]
    assert "and not exists" in absorb
    assert "w.source_ref is not distinct from sr.source_ref" in absorb
    assert "w.doc_type = d.doc_type" in absorb
    assert "w.sha256 = d.sha256" in absorb


def test_sql_nested_refuse_uses_building_shaped():
    sql = MIGRATION.read_text(encoding="utf-8")
    body = sql.rsplit("create or replace function public.admin_queue_decide", 1)[1]
    refuse = body.split("refuse nested facility", 1)[0]
    assert "_queue_is_building_shaped(p.company_name)" in refuse
    assert "rsc_extension_base_name(p.company_name)" not in refuse


def test_review_button_posts_release_not_approve():
    src = DECIDE_BUTTON.read_text(encoding="utf-8")
    assert "Release" in src
    assert "does not change supplier evidence automatically" not in src
    assert 'decide("release")' in src
    assert 'decide("approve")' not in src
    assert 'type Decision = "approve"' not in src
    assert "Release sends this to buyers" in src


def test_decide_route_forwards_release_to_rpc():
    src = DECIDE_ROUTE.read_text(encoding="utf-8")
    helper = (REPO / "lib" / "admin" / "queue-decide-decision.ts").read_text(
        encoding="utf-8"
    )
    assert 'rpc("admin_queue_decide"' in src
    assert "p_decision: decision" in helper
    assert "queueDecideFromRequest" in src
    assert "status: response.status," in src
    assert "approve|release" not in src
    assert "approve|release" not in helper
    assert "revalidatePath(\"/admin/queue\")" in src
    assert "revalidatePath(\"/discover\")" in src
    assert "revalidatePath(\"/app/discover\")" in src
