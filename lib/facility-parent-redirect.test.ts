import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  FACILITY_PARENT_SLUG_MIGRATION,
  SITEMAP_SOURCE,
  assertFacilityParentRedirectContract,
  facilityParentPath,
  fetchFacilityParentSlug,
  resolveUnpublishedProfileMiss,
} from "./facility-parent-redirect";

describe("resolveUnpublishedProfileMiss", () => {
  it("1. published supplier renders — no redirect", () => {
    assert.deepEqual(
      resolveUnpublishedProfileMiss({
        profileFound: true,
        parentSlug: "babylon-garments-limited",
        routeGroup: "public",
      }),
      { action: "render" },
    );
  });

  it("2. facility slug redirects permanently to parent — public route group", () => {
    assert.deepEqual(
      resolveUnpublishedProfileMiss({
        profileFound: false,
        parentSlug: "babylon-garments-limited",
        routeGroup: "public",
      }),
      {
        action: "redirect",
        path: "/suppliers/babylon-garments-limited",
      },
    );
  });

  it("2b. facility slug redirects permanently to parent — app route group", () => {
    assert.deepEqual(
      resolveUnpublishedProfileMiss({
        profileFound: false,
        parentSlug: "babylon-garments-limited",
        routeGroup: "app",
      }),
      {
        action: "redirect",
        path: "/app/suppliers/babylon-garments-limited",
      },
    );
  });

  it("3. facility whose parent is unpublished 404s (RPC returned null)", () => {
    // SQL returns NULL when p.is_published is false — route sees null parentSlug.
    assert.deepEqual(
      resolveUnpublishedProfileMiss({
        profileFound: false,
        parentSlug: null,
        routeGroup: "public",
      }),
      { action: "not_found" },
    );
  });

  it("4. unpublished non-facility slug still 404s — no redirect", () => {
    // facility_of is null → RPC returns null → same miss path as #3/#5.
    assert.deepEqual(
      resolveUnpublishedProfileMiss({
        profileFound: false,
        parentSlug: null,
        routeGroup: "app",
      }),
      { action: "not_found" },
    );
  });

  it("5. slug that does not exist at all 404s", () => {
    assert.deepEqual(
      resolveUnpublishedProfileMiss({
        profileFound: false,
        parentSlug: null,
        routeGroup: "public",
      }),
      { action: "not_found" },
    );
  });

  it("trims blank parent slugs to not_found", () => {
    assert.deepEqual(
      resolveUnpublishedProfileMiss({
        profileFound: false,
        parentSlug: "   ",
        routeGroup: "public",
      }),
      { action: "not_found" },
    );
  });
});

describe("facilityParentPath", () => {
  it("preserves each route group prefix", () => {
    assert.equal(
      facilityParentPath("public", "silken-sewing-ltd"),
      "/suppliers/silken-sewing-ltd",
    );
    assert.equal(
      facilityParentPath("app", "silken-sewing-ltd"),
      "/app/suppliers/silken-sewing-ltd",
    );
  });
});

describe("fetchFacilityParentSlug", () => {
  it("returns a facility parent slug from the RPC", async () => {
    const supabase = {
      rpc: async () => ({ data: "babylon-garments-limited", error: null }),
    };
    assert.equal(
      await fetchFacilityParentSlug(supabase, "babylon-garments-limited-extension"),
      "babylon-garments-limited",
    );
  });

  it("plain unpublished / missing slug → null (caller 404s)", async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: null }),
    };
    assert.equal(await fetchFacilityParentSlug(supabase, "ghost-slug"), null);
  });

  it("RPC error → null (never leak)", async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: { message: "boom" } }),
    };
    assert.equal(await fetchFacilityParentSlug(supabase, "x"), null);
  });

  it("RPC statement timeout is not a no-mapping 404", async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: { code: "57014" } }),
    };
    await assert.rejects(
      () => fetchFacilityParentSlug(supabase, "x"),
      (err: unknown) =>
        err instanceof Error && err.name === "ProfileStatementTimeout",
    );
  });

  it("timeout-shaped data with error null is not a no-mapping 404", async () => {
    const supabase = {
      rpc: async () => ({
        data: {
          code: "57014",
          message: "canceling statement due to statement timeout",
        },
        error: null,
      }),
    };
    await assert.rejects(
      () => fetchFacilityParentSlug(supabase, "x"),
      (err: unknown) =>
        err instanceof Error && err.name === "ProfileStatementTimeout",
    );
  });

  it("self-parenting row → null (no redirect loop to its own URL)", async () => {
    const supabase = {
      rpc: async () => ({ data: "self-parented-ltd", error: null }),
    };
    assert.equal(await fetchFacilityParentSlug(supabase, "self-parented-ltd"), null);
  });

  it("blank parent slug → null", async () => {
    const supabase = {
      rpc: async () => ({ data: "   ", error: null }),
    };
    assert.equal(await fetchFacilityParentSlug(supabase, "x"), null);
  });
});

describe("assertFacilityParentRedirectContract", () => {
  it("pins migration + sitemap is_published gate", () => {
    // npm test runs from the repo root; compiled __dirname is a cache dir.
    const root = process.cwd();
    const migrationSql = readFileSync(
      join(root, FACILITY_PARENT_SLUG_MIGRATION),
      "utf8",
    );
    const sitemapSource = readFileSync(join(root, SITEMAP_SOURCE), "utf8");
    assertFacilityParentRedirectContract({ migrationSql, sitemapSource });
  });
});
