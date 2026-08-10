// POST /api/v1/match — Spec B4 Smart Match wizard endpoint.
//
// Accepts the 3-step wizard payload, validates it inline (no zod — keeping
// dependencies locked per architecture.md), calls the security-definer SQL
// function `public.buyer_smart_match(p_input jsonb)`, and returns the ranked
// results document untouched.
//
// Auth: `middleware.ts` only covers `/app/*`, `/supplier/*`, `/admin/*`. This
// handler enforces buyer/admin auth itself via `getServerRole()`. No anon
// access \u2014 the wizard surface is buyer-only by frontend-design-spec.md \u00a72.1.
//
// The matcher RPC excludes contact PII and never serialises SBI numerics, so
// this route does not need to project / strip fields after the call.

import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { enrichDiscoverWorkers } from "@/lib/enrich-discover-workers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Json = Record<string, unknown>;

const ALLOWED_ENTITY_TYPES = new Set(["factory", "buying_house"]);
const ALLOWED_REGISTRIES   = new Set(["BGMEA", "BKMEA", "BTMA", "BGAPMEA", "EPB", "RSC"]);
const ALLOWED_CERTS        = new Set(["wrap", "oeko_tex", "gots", "sa8000"]);

function asStringArray(v: unknown, allowed: Set<string>, normalise: (s: string) => string): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = new Set<string>();
  for (const x of v) {
    if (typeof x !== "string") continue;
    const n = normalise(x.trim());
    if (n && allowed.has(n)) out.add(n);
  }
  return out.size > 0 ? Array.from(out) : null;
}

function asTrimmedString(v: unknown, max = 120): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function asBoundedInt(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < min || i > max) return null;
  return i;
}

function buildPayload(raw: Json): Json {
  const payload: Json = {};
  const product = asTrimmedString(raw.product, 80);
  if (product) payload.product = product;

  const entityTypes = asStringArray(raw.entity_types, ALLOWED_ENTITY_TYPES, (s) => s.toLowerCase());
  if (entityTypes) payload.entity_types = entityTypes;

  const registries = asStringArray(raw.registries, ALLOWED_REGISTRIES, (s) => s.toUpperCase());
  if (registries) payload.registries = registries;

  const certs = asStringArray(raw.certs, ALLOWED_CERTS, (s) => s.toLowerCase());
  if (certs) payload.certs = certs;

  const rscMin = asBoundedInt(raw.rsc_min, 0, 100);
  if (rscMin !== null) payload.rsc_min = rscMin;

  const minMachines = asBoundedInt(raw.min_machines, 0, 100000);
  if (minMachines !== null) payload.min_machines = minMachines;

  const city = asTrimmedString(raw.city, 80);
  if (city) payload.city = city;

  const district = asTrimmedString(raw.district, 80);
  if (district) payload.district = district;

  const limit = asBoundedInt(raw.limit, 1, 100);
  payload.limit = limit ?? 24;

  const offset = asBoundedInt(raw.offset, 0, 100000);
  payload.offset = offset ?? 0;

  return payload;
}

export async function POST(req: Request) {
  const role = await getServerRole();
  if (role !== "buyer" && role !== "admin") {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  let raw: Json;
  try {
    const body = (await req.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "body must be an object" }, { status: 400 });
    }
    raw = body as Json;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const payload = buildPayload(raw);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("buyer_smart_match", { p_input: payload });
  if (error) {
    return NextResponse.json({ error: "match failed", detail: error.message }, { status: 500 });
  }

  const doc = (data ?? { criteria_count: 0, total: 0, results: [] }) as {
    criteria_count?: number;
    total?: number;
    results?: Array<{ id: string; employees_total: number | null } & Record<string, unknown>>;
    [key: string]: unknown;
  };
  if (Array.isArray(doc.results) && doc.results.length > 0) {
    doc.results = await enrichDiscoverWorkers(supabase, doc.results);
  }
  return NextResponse.json(doc);
}
