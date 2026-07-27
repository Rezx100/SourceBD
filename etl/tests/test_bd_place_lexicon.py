"""Unit tests for `etl.lib.bd_place_lexicon` — all approved pairs + negatives.

Mirrors `lib/bd-place-lexicon.test.ts` (REZ-28).
"""
from __future__ import annotations

import pytest

from etl.lib.bd_place_lexicon import apply_place_lexicon


def lex(s: str) -> str:
    return apply_place_lexicon(s.lower())


# ---- A1–A2 new pairs ----

def test_valuka_to_bhaluka():
    assert lex("valuka") == "bhaluka"


def test_bhaluka_stays():
    assert lex("bhaluka") == "bhaluka"


def test_jamairdia_to_jamirdia():
    assert lex("jamairdia") == "jamirdia"


def test_jamirdia_stays():
    assert lex("jamirdia") == "jamirdia"


def test_full_address_valuka_bhaluka():
    assert lex("jamirdia, valuka, mymensingh") == "jamirdia, bhaluka, mymensingh"


# ---- B series ----

def test_chittagong_to_chattogram():
    assert lex("chittagong") == "chattogram"


def test_ctg_to_chattogram():
    assert lex("ctg") == "chattogram"


def test_dacca_to_dhaka():
    assert lex("dacca") == "dhaka"


def test_bayzid_to_baizid():
    assert lex("bayzid") == "baizid"


def test_dhanmandi_to_dhanmondi():
    assert lex("dhanmandi") == "dhanmondi"


def test_narayangonj():
    assert lex("narayangonj") == "narayanganj"


def test_n_dot_ganj():
    assert lex("n.ganj") == "narayanganj"


def test_n_space_ganj():
    assert lex("n ganj") == "narayanganj"


def test_siddirgonj():
    assert lex("siddirgonj") == "siddhirganj"


def test_siddhirgonj():
    assert lex("siddhirgonj") == "siddhirganj"


def test_maymashingo():
    assert lex("maymashingo") == "mymensingh"


def test_maymanshingh():
    assert lex("maymanshingh") == "mymensingh"


def test_mymensing():
    assert lex("mymensing") == "mymensingh"


# ---- C1 district corrections ----

def test_kishorganj():
    assert lex("kishorganj") == "kishoreganj"


def test_manikgonj():
    assert lex("manikgonj") == "manikganj"


def test_munshigonj():
    assert lex("munshigonj") == "munshiganj"


def test_narshingdi():
    assert lex("narshingdi") == "narsingdi"


def test_comilla():
    assert lex("comilla") == "cumilla"


def test_coxs_bazar():
    assert lex("coxs bazar") == "cox's bazar"


def test_cox_bazar():
    assert lex("cox bazar") == "cox's bazar"


def test_coxs_bazar_canonical():
    assert lex("cox's bazar") == "cox's bazar"


def test_khagrachari():
    assert lex("khagrachari") == "khagrachhari"


def test_laxmipur():
    assert lex("laxmipur") == "lakshmipur"


def test_bogra():
    assert lex("bogra") == "bogura"


def test_jaipurhat():
    assert lex("jaipurhat") == "joypurhat"


def test_chapai_nawabganj():
    assert lex("chapai nawabganj") == "chapainawabganj"


def test_sirajgonj():
    assert lex("sirajgonj") == "sirajganj"


def test_jessore():
    assert lex("jessore") == "jashore"


def test_jhenidah():
    assert lex("jhenidah") == "jhenaidah"


def test_barisal():
    assert lex("barisal") == "barishal"


def test_jhalokathi():
    assert lex("jhalokathi") == "jhalokati"


def test_habigonj():
    assert lex("habigonj") == "habiganj"


def test_moulavibazar():
    assert lex("moulavibazar") == "moulvibazar"


def test_sunamgonj():
    assert lex("sunamgonj") == "sunamganj"


def test_panchagar():
    assert lex("panchagar") == "panchagarh"


def test_netrakona():
    assert lex("netrakona") == "netrokona"


def test_b_dot_baria():
    assert lex("b.baria") == "brahmanbaria"


def test_b_space_baria():
    assert lex("b baria") == "brahmanbaria"


def test_b_dot_space_baria():
    assert lex("b. baria") == "brahmanbaria"


# ---- C2 locality / EPZ aliases ----

def test_kaliakoir():
    assert lex("kaliakoir") == "kaliakair"


def test_rupgonj():
    assert lex("rupgonj") == "rupganj"


def test_sitakundu():
    assert lex("sitakundu") == "sitakunda"


def test_mirsharai():
    assert lex("mirsharai") == "mirsarai"


def test_asadgonj():
    assert lex("asadgonj") == "asadganj"


def test_keraneganj():
    assert lex("keraneganj") == "keraniganj"


def test_depz_to_savar():
    assert lex("depz") == "savar"


def test_aepz_to_adamjee_epz():
    assert lex("aepz") == "adamjee epz"


def test_adamjee_to_adamjee_epz():
    assert lex("adamjee") == "adamjee epz"


def test_adamjee_epz_no_double():
    assert lex("adamjee epz") == "adamjee epz"


def test_cepz_to_chattogram_epz():
    assert lex("cepz") == "chattogram epz"


def test_kepz_to_karnaphuli_epz():
    assert lex("kepz") == "karnaphuli epz"


def test_karnaphuli_to_karnaphuli_epz():
    assert lex("karnaphuli") == "karnaphuli epz"


def test_karnaphuli_epz_no_double():
    assert lex("karnaphuli epz") == "karnaphuli epz"


def test_korean_epz():
    assert lex("korean epz") == "karnaphuli epz"


def test_korean_export_processing_zone():
    assert lex("korean export processing zone") == "karnaphuli epz"


def test_mepz_to_mongla_epz():
    assert lex("mepz") == "mongla epz"


def test_mongla_to_mongla_epz():
    assert lex("mongla") == "mongla epz"


def test_mongla_epz_no_double():
    assert lex("mongla epz") == "mongla epz"


def test_iepz_to_ishwardi_epz():
    assert lex("iepz") == "ishwardi epz"


def test_uepz_to_uttara_epz():
    assert lex("uepz") == "uttara epz"


def test_ccepz_to_cumilla_epz():
    assert lex("ccepz") == "cumilla epz"


def test_dhour_to_turag():
    assert lex("dhour") == "turag"


def test_banasree_to_rampura():
    assert lex("banasree") == "rampura"


def test_bsmrau_to_salna():
    assert lex("bsmrau") == "salna"


def test_national_university_to_board_bazar():
    assert lex("national university") == "board bazar"


# ---- D negatives ----

def test_sreepur_stays():
    assert lex("sreepur") == "sreepur"


def test_sripur_stays():
    assert lex("sripur") == "sripur"


def test_bare_nawabganj_not_chapainawabganj():
    assert lex("nawabganj") == "nawabganj"


def test_chapainawabganj_stays():
    assert lex("chapainawabganj") == "chapainawabganj"
