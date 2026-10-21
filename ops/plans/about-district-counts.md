# The About page's district counts

Script: `ops/about_district_counts.sql` (read-only), run through the Supabase MCP `execute_sql` on project
`stnrfxrxfonwexzcvvpv`. The About page (`components/site/trust.tsx`, `DISTRICTS`) prints these figures and the day;
it never reads them live. To refresh: re-run the script, update `DISTRICTS` and the day on the page, and replace
the table below in place with its date.

The page's earlier figures ("counted 3 Oct 2026": Dhaka 4,421, Gazipur 1,819, Narayanganj 1,628, Chattogram 1,080,
43 more districts 445, not on file 875) had no script beside them; this one replaces them (marketing critique of
22 Oct 2026, S12). The district column has been filled in since then, so "not on file" fell from 875 to 165.

## Read on 21 Oct 2026 (UTC)

| | Published suppliers |
| -- | --: |
| Dhaka (854 with Savar in the address) | 4,651 |
| Gazipur | 1,957 |
| Narayanganj | 1,647 |
| Chattogram | 1,195 |
| 35 more districts, from Mymensingh (130) and Narsingdi (94) down | 433 |
| District not on file | 165 |
| **All published** | **10,048** |

The 35: Mymensingh 130, Narsingdi 94, Cumilla 32, Tangail 32, Manikganj 23, Khulna 16, Pabna 16, Munshiganj 12,
Jashore 10, Habiganj 9, Sirajganj 8, Bogura 5, Rajshahi 5, Bagerhat 4, Faridpur 3, Feni 3, Nilphamari 3, Noakhali 3,
Rangpur 3, Dinajpur 2, Kurigram 2, Kushtia 2, Magura 2, Netrokona 2, Sylhet 2, and one each in Bandarban, Barishal,
Brahmanbaria, Chandpur, Gaibandha, Gopalganj, Madaripur, Rajbari, Rangamati and Sherpur.

What the script folds: the approved lexicon's spellings (Chittagong, CTG; Narayangonj, N.ganj), Savar and Ashulia into
Dhaka, and the official new spellings (Comilla, Jessore, Bogra, Barisal, Narshingdi). Nothing else is merged.
