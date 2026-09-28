// Click-to-content timings of the buyer app on the LIVE site, in the founder's
// own signed-in Chrome (29 Sep 2026, the dashboard video: "it has to be
// lightning fast"). Read-only: it searches, opens records, a product line and
// the RFQ form, and closes them. It never presses Send.
//
// Chrome must allow remote debugging for this instance first: open
// chrome://inspect/#remote-debugging, tick "Allow remote debugging for this
// browser instance", and click Allow when Chrome asks. Then:
//
//   node ops/measure_app_speed.mjs            (three searches: sweater, denim, knit dress)
//   node ops/measure_app_speed.mjs polo       (one search)
//
// Report and the numbers so far: ops/plans/buyer-app-speed-29sep.md. Playwright
// is the repo's own devDependency; this attaches to the running browser and
// opens one tab, which it closes.

import { chromium } from "playwright";

const SITE = process.env.SITE || "https://sourcebd.net";
const QUERIES = process.argv.slice(2).length ? process.argv.slice(2) : ["sweater", "denim", "knit dress"];

/** Runs `act` in the page and polls `ready` every 4 ms; ms to the first `feedback` and to `ready`, and the URLs it went through. */
const STEP = `(async ({ act, ready, feedback }) => {
  const f = (s) => (s ? new Function("return (" + s + ")") : null);
  const A = f(act), R = f(ready), F = f(feedback);
  const t0 = performance.now();
  let fb = null, last = location.href;
  const urls = [];
  A();
  return await new Promise((res) => {
    const tick = () => {
      const now = performance.now() - t0;
      if (location.href !== last) { last = location.href; urls.push([Math.round(now), location.search]); }
      try { if (fb === null && F && F()) fb = Math.round(now); } catch {}
      let ok = false; try { ok = Boolean(R()); } catch {}
      if (ok || now > 30000) return res({ feedback: fb, content: ok ? Math.round(now) : null, urls });
      setTimeout(tick, 4);
    };
    tick();
  });
})`;

const SKELETON = `document.querySelector('[data-open-key^="loading:"]')`;
const H1 = `(document.querySelector('section[data-record-pane] h1') || {}).textContent`;

async function step(page, act, ready, feedback = null) {
  return page.evaluate(`${STEP}(${JSON.stringify({ act, ready, feedback })})`);
}

async function run(page, q) {
  await page.goto(`${SITE}/app`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const out = { query: q };
  out.search = await step(
    page,
    `(() => { const form = [...document.querySelectorAll('main form')].find((f) => (f.getAttribute('action') || '').includes('/app/discover')); const input = form.querySelector('input[name=q]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(q)}); form.requestSubmit(); })`,
    `location.pathname === '/app/discover' && document.querySelectorAll('tr[data-row="result"]').length > 0`,
    `location.pathname === '/app/discover'`,
  );
  for (const [key, i] of [["record_1", 0], ["record_2", 1]]) {
    await page.waitForTimeout(2500);
    const name = await page.evaluate(`(document.querySelectorAll('tr[data-row="result"] a[data-open="record"]')[${i}] || {}).textContent`);
    if (!name) break;
    out[key] = await step(
      page,
      `(() => document.querySelectorAll('tr[data-row="result"] a[data-open="record"]')[${i}].click())`,
      `${H1} === ${JSON.stringify(name.trim())} && !document.querySelector('[aria-label="Back to the record"]')`,
      SKELETON,
    );
    out[key].name = name.trim();
  }
  await page.waitForTimeout(2500);
  if (await page.evaluate(`Boolean(document.querySelector('section[data-record-pane] a[aria-label^="HS "]'))`)) {
    out.line = await step(
      page,
      `(() => document.querySelector('section[data-record-pane] a[aria-label^="HS "]').click())`,
      `document.querySelector('[aria-label="Back to the record"]')`,
      SKELETON,
    );
    await page.waitForTimeout(2500);
    out.back = await step(page, `(() => document.querySelector('[aria-label="Back to the record"]').click())`, `!document.querySelector('[aria-label="Back to the record"]') && ${H1}`, SKELETON);
  }
  await page.waitForTimeout(2500);
  out.rfq = await step(
    page,
    `(() => [...document.querySelectorAll('section[data-record-pane] a')].find((a) => /Send RFQ/.test(a.textContent)).click())`,
    `document.querySelector('section[aria-label="New RFQ"]')`,
    `document.querySelector('[data-pane-wide]')`,
  );
  await page.waitForTimeout(2500);
  out.close_rfq = await step(page, `(() => document.querySelector('[data-pane-wide] [aria-label="Close"]').click())`, `!document.querySelector('[data-pane-wide]') && ${H1}`);
  return out;
}

const browser = await chromium.connectOverCDP(process.env.CDP || "http://127.0.0.1:9222");
const context = browser.contexts()[0];
const page = await context.newPage();
page.setDefaultTimeout(60000);
try {
  for (const q of QUERIES) {
    const r = await run(page, q);
    console.log(JSON.stringify(r));
  }
} finally {
  await page.close();
  // Not browser.close(): this is the founder's own Chrome. Leaving drops the connection.
  process.exit(0);
}
// A step whose `content` is null did not arrive in 30 s; `urls` empty on a
// record open means the click was dropped (the navigation never committed).
