/**
 * Public factory pages must not read cookies. cookies() / the SSR
 * cookie client force Cache-Control: private, no-store, so crawlers
 * rebuild buyer_supplier_profile on every hit and exhaust the database.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

function src(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

/** Strip comments so a historical note cannot satisfy or fail a guard. */
function executable(rel: string): string {
  return src(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("public profile cache wiring", () => {
  it("public factory page uses the cookie-free cached pack, not the SSR cookie client", () => {
    const page = executable("app/(public)/suppliers/[slug]/page.tsx");
    assert.match(page, /getPublicSupplierProfile/);
    assert.doesNotMatch(page, /createSupabaseServerClient/);
    assert.doesNotMatch(page, /from "next\/headers"/);
    assert.doesNotMatch(page, /cookies\s*\(/);
    assert.match(page, /export const revalidate = 300/);
    assert.match(page, /export const dynamic = "force-static"/);
    assert.doesNotMatch(page, /unstable_noStore/);
    assert.match(page, /ProfileStatementTimeout/);
    assert.doesNotMatch(page, /\/temporarily-slow\?slug=/);
    assert.doesNotMatch(page, /timeout-ui/);
  });

  it("timeout destination is force-dynamic and Retry purges the tag", () => {
    const slow = executable("app/(public)/temporarily-slow/page.tsx");
    assert.match(slow, /Service temporarily slow/);
    assert.match(slow, /action="\/temporarily-slow\/retry"/);
    assert.match(slow, /export const dynamic = "force-dynamic"/);
    assert.doesNotMatch(slow, /force-static/);
    const retry = executable(
      "app/(public)/suppliers/[slug]/retry-profile.ts",
    );
    assert.match(retry, /revalidateTag\(tagSupplier\(slug\)\)/);
    assert.match(retry, /clearPublicProfileTimeoutShed\(slug\)/);
    assert.match(retry, /revalidatePath\(`\/suppliers\/\$\{slug\}`\)/);
    assert.doesNotMatch(retry, /\?retry=1/);
    assert.match(retry, /return "ok"/);
    assert.doesNotMatch(retry, /export async function revalidatePublicProfileTag/);
    assert.doesNotMatch(retry, /use server/);
    function treeHas(dir: string, needle: string): boolean {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name === ".next" || name === ".cache") {
          continue;
        }
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) {
          if (treeHas(p, needle)) return true;
        } else if (
          /\.(ts|tsx|js|mjs)$/.test(name) &&
          !/\.test\.(ts|tsx|js)$/.test(name)
        ) {
          if (readFileSync(p, "utf8").includes(needle)) return true;
        }
      }
      return false;
    }
    assert.equal(treeHas(join(root, "app"), "revalidatePublicProfileTag"), false);
    assert.equal(treeHas(join(root, "lib"), "revalidatePublicProfileTag"), false);
    const retryRoute = executable(
      "app/(public)/temporarily-slow/retry/route.ts",
    );
    assert.match(retryRoute, /sameOrigin/);
    assert.match(retryRoute, /siteOriginFromEnv/);
    assert.match(retryRoute, /retryPublicProfile/);
    assert.match(retryRoute, /NextResponse\.redirect\([\s\S]*,\s*303\)/);
    assert.match(retryRoute, /urlOnSite\(dest\)/);
    assert.doesNotMatch(retryRoute, /new URL\(dest,/);
    assert.equal(
      existsSync(
        join(root, "app/(public)/temporarily-slow/revalidate-tag/route.ts"),
      ),
      false,
    );

    const mw = executable("middleware.ts");
    assert.match(mw, /getCachedPublicSupplierProfile/);
    assert.match(mw, /private, no-store, max-age=0/);
    assert.match(mw, /pathname === "\/" \|\| pathname === "\/temporarily-slow"/);
    assert.match(mw, /function redirectOnSite/);
    assert.match(mw, /urlOnSite/);
    assert.doesNotMatch(mw, /siteOriginFromEnv/);
    const redirectFn = mw.slice(
      mw.indexOf("function redirectOnSite"),
      mw.indexOf("function appPathForMarketing"),
    );
    assert.doesNotMatch(redirectFn, /nextUrl\.clone/);
    assert.doesNotMatch(redirectFn, /new URL\(`\$\{pathname\}/);
    assert.doesNotMatch(mw, /catch \{/);
    assert.doesNotMatch(mw, /retryBypass/);
    assert.doesNotMatch(mw, /retry === ["']1["']/);
    assert.match(src("lib/site-origin.ts"), /https:\/\/sourcebd\.net/);
    assert.match(src("lib/site-origin.ts"), /NEXT_PUBLIC_SITE_URL/);
    assert.match(src("lib/site-origin.ts"), /NEXT_PUBLIC_APP_URL/);
  });

  it("homepage live example uses overview RPCs and may skip a bad first slug", () => {
    const anatomy = executable(
      "components/marketing/home/evidence-anatomy.tsx",
    );
    assert.match(anatomy, /getPublicSupplierOverview/);
    assert.doesNotMatch(anatomy, /createSupabaseServerClient/);
    assert.match(anatomy, /FEATURED_PROFILE_ATTEMPTS = 3/);
    assert.match(anatomy, /if \(pack\.timedOut\) break/);

    const principles = executable(
      "components/marketing/home/operating-principles.tsx",
    );
    assert.match(principles, /getPublicSupplierOverview/);
    assert.doesNotMatch(principles, /createSupabaseServerClient/);
    assert.match(principles, /PRINCIPLE_PROFILE_ATTEMPTS = 3/);
    assert.match(principles, /if \(pack\.timedOut\) break/);
  });

  it("shared pack is tagged, caches profile timeouts as a miss, and does not use untagged force-cache", () => {
    const helper = executable("lib/public-supplier-profile.ts");
    assert.match(helper, /tagSupplier\(slug\)/);
    assert.match(helper, /unstable_cache/);
    assert.match(helper, /timedOutPack/);
    assert.match(helper, /__sourcebdProfileTimeoutShed/);
    assert.match(helper, /clearPublicProfileTimeoutShed/);
    assert.match(helper, /throw new ProfileStatementTimeout\(slug\)/);
    assert.match(helper, /isProfileRpcTimeout\(profile\.error\)/);
    assert.match(helper, /facilityPanelFromRpc/);
    assert.match(helper, /facilityLoadError/);
    assert.match(helper, /isPublicProfileTimeoutPinned/);
    assert.match(helper, /__sourcebdProfileInflight/);
    assert.match(helper, /__sourcebdProfileLoadGen/);
    assert.match(helper, /PROFILE_INFLIGHT_COALESCE_MS = 8_000/);
    assert.doesNotMatch(helper, /__sourcebdProfilePackMemo/);
    assert.doesNotMatch(helper, /getCachedFacilityParentSlug/);
    assert.doesNotMatch(
      helper,
      /isProfileRpcTimeout\(facility\.error\)/,
    );
    assert.doesNotMatch(helper, /isProfileRpcTimeout\(hs\.error\)/);
    assert.match(helper, /hscodesFromRpc\(hs\)/);
    assert.doesNotMatch(helper, /cookies\s*\(/);
    assert.doesNotMatch(helper, /createSupabaseServerClient/);
    assert.doesNotMatch(helper, /cache:\s*"force-cache"/);
    assert.match(helper, /"overview"/);
    assert.match(helper, /fetchFacilityParentSlug\(supabase, slug\)/);
    assert.match(helper, /currentLoadGeneration\(slug\) !== started/);
    const loadFull = helper.slice(
      helper.indexOf("async function loadFullPack"),
      helper.indexOf("export async function getCachedPublicSupplierProfile"),
    );
    const successArm = loadFull.slice(0, loadFull.indexOf("catch"));
    assert.match(successArm, /currentLoadGeneration\(slug\) !== started/);
    assert.match(successArm, /revalidateTag\(tagSupplier\(slug\)\)/);
    assert.match(successArm, /timedOutPack/);
    const loadFn = helper.slice(
      helper.indexOf("async function loadPublicSupplierProfile"),
      helper.indexOf("function cachedPublicSupplierProfile"),
    );
    assert.doesNotMatch(loadFn, /timedOutPack/);
    const overviewFn = helper.slice(helper.indexOf("getPublicSupplierOverview"));
    assert.match(overviewFn, /const started = currentLoadGeneration\(slug\)/);
    assert.match(overviewFn, /currentLoadGeneration\(slug\) !== started/);
    assert.match(overviewFn, /timeoutShed\(\)\.set\(slug/);

    const page = executable("app/(public)/suppliers/[slug]/page.tsx");
    assert.match(page, /pack\.parentSlug|parentSlug,/);
    assert.doesNotMatch(page, /getCachedFacilityParentSlug/);
    assert.match(page, /urlOnSite\(miss\.path\)/);

    const app = executable("app/(app)/app/suppliers/[slug]/page.tsx");
    assert.match(app, /facilityPanelFromRpc/);
    assert.match(app, /err\.name === "ProfileStatementTimeout"/);
  });

  it("admin already purges the supplier tag this cache uses", () => {
    for (const p of [
      "app/api/v1/admin/suppliers/[id]/route.ts",
      "app/api/v1/admin/suppliers/[id]/rescore/route.ts",
      "app/api/v1/admin/suppliers/import/route.ts",
      "app/api/v1/admin/sanctions/decide/route.ts",
      "app/api/v1/admin/certifications/decide/route.ts",
    ]) {
      assert.match(src(p), /revalidateTag\(tagSupplier/);
      assert.match(src(p), /clearPublicProfileTimeoutShed/);
    }
  });
});
