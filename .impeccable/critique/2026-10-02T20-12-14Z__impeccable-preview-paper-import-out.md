---
target: SourceBD desktop screens in Paper
total_score: 17
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 51
target_identity: "file:E:\\SourceBD\\.impeccable\\preview\\paper-import\\out"
timestamp: 2026-10-02T20-12-14Z
slug: impeccable-preview-paper-import-out
---
Method: dual-agent (A: four design reviewers, one per section, in parallel · B: separate detector, measurement and accessibility pass)

# SourceBD desktop screens (Paper file "SourceBD", page "Desktop", 39 artboards at 1440)

Verdict: calmer than the phone and structurally accessible, but not enterprise grade. Numbers disagree on one screen, tables are prototype tables, the quote comparison isn't a comparison, compliance has no "as of" and doesn't rank risk, and the product is built for one person (no roles, security settings, audit log or export). The full merged list is in context/feature-specs/ui-issue-register-oct-2026.md.

## Design health score
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | Read-window provenance and "Still needed" are good; no "as of" in compliance, filters need Apply with no live count, RFQ status contradicts itself |
| 2 | Match system / real world | 2 | Trade terms right; "Its state", "Every filter is a URL", "Discover", "0 d", "Government register" |
| 3 | User control and freedom | 2 | Pane close, back and chips work; Cancel order unguarded; one-click unsave; no draft saving for statements |
| 4 | Consistency and standards | 1 | Two type scales, four selected styles, two form shells, three status vocabularies, back links in three styles |
| 5 | Error prevention | 1 | Unconfirmed legal claims exportable; MOQ above quantity unflagged; Accept looks like a chip; placeholders read as data; brackets sendable |
| 6 | Recognition rather than recall | 2 | Labelled tables mostly; hover-only actions; 18px logos; "+4" unexplained |
| 7 | Flexibility and efficiency | 1 | One sortable column; no bulk bar, column chooser, in-list search or export; Ctrl K only |
| 8 | Aesthetic and minimalist design | 2 | Calm palette; monogram stripe, logo walls, 41 chips per page, 85–95% empty first views on list screens |
| 9 | Error recovery | 2 | "Still needed" good; "The buildings could not be read." a dead end; no error states drawn |
| 10 | Help and documentation | 2 | Good inline definitions on compliance; no legend for logos, chip colours or "d" |
| Total | | 17/40 | Poor |

## Priority issues
1. [P1] Numbers that disagree on the same screen: Sources 8 vs 11 marks vs "11 sources"; two unlabelled worker figures per cell; list 3,314 vs record 3,166; sort label vs Sources order (verify on live; P0 if real). /impeccable clarify
2. [P1] Tables and splits that don't work: four row heights (57–87px), about 10 rows per screen, chips wrapping, one sortable column, no bulk "RFQ these 50", 25 black monograms; fixed 50/50 splits squeezing tables (1,041 in 572; quotes 800 in 563 scrolling sideways); filter panel hides the filtered column, Apply 300px below the fold. /impeccable layout, /impeccable adapt
3. [P1] Quote comparison isn't a comparison: names truncated, valid-until behind the sticky Accept, no vs-target, MOQ 5,000 vs 4,500 unflagged, no-reply supplier missing, Accept a 28px grey button like a status chip. /impeccable harden
4. [P1] Compliance without time, rank or evidence: no "as of" or list version anywhere; hub stacks paperwork above forced-labour exposure; flagged supplier unnamed; MSA download below the fold with 18% of the draft visible in raw markdown; four inputs make six statutory sections (plus the code bugs T-01, T-02). /impeccable harden, /impeccable distill
5. [P1] Built for one person: no invite or roles, no 2FA or sessions, no audit log, no evidence export, Workspace settings is a company-profile form. Product decision D-4. /impeccable shape

## What's working
- Provenance is real and visible: read windows, per-source read dates, records open beside results with the selected row kept.
- Structural accessibility is clean: 0 unnamed controls, 0 unlabelled fields, landmarks, 2px focus ring passing 3:1 (except result rows, A-01), reduced motion honoured.
- Contrast passes everywhere except disabled buttons; the Orders table and the RFQ composer's "Still needed" footer are good patterns.

## Persona red flags
- Power user: one sortable column, no bulk RFQ, no column chooser, about 10 rows per screen, only Ctrl K and Ctrl Enter.
- Keyboard user: result rows hide the focus ring; 364 targets under 24px; 12×12 remove-filter ×.
- UK compliance lead: no "as of"; risk not ranked; MSA download below the fold at 1440×900; .md export; no sign-off trail; RSC called a government register.
- Procurement lead comparing quotes: truncated names, hidden valid-until, no vs-target, MOQ conflict unflagged, casual Accept.
- IT/security reviewer: no 2FA, SSO, sessions or audit; one seat; "Contact support" to add a colleague.

## Minor observations
Two account menus and "10,266" twice; sidebar label 15px mono louder than nav; initials R vs RE; "PO PO-"; no h1 on Filters, no headings on New RFQ, two h1s on two pages; address shown twice with spelling variants (RC-09, founder 3 Oct).

## Questions to consider
What if the desktop home were a "Needs attention" queue? Would a buyer trust a list whose sort contradicts its numbers? What would "RFQ these 50" look like as a first-class action? Should list and record ever split 50/50? What does an auditor need to export, and is it one click?
