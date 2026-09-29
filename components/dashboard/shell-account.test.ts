// The founder's video of 29 Sep 2026, PR 3 (hand-off
// `context/feature-specs/handoff-dashboard-video-29sep.md`): the shell.
//
//  1. The rail collapses to its icons, and the server draws it the way the
//     buyer left it (a cookie), so it never flashes open.
//  2. The current rail row is a grey tint with a near-black bar, not the green tint and ring.
//  3. The account corner is one menu with the buyer's photo and name,
//     Settings, Subscription and Sign out — on the rail and the topbar.
//  4. The record pane expands to its full page and comes back to the list.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { buildSheet } from "@/lib/dashboard/build-models";
import { aboniInput } from "@/lib/dashboard/fixtures";
import { backToList, RAIL_COOKIE } from "@/lib/dashboard/nav";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";
import { menuShouldClose } from "@/lib/dashboard/menu-dismiss";
import { AccountMenu, accountName } from "./account-menu";
import { AppShell, planLine } from "./app-shell";
import { SupplierSheet } from "./supplier-sheet";

const source = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

const SHELL = {
  sidebar: {
    active: "search",
    counts: { suppliers: 10266, rfqs: 2, saved: 3 },
    recent: [],
    plan: { name: "Free", note: "public beta" },
    account: { initial: "RK", name: "Rezaul Karim", email: "rk@example.invalid", avatarUrl: "https://example.supabase.co/storage/v1/object/public/avatars/rk.png" },
  },
  topbar: { caption: "10,266 published suppliers", initial: "RK" },
};
const shell = (props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(AppShell, { ...SHELL, ...props } as unknown as ComponentProps<typeof AppShell>, "x"));

describe("1. the rail collapses, and the server remembers", () => {
  it("the shell carries the collapsed state the layout read; open, it carries none", () => {
    // Not anchored: React hoists the photo's preload above the root.
    assert.match(shell({ railCollapsed: true }), /<div data-shell="" data-rail="collapsed" class="[^"]*\bgroup\/shell\b/);
    assert.doesNotMatch(shell(), /data-rail=/);
  });

  it("collapsed, the rail keeps every destination's name for a screen reader and on hover", () => {
    const html = shell({ railCollapsed: true });
    const nav = /<nav aria-label="Primary"[\s\S]*?<\/nav>/.exec(html)?.[0] ?? "";
    for (const name of ["Search", "Saved", "RFQs"]) {
      assert.match(nav, new RegExp(`title="${name}"[^>]*>[\\s\\S]*?<span class="md:group-data-\\[rail=collapsed\\]/shell:sr-only">${name}</span>`), name);
    }
    assert.match(html, /aria-label="Expand sidebar"/, "collapsed, the switch offers the way back");
    assert.match(shell(), /aria-label="Collapse sidebar"/);
  });

  it("the layout reads the cookie the toggle writes", () => {
    const layout = source("app/(app)/app/layout.tsx");
    assert.match(layout, /jar\.get\(RAIL_COOKIE\)\?\.value === "collapsed"/);
    assert.match(layout, /railCollapsed=\{railCollapsed\}/);
    assert.match(source("components/dashboard/rail-toggle.tsx"), /\$\{RAIL_COOKIE\}=\$\{next \? "collapsed" : "open"\}/);
    assert.equal(RAIL_COOKIE, "sb_rail");
  });
});

describe("2. the current rail row is a grey tint, with a bar", () => {
  it("no green tint or ring; the bar carries the state", () => {
    const current = /<a [^>]*aria-current="page"[^>]*>/.exec(shell())?.[0] ?? "";
    assert.ok(current, "guard: one row is current");
    assert.match(current, /bg-accent-tint/);
    assert.match(current, /shadow-\[inset_3px_0_0_rgb\(var\(--ds-accent\)\)\]/);
    assert.doesNotMatch(current, /brand/);
  });
});

describe("3. one account menu, with the photo", () => {
  it("the rail and the topbar both open it, with the uploaded photo where the initials were", () => {
    const html = shell();
    assert.equal((html.match(/<div data-menu-panel="" role="group" aria-label="Account"/g) ?? []).length, 2);
    assert.ok((html.match(/<img src="https:\/\/example\.supabase\.co\/[^"]*rk\.png" alt=""/g) ?? []).length >= 4, "the photo on both corners and both menu heads");
    assert.doesNotMatch(html, /aria-label="Account and settings"/, "the topbar is still a bare link to Settings");
  });

  it("the menu names the buyer and holds Settings, Subscription and Sign out", () => {
    const html = renderToStaticMarkup(createElement(AccountMenu, { account: SHELL.sidebar.account, place: "rail" }));
    assert.match(html, /aria-label="Account, Rezaul Karim"/);
    assert.match(html, /href="\/app\/settings"[^>]*>[\s\S]*?Settings</);
    assert.match(html, /href="\/app\/settings\/subscription"[^>]*>[\s\S]*?Subscription</);
    assert.match(html, /<form [^>]*action="\/auth\/sign-out" method="post"><button type="submit" data-menu-item=""[^>]*>[\s\S]*?Sign out</);
  });

  it("the rail's foot is one account row: the photo, the name over the plan, an up-and-down chevron, no separate plan line", () => {
    // Founder's review, 29 Sep 2026: "this sidebar section is still really
    // under done". The whole row is the menu's button, as a workspace switcher.
    const html = shell();
    const foot = html.slice(html.indexOf('data-plan="true"'));
    const summary = /<summary aria-label="Account, Rezaul Karim, Free plan · Beta" title="Rezaul Karim · Free plan · Beta"[^>]*>[\s\S]*?<\/summary>/.exec(foot)?.[0] ?? "";
    assert.ok(summary, "the account row does not name the buyer and the plan, or carry them on hover for the collapsed rail");
    assert.match(summary, /class="[^"]*\bh-12\b[^"]*group-open\/acct:bg-accent-tint/, "the row is not 48px with the grey open state");
    assert.match(summary, /<img [^>]*class="size-8 /, "the photo is not 32px");
    assert.match(summary, /<span data-name="" class="truncate text-sm font-medium text-ink-strong">Rezaul Karim<\/span><span class="truncate text-xs text-ink-subtle">Free plan · Beta<\/span>/);
    assert.match(summary, /<path d="M8 9\.5l4-4 4 4M8 14\.5l4 4 4-4"/, "no up-and-down chevron");
    assert.doesNotMatch(foot.slice(0, foot.indexOf("</aside>")), />public beta</, "the separate plan line is back");
    assert.equal(planLine({ name: "Free", note: "public beta" }), "Free plan · Beta");
    assert.equal(planLine({ name: "Free", note: "public beta" }, false), "Free plan · public beta");
    assert.equal(planLine({ name: "Pro" }), "Pro plan");
  });

  it("with no name, the rail prints the email's name part, not the whole address", () => {
    assert.equal(accountName({ initial: "Z", name: null, email: "zahir@example.invalid" }), "zahir");
    assert.equal(accountName({ initial: null, name: null, email: null }), "Your account");
  });

  it("it closes on Escape and on a press outside it, and a chosen item closes it even when the page does not change", () => {
    const inside = {};
    const menu = (open: boolean) => ({ open, contains: (n: never) => n === (inside as never) });
    assert.equal(menuShouldClose({ key: "Escape" }, menu(true)), true);
    assert.equal(menuShouldClose({ key: "Tab" }, menu(true)), false);
    assert.equal(menuShouldClose({ target: {} }, menu(true)), true, "a press outside");
    assert.equal(menuShouldClose({ target: inside }, menu(true)), false, "a press inside");
    assert.equal(menuShouldClose({ key: "Escape" }, menu(false)), false, "a closed menu");
    const src = source("components/dashboard/account-menu.tsx");
    assert.match(src, /useEffect\(\(\) => \{\s*if \(ref\.current\) ref\.current\.open = false;\s*\}, \[pathname\]\)/, "a navigation leaves the menu open");
    // A chosen item (Settings, while on Settings) closes it through the shell's
    // dismiss, as every tray: `phone.test.ts`.
    // Escape and a press outside are the shell's, for every tray at once.
    assert.match(src, /<details ref=\{ref\} name=\{MENU_NAME\}/);
  });

  it("no photo draws the initials", () => {
    const html = renderToStaticMarkup(createElement(AccountMenu, { account: { initial: "Z", name: null, email: "z@x.invalid" }, place: "topbar" }));
    assert.doesNotMatch(html, /<img/);
    assert.match(html, />Z</);
  });

  it("the shell loader reads the profile's photo and name, and keeps the session's when that read fails", async () => {
    const stub = (settings: unknown) =>
      ({
        rpc: (fn: string) => {
          if (fn === "settings_get") return settings instanceof Error ? Promise.reject(settings) : Promise.resolve({ data: settings });
          return Promise.resolve({ data: fn === "buyer_dashboard" ? null : [], error: null });
        },
        from: () => ({ select: () => Promise.resolve({ count: null }) }),
        auth: { getUser: async () => ({ data: { user: { email: "rk@example.invalid", user_metadata: { full_name: "R K" } } } }) },
      }) as unknown as Parameters<typeof loadBuyerShell>[0];
    const read = await loadBuyerShell(stub({ display_name: "Rezaul Karim", avatar_url: "https://x.supabase.co/a.png" }), "/app", { publishedFrom: stub(null) });
    assert.deepEqual(read.sidebar.account, { initial: "RK", name: "Rezaul Karim", email: "rk@example.invalid", avatarUrl: "https://x.supabase.co/a.png" });
    const failed = await loadBuyerShell(stub(new Error("boom")), "/app", { publishedFrom: stub(null) });
    assert.equal(failed.sidebar.account?.name, "R K");
    assert.equal(failed.sidebar.account?.avatarUrl, null);
    const odd = await loadBuyerShell(stub({ avatar_url: "javascript:alert(1)" }), "/app", { publishedFrom: stub(null) });
    assert.equal(odd.sidebar.account?.avatarUrl, null, "only an https photo is drawn");
  });
});

describe("4. the record expands to its page and comes back", () => {
  const model = buildSheet(aboniInput());
  const back = "/app/discover?q=knit&record=aboni-knitwear-ltd";

  it("the pane's bar links to the full page carrying the list it came from", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: { ...model, closeHref: "/app/discover?q=knit" }, backHref: back }));
    const expand = /<a [^>]*aria-label="Expand to full page"[^>]*>/.exec(html)?.[0] ?? "";
    assert.match(expand, new RegExp(`href="${model.fullHref.replace(/[?]/g, "\\?")}\\?back=%2Fapp%2Fdiscover%3Fq%3Dknit%26record%3Daboni-knitwear-ltd"`));
  });

  it("the full page goes back to that list, and draws no Expand of its own", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: { ...model, closeHref: null }, mode: "page", backHref: back }));
    assert.match(html, /href="\/app\/discover\?q=knit&amp;record=aboni-knitwear-ltd"[^>]*>[\s\S]*?Back to results</);
    assert.doesNotMatch(html, /Expand to full page/);
    const plain = renderToStaticMarkup(createElement(SupplierSheet, { model: { ...model, closeHref: null }, mode: "page" }));
    assert.doesNotMatch(plain, /Back to results/);
  });

  it("only a path inside the buyer app is followed back", () => {
    assert.equal(backToList(back), back);
    assert.equal(backToList([back, "/app/saved"]), back);
    for (const bad of [undefined, "", "https://evil.example/app/x", "//evil.example/app/x", "/\\evil.example", "/login", "/app/\\x", "/app/ x", "javascript:alert(1)"]) {
      assert.equal(backToList(bad), null, String(bad));
    }
    // The page reads it through that guard.
    assert.match(source("app/(app)/app/suppliers/[slug]/page.tsx"), /backHref=\{backToList\(sp\.back\)\}/);
  });
});
