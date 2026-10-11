// The phone speed pass (11 Oct 2026): the founder asked for page-to-page navigation that is "super
// smooth and fast" and touch that is "super responsive". Each fix below has a guard here, read from
// the source or rendered, so none of them quietly comes back.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Bell, ChatCircleText } from "@phosphor-icons/react";
import { TabBar } from "@/components/kit/phone";
import { sessionUserId } from "@/lib/supabase/session-user";

const src = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const code = (rel: string) => src(rel).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

describe("phone speed pass", () => {
  it("the middleware learns who is signed in from the token, not a round trip per request", () => {
    const mw = code("middleware.ts");
    assert.doesNotMatch(mw, /auth\.getUser\(/);
    assert.match(mw, /sessionUserId\(supabase\)/);
    // Role and suspension are still read from profiles on every gated request.
    assert.match(mw, /from\("profiles"\)\.select\("role, is_suspended"\)/);
  });

  it("sessionUserId takes the id from verified claims, and asks Auth only when the token cannot be checked locally", async () => {
    let asked = 0;
    const getUser = async () => (asked++, { data: { user: { id: "from-auth" } } });
    assert.equal(await sessionUserId({ auth: { getClaims: async () => ({ data: { claims: { sub: "u-1" } }, error: null }), getUser } }), "u-1");
    assert.equal(asked, 0);
    assert.equal(await sessionUserId({ auth: { getClaims: async () => ({ data: null, error: null }), getUser } }), null, "no session is signed out");
    assert.equal(asked, 0);
    assert.equal(await sessionUserId({ auth: { getClaims: async () => ({ data: null, error: new Error("Invalid JWT") }), getUser } }), "from-auth");
    assert.equal(asked, 1);
    assert.equal(await sessionUserId({ auth: { getUser: async () => ({ data: { user: null } }) } }), null);
  });

  it("no page fades in: the buyer app has no template, and its box lives in the layout", () => {
    assert.equal(existsSync(join(process.cwd(), "app/(app)/app/template.tsx")), false);
    assert.match(src("app/(app)/app/layout.tsx"), /<div className="flex min-h-0 flex-1 flex-col">\{children\}<\/div>/);
  });

  it("a tap is a tap: no double-tap wait and no browser grey flash on links and buttons", () => {
    const css = src("app/ds.css");
    assert.match(css, /a,\s*button,\s*\[role="button"\]\s*\{\s*touch-action: manipulation;\s*-webkit-tap-highlight-color: transparent;/);
  });

  it("a pressed tab darkens, and the tab's face can light on the tap (useLinkStatus)", () => {
    const html = renderToStaticMarkup(
      createElement(TabBar, {
        items: [
          { href: "/m", label: "Messages", icon: ChatCircleText, current: true },
          { href: "/a", label: "Alerts", icon: Bell },
        ],
      }),
    );
    assert.equal((html.match(/active:bg-sunken/g) ?? []).length, 2);
    assert.match(src("components/kit/tab-face.tsx"), /useLinkStatus\(\)/);
    assert.match(html, /<a aria-current="page"[^>]*>.*?Messages/);
  });

  it("the JavaScript every page downloads: barrels optimised, analytics and feedback fetched on demand", () => {
    assert.match(src("next.config.ts"), /optimizePackageImports: \["@phosphor-icons\/react", "radix-ui"\]/);
    const ph = code("lib/posthog/provider.tsx");
    assert.doesNotMatch(ph, /^import (?!type )[^;]*from "posthog-js"/m, "posthog-js is imported only as a type");
    assert.match(ph, /import\("posthog-js"\)/);
    assert.match(ph, /useReportWebVitals\(reportVital\)/);
    for (const f of ["components/frame/phone.tsx", "components/frame/topbar.tsx"]) {
      assert.doesNotMatch(code(f), /import \{ FeedbackDialog \} from "\.\/feedback"/, f);
      assert.match(code(f), /dynamic\(\(\) => import\("\.\/feedback"\)/, f);
    }
    assert.match(code("components/record/locations-map.tsx"), /await near;[\s\S]*await import\("bkoi-gl"\)/);
  });
});
