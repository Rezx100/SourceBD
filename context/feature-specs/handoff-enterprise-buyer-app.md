# Buyer app enterprise pass — hand-off

Written 28 Sep 2026. Read this, then `git log --oneline -8` on branch
`enterprise-buyer-app`. Everything under "Where it stands" was checked on the
day it was written; re-check any status before you rely on it (AGENTS 16).

## Where it stands

- **Branch** `enterprise-buyer-app`, cut from `development` at `f022a63`. The
  branch was up to date with `development` on 28 Sep.
- **PR #191 (the buyer app enterprise pass)** to `development`:
  https://github.com/Rezx100/SourceBD/pull/191. Auto-merge (squash) is on,
  so GitHub merges it when every required check is green.
- **CI.** The first run failed on lint errors in `components/dashboard/craft.test.ts`,
  which also stopped the build inside the HTTP-boundary check. The lint fix then
  failed the type check. Both are fixed in `395e936`; that run was pending when
  this was written. The full `next build` has not yet completed on this branch,
  so a route-export or type error the build catches is still possible. Read a
  red run with `gh run view <id> --log-failed`.
- **Production.** Untouched. The last Deploy Production ran 27 Sep 12:40,
  before this PR. Migration 0106 is **not applied**: a read-only query on
  28 Sep found none of its tables, columns, functions or its storage bucket.

## What the founder must do, in this order

1. Run the dry run. It is always rolled back and needs no approval. It reads
   `SUPABASE_DB_URL` from `.env`:

   ```
   python ops/dry_run_0106_buyer_workspace.py
   ```

   Paste its output into `ops/plans/0106-dry-run.md` under "Raw output". It
   stops before applying anything if the live `rfq_create`, `rfq_get` or
   `settings_get` differs from the repo's.
2. Apply 0106. The command is in `ops/plans/0106-dry-run.md`; the guard hook
   refuses it for an agent.
3. Only then promote `development` to `main` and approve Deploy Production.

**If step 3 happens before step 2:** RFQs still send, but the buyer's message
and questions are silently dropped. Drafts, the product base, the product
media upload and the Workspace and Inquiry settings show their could-not-read
notes. No guard in the code prevents this order today (see "Open work", item 1).

## What shipped on the branch

Commits `b47fa1c` (foundations), `98116f2` (the pass), `f96a83d` (review
fixes), `c7c9f0c` (RFQ pane), `34f4637` and `395e936` (CI fixes).

- **Search.** The ledger grid is the default view, with the cards as the other
  view. It has sortable sticky headers, three densities (`?d=`, carried on
  every pane link), and the row keys ↑↓ j k ↵ Space r s (modified keys are
  left to the browser).
- **Panes.** One pane beside the list for every secondary screen:
  - on the search: the record, a product line, the composer (`?rfq=`, wide),
    filters (`?filters=1`) and save search (`?save=1`);
  - on the lists: orders and RFQs (`?open=`), saved suppliers (`?open=<slug>`),
    and a record inside a conversation (`?record=`).

  `RecordPane` keys its content by `openKey`, so a new item never keeps the
  last one's state.
- **RFQ composer** (`components/dashboard/rfq-composer.tsx`).
  - It holds the targets, the product, a message from the workspace template
    with its variables, the questions and a live preview.
  - Save draft, Send, and ⌘↵.
  - Add suppliers opens `supplier-picker.tsx` (saved suppliers, a search,
    recent RFQs). The picks are resolved by `GET /api/v1/suppliers`: buyer
    only, published only, no contact column, sanction flagged.
  - Page mode is `/app/rfqs/new?supplier=|product=|draft=`.
- **Product base** at `/app/products`.
  - "Start manually"; "Start with AI" exists only behind the AI flag.
  - The form: Basic, Production, Classification, Media, Variants, Size chart,
    BOM, Tech pack.
  - Send RFQ from a product.
  - Media goes to the `product-media` bucket through `/api/v1/products/media`.
    A save deletes the files the product no longer holds.
- **Settings**: Workspace, Subscription, Members, Inquiry, Profile,
  Notifications. `/app/settings/plan` answers a 308 to Subscription.
- **Supplier side.** `/supplier/rfqs/[id]` shows the buyer's message and
  questions, and so does the buyer's own RFQ pane.
- **Migration** `supabase/migrations/0106_buyer_products_rfq_message_workspace.sql`.
  - It is additive. The new tables are read-only to `authenticated`; every
    write goes through the SECURITY DEFINER functions.
  - The dry run asserts that after applying.
- **Design record**: `DESIGN.md` and `.impeccable/surfaces/app-app-app.md`.
  The critique is `.impeccable/critique/2026-09-27T14-19-11Z__app-app-app.md`,
  and the founder picked G1 ledger, B1 quiet buttons, S1 split pane.

## Open work, most important first

1. **Deploy-order guard (offered, not built).** The app could hide the message,
   the questions, drafts, the product base and the new settings sections until
   the database has 0106. A cheap signal is the `inquiry` key, which
   `settings_get` returns only after 0106. Build it if the founder wants the
   order not to matter.
2. **The supplier still never sees the product.** An RFQ stores `product_id`,
   but `rfq_get` returns no product. So the size chart, BOM, media and tech
   pack of a product-based RFQ reach no supplier; only its title and
   description are copied in. The founder's walkthrough expects "send inquiry
   from a product" to carry the product. This needs an `rfq_get` change (a new
   migration) and a supplier-side section.
3. **The RFQ email and the threads carry no message.** `notifyRfqTargets`
   sends title, quantity and ship-by only, and `rfq_create` opens each thread
   empty. The supplier sees the message only on the RFQ page.
4. **A supplier sees every target of an RFQ.** `rfq_get` returns all targets
   to the supplier side, which names competing suppliers. This predates the
   branch; ask the founder whether that is intended before changing it.
5. **Orphaned uploads.** A file uploaded in the product form and never saved
   stays in the public bucket. Only saved products clean up after themselves.
6. **Not built.** "Start with AI" and AI image generation (V2, behind
   `AI_ENABLED`); Members (the page says it arrives with Enterprise); the
   supplier portal and admin still draw the old shell.
7. **Two h1s** on Saved and on a conversation when a record is open beside
   them. The search lowers its own heading to h2 beside a record; these two
   pages do not yet.
8. **Left as is on purpose.** Close returns focus to the first row that opened
   the pane, not the latest; `record-controls.test.ts` pins it for the
   building-to-company case.
9. **Filed as separate tasks:**
   - the pricing page's "Contact reveal" wording;
   - `/app/messages/[thread]` answering a 200 instead of a 404 under its
     loading state.

   Still open from before: `/api/v1/discover/export` has no rate limit
   (CLAUDE.md).

After the PR merges and 0106 is live, mark the pass complete in
`context/current-state.md` in one line. Move the detail to the archive, as
AGENTS "Workflow per spec" step 4 says.

## How to check your work here

- **Tests.** `pnpm exec tsc -p tsconfig.npm-test.json`, then
  `node --require ./test-stubs/register-node-test-aliases.cjs --experimental-websocket --test <files>`
  on the `.tests-build/**/*.test.js` you touched. Check tsc's **exit code**;
  do not pipe it into `head`. That hid the type error CI caught. The
  address-dedup fixture suite takes about 25 minutes; leave it to CI.
- **Lint.** Run `pnpm exec next lint --max-warnings=0 --file <path>` per file.
  A long generated list of `--file` arguments missed errors in `craft.test.ts`.
- **The files that cover this work:**
  - `app/(app)/app/record-routes.test.ts` (search panes, density, drafts, the
    supplier's view);
  - `app/(app)/app/buyer-pages-routes.test.ts`;
  - `app/api/v1/{suppliers,products,products/media,rfqs,settings}/route.test.ts`;
  - `components/dashboard/{render,craft,links,record-sheet,orders,rfq-pages,products}.test.ts`;
  - `components/product-form-model.test.ts`;
  - `app/dev/ds/dashboard-screens.test.ts`.
- **Screenshots** of the real pages over a fake database. They use the local
  harness, which is gitignored and exists only on the founder's machine:

  ```
  node .impeccable/preview/build-ent.cjs <screen ...>
  node .impeccable/preview/shots-ent.cjs <screen ...>
  ```

  The PNGs go to `.impeccable/review/ent/`. `real-pages.cjs` holds the sample
  data and the list of screens (orders-open, rfqs-open, rfq-new, product-form,
  settings-inquiry, messages-record and others). Rebuild `.tests-build` first.
- **Writing patches from Bash.** A doubled backslash in a heredoc arrives as a
  single one. Use the Edit tool, or `chr(92)` in Python, for any regex.
