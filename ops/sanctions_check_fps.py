"""Quick local check: do the 4 known FPs pass _is_screenable + shared-token guards?"""
from etl.core.normalize import normalize_company_name
from etl.core.sanctions import _is_screenable, _significant_tokens

cases = [
    ("M. S. D. INTERNATIONAL", "M. D. S. IMPORT EXPORT CO., LTD."),
    ("A. M. S KNITWEAR LTD.",  "S M A"),
    ("Pacific Interntional",    "INTERNATIONAL PACIFIC TRADING, INC."),
    ("New Horizon BD Limited",  "NEW HORIZONS TRADING LIMITED"),
    # Positive control: real obvious match
    ("Beximco Pharmaceuticals Ltd", "Beximco Pharmaceuticals"),
    ("Hetian Haolin Hair Accessories Co Ltd", "Hetian Haolin Hair Accessories"),
]

print(f"{'supplier':<45} {'entry':<45} sup_screen ent_screen shared_sig MATCHES")
for sup, ent in cases:
    s_n = normalize_company_name(sup)
    e_n = normalize_company_name(ent)
    s_ok = _is_screenable(s_n)
    e_ok = _is_screenable(e_n)
    shared = _significant_tokens(s_n) & _significant_tokens(e_n)
    matches = s_ok and e_ok and len(shared) >= 2
    print(f"{sup[:43]!r:<45} {ent[:43]!r:<45} "
          f"{s_ok!s:<10} {e_ok!s:<10} {shared!s:<14} {matches}")
    print(f"  norms: sup={s_n!r}  ent={e_n!r}")
