// Cookie-free, shared cache for anonymous factory evidence.
// Public factory pages and the homepage live example must use this
// helper, not the SSR cookie client. Admin already purges tagSupplier(slug).

import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { tagSupplier } from "@/lib/cache/tags";
import { hscodesFromRpc, type ProfileEpbHscode } from "@/lib/epb-hscodes";
import { fetchFacilityParentSlug } from "@/lib/facility-parent-redirect";

export const PUBLIC_PROFILE_REVALIDATE_SECONDS = 300;

/** Same-request join window for middleware + the force-static page.
 *  Not a success cache: Retry and admin invalidate drop the entry
 *  immediately, and this delay is far shorter than revalidate. */
const PROFILE_INFLIGHT_COALESCE_MS = 8_000;

const PUBLIC_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isPublicSupplierSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 180 && PUBLIC_SLUG_RE.test(slug);
}

export class ProfileStatementTimeout extends Error {
  readonly slug: string;
  constructor(slug: string) {
    super("profile-statement-timeout");
    this.name = "ProfileStatementTimeout";
    this.slug = slug;
  }
}

export type PublicSupplierProfilePack = {
  timedOut: boolean;
  data: unknown | null;
  parentSlug: string | null;
  facilityRaw: unknown | null;
  facilityLoadError: boolean;
  epbHs: { hscodes: ProfileEpbHscode[]; loadError: boolean };
};

type RpcError = { code?: string; message?: string } | null;

export function isProfileRpcTimeout(error: RpcError): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  const msg = error.message ?? "";
  return (
    code === "57014" ||
    /statement timeout|canceling statement|timed out/i.test(msg)
  );
}

export function createPublicAnonClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type PackScope = "full" | "overview";

const EMPTY_HS = { hscodes: [] as ProfileEpbHscode[], loadError: false };

function timedOutPack(): PublicSupplierProfilePack {
  return {
    timedOut: true,
    data: null,
    parentSlug: null,
    facilityRaw: null,
    facilityLoadError: false,
    epbHs: EMPTY_HS,
  };
}

/** Distinguish "this company has no buildings" from "the panel RPC failed". */
export function facilityPanelFromRpc(result: {
  data: unknown;
  error: unknown;
}): { facilityRaw: unknown | null; facilityLoadError: boolean } {
  if (result.error) return { facilityRaw: null, facilityLoadError: true };
  const data = result.data;
  if (isProfileRpcTimeout(asRpcError(data))) {
    return { facilityRaw: null, facilityLoadError: true };
  }
  if (data == null) return { facilityRaw: null, facilityLoadError: false };
  if (!isFacilityPanelPayload(data)) {
    return { facilityRaw: null, facilityLoadError: true };
  }
  return { facilityRaw: data, facilityLoadError: false };
}

function asRpcError(value: unknown): RpcError {
  if (!value || typeof value !== "object") return null;
  return value as RpcError;
}

function isFacilityPanelPayload(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Array.isArray((value as { facilities?: unknown }).facilities);
}

async function loadPublicSupplierProfile(
  slug: string,
  scope: PackScope,
): Promise<PublicSupplierProfilePack> {
  const supabase = createPublicAnonClient();
  if (scope === "overview") {
    const profile = await supabase.rpc("buyer_supplier_profile", {
      p_slug: slug,
    });
    if (
      isProfileRpcTimeout(profile.error) ||
      isProfileRpcTimeout(asRpcError(profile.data))
    ) {
      throw new ProfileStatementTimeout(slug);
    }
    return {
      timedOut: false,
      data: profile.data ?? null,
      parentSlug: null,
      facilityRaw: null,
      facilityLoadError: false,
      epbHs: EMPTY_HS,
    };
  }
  const [profile, facility, hs] = await Promise.all([
    supabase.rpc("buyer_supplier_profile", { p_slug: slug }),
    supabase.rpc("buyer_supplier_facility_panel", { p_slug: slug }),
    supabase.rpc("supplier_epb_hscodes", { p_slug: slug }),
  ]);
  if (
    isProfileRpcTimeout(profile.error) ||
    isProfileRpcTimeout(asRpcError(profile.data))
  ) {
    throw new ProfileStatementTimeout(slug);
  }
  let parentSlug: string | null = null;
  if (profile.data == null) {
    parentSlug = await fetchFacilityParentSlug(supabase, slug);
  }
  const panel = facilityPanelFromRpc(facility);
  return {
    timedOut: false,
    data: profile.data ?? null,
    parentSlug,
    facilityRaw: panel.facilityRaw,
    facilityLoadError: panel.facilityLoadError,
    epbHs: hscodesFromRpc(hs),
  };
}

function cachedPublicSupplierProfile(slug: string, scope: PackScope) {
  return unstable_cache(
    () => loadPublicSupplierProfile(slug, scope),
    ["public-supplier-profile", slug, scope],
    {
      revalidate: PUBLIC_PROFILE_REVALIDATE_SECONDS,
      tags: [tagSupplier(slug)],
    },
  )();
}

type ProcessCacheGlobal = typeof globalThis & {
  __sourcebdProfileTimeoutShed?: Map<string, { until: number; pack: PublicSupplierProfilePack }>;
  __sourcebdProfileInflight?: Map<string, Promise<PublicSupplierProfilePack>>;
  __sourcebdProfileLoadGen?: Map<string, number>;
};

function processCacheGlobal(): ProcessCacheGlobal {
  return globalThis as ProcessCacheGlobal;
}

function timeoutShed() {
  const g = processCacheGlobal();
  if (!g.__sourcebdProfileTimeoutShed) {
    g.__sourcebdProfileTimeoutShed = new Map();
  }
  return g.__sourcebdProfileTimeoutShed;
}

function inflightMap() {
  const g = processCacheGlobal();
  if (!g.__sourcebdProfileInflight) {
    g.__sourcebdProfileInflight = new Map();
  }
  return g.__sourcebdProfileInflight;
}

function loadGenerationMap() {
  const g = processCacheGlobal();
  if (!g.__sourcebdProfileLoadGen) {
    g.__sourcebdProfileLoadGen = new Map();
  }
  return g.__sourcebdProfileLoadGen;
}

function currentLoadGeneration(slug: string): number {
  return loadGenerationMap().get(slug) ?? 0;
}

function bumpLoadGeneration(slug: string): void {
  const gens = loadGenerationMap();
  gens.set(slug, (gens.get(slug) ?? 0) + 1);
}

export function isPublicProfileTimeoutPinned(slug: string): boolean {
  const pinned = timeoutShed().get(slug);
  return Boolean(pinned && pinned.until > Date.now());
}

/** Drop process-local pins. Retry must call this: revalidateTag does not
 *  see the timeout shed. */
export function clearPublicProfileTimeoutShed(slug: string): void {
  timeoutShed().delete(slug);
  inflightMap().delete(`full:${slug}`);
  bumpLoadGeneration(slug);
}

function isTimeoutError(err: unknown): boolean {
  return (
    err instanceof ProfileStatementTimeout ||
    (err instanceof Error && err.name === "ProfileStatementTimeout")
  );
}

async function loadFullPack(slug: string): Promise<PublicSupplierProfilePack> {
  const started = currentLoadGeneration(slug);
  try {
    const pack = await cachedPublicSupplierProfile(slug, "full");
    // A Retry (or admin purge) may have pinned a newer 57014 while
    // this load was still in flight. Do not wipe that pin, and do
    // not emit a cacheable factory 200 for this stale waiter.
    if (currentLoadGeneration(slug) !== started) {
      // The success already landed in unstable_cache. Drop it so a
      // later GET cannot emit a cacheable factory 200 after this
      // waiter 307s and the newer pin expires.
      revalidateTag(tagSupplier(slug));
      return timedOutPack();
    }
    timeoutShed().delete(slug);
    return pack;
  } catch (err) {
    if (!isTimeoutError(err)) throw err;
    // Retry bumped the generation while this load was in flight.
    // Do not re-pin: this response may still look timed-out, but the
    // next GET must re-query.
    if (currentLoadGeneration(slug) !== started) {
      return timedOutPack();
    }
    const pack = timedOutPack();
    timeoutShed().set(slug, {
      until: Date.now() + PUBLIC_PROFILE_REVALIDATE_SECONDS * 1000,
      pack,
    });
    return pack;
  }
}

/** Same pack as the public page, without React request-deduping.
 *  Node middleware uses this so a 57014 can 307 with no-store
 *  instead of letting force-static ISR-cache the redirect.
 *  Timed-out packs are pinned on globalThis so the Retry route
 *  (server bundle) and middleware share one map. In-flight promises
 *  coalesce middleware + page on the same request without a 300s
 *  success memo that would ignore admin revalidateTag. */
export async function getCachedPublicSupplierProfile(slug: string) {
  const pinned = timeoutShed().get(slug);
  if (pinned && pinned.until > Date.now()) return pinned.pack;
  const key = `full:${slug}`;
  const inflight = inflightMap();
  const existing = inflight.get(key);
  if (existing) return existing;
  const pending = loadFullPack(slug);
  inflight.set(key, pending);
  void pending.then(
    (pack) => {
      // Timeout lives on the shed. Drop inflight so Retry cannot
      // accidentally await this 57014 promise.
      if (pack.timedOut) {
        if (inflight.get(key) === pending) inflight.delete(key);
        return;
      }
      setTimeout(() => {
        if (inflight.get(key) === pending) inflight.delete(key);
      }, PROFILE_INFLIGHT_COALESCE_MS);
    },
    () => {
      if (inflight.get(key) === pending) inflight.delete(key);
    },
  );
  return pending;
}

/** Request-scoped dedupe so generateMetadata and the page share one pack.
 *  Goes through the shed so a timeout is timedOut, not a throw, when
 *  middleware already pinned it. */
export const getPublicSupplierProfile = cache((slug: string) =>
  getCachedPublicSupplierProfile(slug),
);

/** Homepage live example: one profile RPC. A 57014 throws inside
 *  unstable_cache so it is not stored as a factory pack. Pin the miss
 *  so crawlers on / do not re-query every hit. Retry bumps generation
 *  so a stale homepage catch cannot re-pin and 307 the factory URL. */
export const getPublicSupplierOverview = cache(async (slug: string) => {
  const pinned = timeoutShed().get(slug);
  if (pinned && pinned.until > Date.now()) return pinned.pack;
  const started = currentLoadGeneration(slug);
  try {
    return await cachedPublicSupplierProfile(slug, "overview");
  } catch (err) {
    if (!isTimeoutError(err)) throw err;
    // Same guard as loadFullPack: Retry/admin already bumped gen.
    // Do not re-pin a recovered factory URL for 300s.
    if (currentLoadGeneration(slug) !== started) {
      return timedOutPack();
    }
    const pack = timedOutPack();
    timeoutShed().set(slug, {
      until: Date.now() + PUBLIC_PROFILE_REVALIDATE_SECONDS * 1000,
      pack,
    });
    return pack;
  }
});
