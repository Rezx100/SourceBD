// Renders the six buyer dashboard v3.2 screens to one HTML page, through the
// same loader, builders and components `/dev/ds` uses, with the RPCs answered
// from `lib/dashboard/fixtures.ts`. Run by `scripts/gallery/regen.sh`.
//
// This harness never reaches production. The two counts it replays were read
// on 19 Sep 2026 with the queries named beside them, and the fixtures carry
// that day's payloads; nothing here is invented.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DashboardScreens } from "@/app/dev/ds/dashboard-screens";
import { loadGalleryData } from "@/lib/dashboard/gallery-data";
import { aboniInput, arFashionInput, RFQ_ROWS, RFQ_TARGETS, smKnitwearInput, TODAY, zaheenSampleInput } from "@/lib/dashboard/fixtures";

// The compiled copy of this file lives under `.render-build/`, so `__dirname`
// is not the repo root; regen.sh runs from the root and names it explicitly.
const repoRoot = process.env.REPO_ROOT ?? process.cwd();
const outDir = process.env.GALLERY_OUT ?? path.join(repoRoot, "_gallery-out");

export const records: Record<string, ReturnType<typeof aboniInput>> = {
  "aboni-knitwear": aboniInput(),
  "sm-knitwear": smKnitwearInput(),
  "zaheen-knitwear-limited-shed-3-4-5-10-11-12-13-and-building-security-etp-and-fire-pump": zaheenSampleInput(),
  "ar-fashion": arFashionInput(),
};

/**
 * `discover_suppliers('knitted shirts', cert_kinds => {gots}, sort => receipts)`
 * returned total_count 42 on 19 Sep 2026, and the unfiltered page of one
 * returned 10,266 published suppliers. Every row of that page ties on the sort
 * key, so the slugs it returns are not stable between reads; the four named
 * records are the ones this harness can render, and a slug it has no fixture
 * for is dropped rather than invented — the same rule the live loader follows.
 */
const GALLERY_TOTAL = 42;
const PUBLISHED_TOTAL = 10266;

export const fixtureRpc = {
  rpc: async (fn: string, args: Record<string, unknown>) => {
    if (fn === "buyer_supplier_profile") {
      const r = records[String(args.p_slug)];
      return r ? { data: r.profile, error: null } : { data: null, error: { message: "not found" } };
    }
    if (fn === "supplier_epb_hscodes") {
      const r = records[String(args.p_slug)];
      return { data: r ? r.hscodes : [], error: null };
    }
    if (fn === "production_workers_display_batch") {
      const ids = args.p_supplier_ids as string[];
      const out: Record<string, unknown> = {};
      for (const r of Object.values(records)) {
        if (r.workers && ids.includes(r.profile.supplier.id)) {
          out[r.profile.supplier.id] = { value: r.workers.value, source: r.workers.source, fetched_at: r.workers.fetched_at ?? null };
        }
      }
      return { data: out, error: null };
    }
    if (fn === "discover_suppliers") {
      if (args.p_q === null) return { data: [{ slug: Object.keys(records)[0], total_count: PUBLISHED_TOTAL }], error: null };
      return { data: Object.keys(records).map((slug) => ({ slug, total_count: GALLERY_TOTAL })), error: null };
    }
    // `rfq_list` is scoped to `auth.uid()`; these are the seven rows it
    // returns for the buyer who owns them, mirrored in `fixtures.ts`. An
    // empty literal here made the screen state "0 sent · 0 quotes" and
    // "No RFQs for this account yet" about an account that does not exist.
    if (fn === "rfq_list") return { data: RFQ_ROWS, error: null };
    return { data: null, error: { message: `unknown rpc ${fn}` } };
  },
};

async function main(): Promise<void> {
  // The real icon set is ESM only; `phosphor-real.cjs` reads it from here.
  const iconSet = await new Function("p", "return import(p)")(
    path.join(repoRoot, "node_modules/@phosphor-icons/react/dist/ssr/index.es.js"),
  );
  (globalThis as unknown as { __PHOSPHOR__: unknown }).__PHOSPHOR__ = iconSet;

  const data = await loadGalleryData(fixtureRpc as never, TODAY, RFQ_TARGETS);
  console.log(
    JSON.stringify({
      total: data.total,
      published: data.published,
      cards: data.cards.length,
      rows: data.rows.length,
      sheet: data.sheet !== null,
      productSheet: data.productSheet !== null,
      rfqs: data.rfqs.rows.length,
      sent: data.rfqs.sent,
      quotes: data.rfqs.quotes,
      discoverError: data.discoverError,
      rfqError: data.rfqError,
    }),
  );
  if (data.discoverError || data.cards.length !== 4 || data.sheet === null || data.productSheet === null) {
    throw new Error("the gallery data is incomplete — the screens would be rendered from a partial read");
  }

  const body = renderToStaticMarkup(createElement(DashboardScreens, { data }));
  const css = readFileSync(path.join(outDir, "ds.css"), "utf8");
  const fontDir = path.join(repoRoot, "app/fonts");
  const fonts = [
    `@font-face{font-family:Geist;src:url(file://${fontDir}/Geist-Variable.woff2) format("woff2");font-weight:100 900}`,
    `@font-face{font-family:"Geist Mono";src:url(file://${fontDir}/GeistMono-Variable.woff2) format("woff2");font-weight:100 900}`,
    `:root{--font-sans:Geist;--font-mono:"Geist Mono"}`,
  ].join("");
  const withLocalPhotos = body.replace(/src="\/products\//g, `src="file://${path.join(repoRoot, "public/products")}/`);
  const html = `<!doctype html><html lang="en" class="font-sans"><head><meta charset="utf-8"><style>${fonts}${css}</style></head><body><main class="mx-auto space-y-10 px-4 py-8" style="width:1500px">${withLocalPhotos}</main></body></html>`;

  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "gallery.html"), html);
  console.log("gallery.html bytes", html.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
