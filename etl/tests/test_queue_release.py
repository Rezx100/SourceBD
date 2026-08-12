"""Release-queue classifier: buyer destination, not ticket-close-only.

Named counterexamples from production (13 Aug 2026):
- Bori Garment / Bori Garmaent → merge
- Friends Knit Fashion / Fashions → merge
- Mega Knit vs Meghna Knit → keep separate
- M.A. vs N.M. Accessories → keep separate
- Fakir Knitwears (Extension) already attached → close as already_attached
- knit/trims/extension/euro token clusters → keep separate (already on Discover)
- brand-only unmatched → hold_no_register (cannot publish)
- Section Seven with Tier 1–3 → publish
- Liz Fashion Valuka Unit pair → keep separate (buildings, not a merge)
- Azim & Son Unit 1 as named mother → needs_human (building, not company)
"""

from __future__ import annotations

from pathlib import Path

from etl.core.queue_release import (
    classify_brand,
    classify_cluster,
    classify_extension,
    classify_fuzzy,
    classify_queue_row,
    names_are_same_company,
    pick_merge_winner,
    refuse_nested_parent,
)

REPO = Path(__file__).resolve().parents[2]
MIGRATION = REPO / "supabase" / "migrations" / "0102_admin_queue_release.sql"
HUB = REPO / "supabase" / "migrations" / "0062_admin_queue_hub.sql"
DECIDE_ROUTE = REPO / "app" / "api" / "v1" / "admin" / "queue" / "decide" / "route.ts"
DECIDE_BUTTON = REPO / "components" / "admin-queue-decide-button.tsx"


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
    assert "rsc_extension_base_name(parent.company_name)" in sql
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
    brand = sql.split("brand_disclosure_match_review", 1)[1]
    assert "_queue_legal_stem(s.company_name_norm)" in brand
    assert "_queue_legal_stem(brand.company_name_norm)" in brand
    assert "create or replace function public._queue_legal_stem" in sql


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
    assert '"release"' in src
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


def test_review_button_posts_release_not_approve():
    src = DECIDE_BUTTON.read_text(encoding="utf-8")
    assert "Release" in src
    assert "does not change supplier evidence automatically" not in src
    assert 'decide("release")' in src
    assert 'decide("approve")' not in src
    assert "Release sends this to buyers" in src


def test_decide_route_forwards_release_to_rpc():
    src = DECIDE_ROUTE.read_text(encoding="utf-8")
    assert 'rpc("admin_queue_decide"' in src
    assert "p_decision: decision" in src
    assert '"release"' in src
    assert "release|reject|escalate" in src
    assert "approve|release" not in src
    assert "revalidatePath(\"/admin/queue\")" in src
    assert "revalidatePath(\"/discover\")" in src
    assert "revalidatePath(\"/app/discover\")" in src
