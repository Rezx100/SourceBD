"""Pins for attach-only EPB mutations: existing companies only, never mint."""

from __future__ import annotations

from ops.epb_attach_apply import (
    FOREIGN_HOST_SLUGS,
    build_mutations,
    fields_for_row,
    mutation_fingerprint,
)


def _snap() -> dict:
    host_ok = {
        "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "slug": "sarada-fashions",
        "company_name": "SARADA FASHIONS LTD.",
        "company_name_norm": "sarada fashions",
        "is_published": True,
        "is_facility": False,
        "has_bkmea": True,
    }
    host_foreign = {
        "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        "slug": "az-apparels",
        "company_name": "AZ APPARELS LTD.",
        "company_name_norm": "az apparels",
        "is_published": True,
        "is_facility": False,
        "has_bkmea": False,
    }
    host_existing = {
        "id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
        "slug": "abir-fashions",
        "company_name": "ABIR FASHIONS",
        "company_name_norm": "abir fashions",
        "is_published": True,
        "is_facility": False,
        "has_bkmea": False,
    }
    return {
        "suppliers": [host_ok, host_foreign, host_existing],
        "epb": [
            {
                "source_ref": "1297",
                "supplier_id": host_existing["id"],
            }
        ],
        "bgmea_ids": [],
        "same_edges": [],
    }


def _live() -> list[dict]:
    return [
        {
            "source_ref": "4083",
            "company_name": "SARADA FASHIONS LIMITED.",
            "slug": "sarada-fashions",
            "norm": "sarada fashions",
            "pass": "category:Knit,(NB)",
            "epb_reg_no": "BD05918",
            "detail_url": "https://edb.epb.gov.bd/exporter/4083/sarada-fashions-limited",
        },
        {
            "source_ref": "1297",
            "company_name": "ABIR FASHIONS",
            "slug": "abir-fashions",
            "norm": "abir fashions",
            "pass": "association:BGMEA",
            "epb_reg_no": "BD05015",
            "detail_url": "https://edb.epb.gov.bd/exporter/1297/abir-fashions",
        },
        {
            "source_ref": "9999",
            "company_name": "NO SUCH COMPANY XYZ",
            "slug": "no-such-company-xyz",
            "norm": "no such company xyz",
            "pass": "category:Knit",
            "epb_reg_no": "BD00000",
            "detail_url": "https://edb.epb.gov.bd/exporter/9999/no-such-company-xyz",
        },
        {
            "source_ref": "7777",
            "company_name": "AZ APPARELS LTD.",
            "slug": "az-apparels",
            "norm": "az apparels",
            "pass": "category:Woven",
            "epb_reg_no": "BD01111",
            "detail_url": "https://edb.epb.gov.bd/exporter/7777/az-apparels-ltd",
        },
    ]


def test_attach_mutations_skip_existing_unmatched_and_foreign_hosts() -> None:
    bundle = build_mutations(_live(), _snap())
    refs = [r["source_ref"] for r in bundle["mutations"]]
    assert refs == ["4083"]
    assert "1297" not in refs
    assert "9999" in bundle["no_match_refs"]
    assert "9999" not in refs
    assert bundle["skipped_foreign_host"][0]["source_ref"] == "7777"
    assert bundle["skipped_foreign_host"][0]["host_slug"] in FOREIGN_HOST_SLUGS
    row = bundle["mutations"][0]
    assert row["supplier_id"] == "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    assert row["fields"]["epb_reg_no"] == "BD05918"
    assert row["fields"]["epb_detail_url"].endswith("/4083/sarada-fashions-limited")
    assert "epb_hscodes" not in row["fields"]


def test_attach_fingerprint_moves_when_a_pair_drops() -> None:
    bundle = build_mutations(_live(), _snap())
    fp = bundle["fingerprint"]
    assert fp == mutation_fingerprint(bundle["mutations"])
    dropped = bundle["mutations"][:-1]
    assert mutation_fingerprint(dropped) != fp


def test_fields_for_row_rejects_homepage_and_wrong_exporter() -> None:
    assert (
        fields_for_row(
            {
                "source_ref": "4083",
                "detail_url": "https://epb.gov.bd/",
            }
        )
        is None
    )
    assert (
        fields_for_row(
            {
                "source_ref": "4083",
                "detail_url": "https://edb.epb.gov.bd/exporter/4821/za-apparels-ltd",
            }
        )
        is None
    )
