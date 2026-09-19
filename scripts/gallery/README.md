# Gallery evidence harness (REZ-A)

Renders the six buyer dashboard v3.2 screens to HTML and PNG from the fixtures
in `lib/dashboard/fixtures.ts`, through the same builders and components the
`/dev/ds` page uses. It exists so the screenshots in an audit bundle can be
regenerated from a fresh clone at a named commit, by anyone, without a database.

    ./scripts/gallery/regen.sh              # → _gallery-out/
    GALLERY_OUT=/tmp/shots ./scripts/gallery/regen.sh

What it guarantees:

- **It refuses a dirty tree.** The SHA it stamps into `CANDIDATE_SHA` has to be
  the tree that was rendered; a stamp taken over uncommitted edits names a
  commit whose screenshots nobody can reproduce. `--allow-dirty` overrides it
  and stamps `<sha>-dirty`.
- **It fails on a compile error.** The old copy ended the TypeScript build with
  `|| true` and carried on with whatever was in the output directory, so a
  broken render silently reused the previous screenshots.
- **Everything it needs is in the repo.** No `/tmp` config, no absolute paths.

It needs the repo's own dev dependencies (`pnpm install`) and a Chromium for
Playwright. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` when it is not on the default
path.

`render-gallery-fixtures.ts` answers the gallery's RPCs from the fixtures: this
harness never reaches production. The counts it replays (42 matches for the
gallery query, 10,266 published suppliers) were read on 19 Sep 2026 and are
noted in that file beside the query that produced them.
