// B4d proof: the Sites tab as static pages (no script: the map is an empty frame here). Pins are faked from the fixture rows.
// The pane's client controls pick sizes with matchMedia only in B4b; the record uses CSS alone, so a plain render serves every width.
const Module = require("module"), path = require("path"), fs = require("fs");
const root = "E:/SourceBD"; process.env.NEXT_PUBLIC_BARIKOI_API_KEY = "proof";
process.chdir(root);
require(path.join(root, "test-stubs/register-node-test-aliases.cjs"));
{
  const orig = Module._resolveFilename;
  const phosphor = path.join(root, "node_modules/@phosphor-icons/react/dist/ssr/index.es.js");
  Module._resolveFilename = function (request, ...rest) {
    if (request === "@phosphor-icons/react" || request === "@phosphor-icons/react/dist/ssr") return phosphor;
    return orig.call(this, request, ...rest);
  };
  const navId = require.resolve("next/navigation");
  const realNav = require("next/navigation");
  require.cache[navId] = { id: navId, filename: navId, loaded: true, children: [], paths: [], exports: { ...realNav,
    useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
    useSearchParams: () => new URLSearchParams("q=knit"), usePathname: () => "/app/discover" } };
}
const { createElement: h } = require(path.join(root, "node_modules/react"));
const { renderToStaticMarkup } = require(path.join(root, "node_modules/react-dom/server"));
const postcss = require(path.join(root, "node_modules/postcss")), tailwind = require(path.join(root, "node_modules/tailwindcss"));
const B = (p) => require(path.join(root, ".tests-build", p));
const { AppFrame, ListPane } = B("components/frame/index.js");
const { RecordView } = B("components/record/record-view.js");
const { PaneRows } = B("components/search/list.js");
const { PaneListToolbar } = B("components/search/toolbar.js");
const { buildSheet } = B("lib/dashboard/build-models.js");
const fx = B("lib/dashboard/fixtures.js");
const { EMPTY_STATE } = B("lib/discover-v32-state.js");
const account = { initial: "RK", name: "Rezaul Karim", email: "rk@example.invalid" };
const badges = { messages: { text: "2 new" }, compliance: { text: "2 to check", tone: "danger" } };
const counts = { emails: 1, phones: 6, website: true, representatives: 1 };
const sheet = (input, over = {}, pins) => ({ ...buildSheet(input, { pins, supplierId: "id-1", rfqHref: "/app/rfqs/new?supplier=id-1", closeHref: "/app/discover?q=knit", contactCounts: counts }), ...over });
const tabHref = (t) => `#${t}`;
const rec = (m, mode, tab = "overview") => h(RecordView, { model: m, mode, tab, tabHref, today: fx.TODAY, backHref: "/app/discover?q=knit" });
const rows = ["Aboni Knitwear Ltd.", "S M Knitwears Limited", "Modele De Capital Ind Ltd", "Fakir Apparels Ltd"].map((name, i) => ({ slug: `s-${i}`, supplierId: `id-${i}`, name, type: "Factory", place: "Dhaka", workers: "1,000", workersSecond: null, sources: 9 - i, cert: null, paneHref: "#", pageHref: "#", sanctioned: false }));
const state = { ...EMPTY_STATE, q: "knit" };
const hrefFor = () => "#";
const pane = (m, tab) => h(ListPane, { listLabel: "Results", closeHref: "#", paneTitle: "Supplier", list: h("div", { className: "flex min-h-0 flex-1 flex-col" }, h(PaneListToolbar, { state, title: "knit · 4,645 suppliers", hrefFor, filtersHref: "#" }), h("div", { className: "min-h-0 flex-1 overflow-auto" }, h(PaneRows, { rows, currentSlug: "s-0" }))), pane: rec(m, "pane", tab) });
const { locationTargets } = B("lib/dashboard/build-models.js");
const withPins = (input) => sheet(input, {}, locationTargets(input.profile).map((_, i) => (i === 0 ? { latitude: 23.8, longitude: 90.3, confidencePct: 92, addressStatus: "full_address" } : i === 1 ? { latitude: 23.8, longitude: 90.3, confidencePct: 55, addressStatus: "area" } : i === 2 ? { latitude: 23.8, longitude: 90.3, confidencePct: 90, addressStatus: "full_address" } : null)));
const pages = {
  "page-sites": rec(withPins(fx.aboniInput()), "page", "sites"),
  "pane-sites": pane(withPins(fx.aboniInput()), "sites"),
  "page-sites-ar": rec(withPins(fx.arFashionInput()), "page", "sites"),
  "page-overview": rec(sheet(fx.aboniInput()), "page", "overview"),
};(async () => {
  for (const [name, content] of Object.entries(pages)) {
    const html = renderToStaticMarkup(h(AppFrame, { account, badges }, content));
    const { css } = await postcss([tailwind({ ...require(path.join(root, "node_modules/tailwindcss/loadConfig"))(path.resolve("tailwind.config.ts")), content: [{ raw: html.replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"'), extension: "html" }] })])
      .process(fs.readFileSync("app/ds.css", "utf8"), { from: path.resolve("app/ds.css") });
    fs.writeFileSync(`.impeccable/preview/b4d-${name}.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>:root{--font-sans:"IBM Plex Sans";--font-mono:"IBM Plex Mono"}${css}</style></head><body>${html}</body></html>`);
    console.log("wrote", name);
  }
})().catch((e) => { console.error(e); process.exit(1); });
