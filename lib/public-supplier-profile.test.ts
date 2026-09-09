import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { revalidateTag } from "next/cache";

import { tagSupplier } from "./cache/tags";

import {
  clearPublicProfileTimeoutShed,
  facilityPanelFromRpc,
  getCachedPublicSupplierProfile,
  getPublicSupplierOverview,
  isProfileRpcTimeout,
  isPublicProfileTimeoutPinned,
  isPublicSupplierSlug,
  ProfileStatementTimeout,
} from "./public-supplier-profile";

describe("isProfileRpcTimeout", () => {
  it("treats Postgres 57014 as a timeout", () => {
    assert.equal(isProfileRpcTimeout({ code: "57014" }), true);
  });

  it("treats PostgREST timeout wording as a timeout", () => {
    assert.equal(
      isProfileRpcTimeout({
        message: "canceling statement due to statement timeout",
      }),
      true,
    );
  });

  it("does not treat a missing row as a timeout", () => {
    assert.equal(isProfileRpcTimeout(null), false);
    assert.equal(isProfileRpcTimeout({ code: "PGRST116" }), false);
    assert.equal(isProfileRpcTimeout({ message: "JSON object requested" }), false);
  });
});

describe("ProfileStatementTimeout", () => {
  it("names the slug that timed out", () => {
    const err = new ProfileStatementTimeout("knit-bazaar");
    assert.equal(err.slug, "knit-bazaar");
    assert.equal(err.name, "ProfileStatementTimeout");
  });
});

describe("facilityPanelFromRpc", () => {
  it("marks any panel RPC error as a load error, not an empty panel", () => {
    assert.deepEqual(
      facilityPanelFromRpc({ data: { facilities: [] }, error: { code: "57014" } }),
      { facilityRaw: null, facilityLoadError: true },
    );
    assert.deepEqual(
      facilityPanelFromRpc({
        data: { code: "57014", message: "canceling statement due to statement timeout" },
        error: null,
      }),
      { facilityRaw: null, facilityLoadError: true },
    );
    assert.deepEqual(
      facilityPanelFromRpc({ data: { facilities: [{ name: "A" }] }, error: null }),
      { facilityRaw: { facilities: [{ name: "A" }] }, facilityLoadError: false },
    );
    assert.deepEqual(
      facilityPanelFromRpc({ data: null, error: null }),
      { facilityRaw: null, facilityLoadError: false },
    );
  });
});

describe("timeout pin vs revalidateTag", () => {
  it("survives revalidateTag until clearPublicProfileTimeoutShed", () => {
    const g = globalThis as typeof globalThis & {
      __sourcebdProfileTimeoutShed?: Map<string, unknown>;
    };
    const pin = {
      until: Date.now() + 60_000,
      pack: {
        timedOut: true,
        data: null,
        parentSlug: null,
        facilityRaw: null,
        facilityLoadError: false,
        epbHs: { hscodes: [], loadError: false },
      },
    };
    g.__sourcebdProfileTimeoutShed = new Map([["knit-bazaar", pin]]);
    revalidateTag(tagSupplier("knit-bazaar"));
    assert.equal(isPublicProfileTimeoutPinned("knit-bazaar"), true);
    clearPublicProfileTimeoutShed("knit-bazaar");
    assert.equal(isPublicProfileTimeoutPinned("knit-bazaar"), false);
  });
});

describe("success inflight vs revalidateTag", () => {
  it("survives revalidateTag until clearPublicProfileTimeoutShed", async () => {
    const g = globalThis as typeof globalThis & {
      __sourcebdProfileInflight?: Map<string, Promise<unknown>>;
    };
    const pack = {
      timedOut: false,
      data: { supplier: { company_name: "Old Inflight Ltd" } },
      parentSlug: null,
      facilityRaw: null,
      facilityLoadError: false,
      epbHs: { hscodes: [], loadError: false },
    };
    g.__sourcebdProfileInflight = new Map([
      ["full:knit-bazaar", Promise.resolve(pack)],
    ]);
    revalidateTag("supplier-knit-bazaar");
    const got = await getCachedPublicSupplierProfile("knit-bazaar");
    assert.equal(
      (got.data as { supplier: { company_name: string } }).supplier
        .company_name,
      "Old Inflight Ltd",
    );
    clearPublicProfileTimeoutShed("knit-bazaar");
    assert.equal(g.__sourcebdProfileInflight?.has("full:knit-bazaar"), false);
  });
});

describe("isPublicSupplierSlug", () => {
  it("accepts published-style slugs and rejects junk", () => {
    assert.equal(isPublicSupplierSlug("knit-bazaar"), true);
    assert.equal(isPublicSupplierSlug("profile-statement-timeout"), true);
    assert.equal(isPublicSupplierSlug(""), false);
    assert.equal(isPublicSupplierSlug("../etc/passwd"), false);
    assert.equal(isPublicSupplierSlug("Mother Company"), false);
    assert.equal(isPublicSupplierSlug("//evil.example"), false);
    assert.equal(isPublicSupplierSlug("foo@bar"), false);
  });
});

describe("getPublicSupplierOverview generation guard", () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  function timeoutResponse() {
    return new Response(
      JSON.stringify({
        code: "57014",
        message: "canceling statement due to statement timeout",
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  it("does not pin an overview 57014 after bumpLoadGeneration", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:9";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "overview-gen-guard-key";
    const slug = "overview-timeout-after-retry";
    const originalFetch = globalThis.fetch;
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("buyer_supplier_profile")) {
        await held;
        return timeoutResponse();
      }
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    try {
      const pending = getPublicSupplierOverview(slug);
      clearPublicProfileTimeoutShed(slug);
      release?.();
      const pack = await Promise.race([
        pending,
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("overview 57014 after Retry hung")),
            8_000,
          );
        }),
      ]);
      assert.equal(pack.timedOut, true);
      assert.equal(isPublicProfileTimeoutPinned(slug), false);
    } finally {
      globalThis.fetch = originalFetch;
      clearPublicProfileTimeoutShed(slug);
      if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
      if (prevKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevKey;
    }
  });

  it("pins an overview 57014 when the load generation is unchanged", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:9";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "overview-gen-guard-key";
    const slug = "overview-timeout-unbumped";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("buyer_supplier_profile")) return timeoutResponse();
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    try {
      const pack = await getPublicSupplierOverview(slug);
      assert.equal(pack.timedOut, true);
      assert.equal(isPublicProfileTimeoutPinned(slug), true);
    } finally {
      globalThis.fetch = originalFetch;
      clearPublicProfileTimeoutShed(slug);
      if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
      if (prevKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevKey;
    }
  });
});
