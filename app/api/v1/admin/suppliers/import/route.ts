// /api/v1/admin/suppliers/import — bulk CSV update (Spec A2).
//
// Accepts a CSV body (text/csv or multipart/form-data with a `file` field).
// Header row required. Columns recognised:
//   slug                (required — primary key for the row)
//   action              (optional; default `update`): update | publish |
//                                                    unpublish | sanction |
//                                                    unsanction
//   name_display, description, entity_type, sanctioned_reason, notes_admin
//
// Per-row dispatch through `public.admin_supplier_update` (whitelist
// enforced server-side). Response carries per-row outcomes; one bad row
// never aborts the batch.

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  TAG_DISCOVER_FACETS,
  TAG_DISCOVER_SUPPLIERS,
  tagSupplier,
} from "@/lib/cache/tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 2000;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB CSV

// ---- minimal RFC4180 parser (no new dependency) -----------------------------
// Handles "" escaping and embedded newlines inside quoted fields. Trims a
// trailing CRLF/LF on the last row.
function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\r") continue;
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += c;
  }
  // Flush the final field/row only if there is leftover content.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

type Outcome =
  | { row: number; slug: string; ok: true; patch: Record<string, unknown> }
  | { row: number; slug: string; ok: false; reason: string };

const ALLOWED_ACTIONS = new Set([
  "update",
  "publish",
  "unpublish",
  "sanction",
  "unsanction",
]);

const EDITABLE_FIELDS = new Set([
  "name_display",
  "description",
  "entity_type",
  "sanctioned_reason",
  "notes_admin",
]);

function buildPatch(
  action: string,
  fields: Record<string, string>,
): { patch: Record<string, unknown> } | { error: string } {
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (!EDITABLE_FIELDS.has(k)) continue;
    if (v === "" || v == null) continue;
    patch[k] = v;
  }
  if (action === "publish") patch.published = true;
  else if (action === "unpublish") patch.published = false;
  else if (action === "sanction") {
    patch.sanctioned_flag = true;
    if (!patch.sanctioned_reason && fields.sanctioned_reason) {
      patch.sanctioned_reason = fields.sanctioned_reason;
    }
  } else if (action === "unsanction") patch.sanctioned_flag = false;
  else if (action !== "update") return { error: `unknown action: ${action}` };

  if (Object.keys(patch).length === 0) {
    return { error: "no editable fields to apply" };
  }
  return { patch };
}

async function readCsvBody(req: Request): Promise<{ text: string } | { error: string; status: number }> {
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  if (ct.startsWith("multipart/form-data")) {
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) {
      return { error: "multipart upload must include `file`", status: 400 };
    }
    if (file.size > MAX_BODY_BYTES) {
      return { error: `csv exceeds ${MAX_BODY_BYTES} bytes`, status: 413 };
    }
    return { text: await file.text() };
  }
  const buf = await req.arrayBuffer();
  if (buf.byteLength > MAX_BODY_BYTES) {
    return { error: `csv exceeds ${MAX_BODY_BYTES} bytes`, status: 413 };
  }
  return { text: new TextDecoder().decode(buf) };
}

export async function POST(req: Request) {
  const role = await getServerRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const body = await readCsvBody(req);
  if ("error" in body) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const rows = parseCsv(body.text);
  if (rows.length < 2) {
    return NextResponse.json(
      { error: "csv must include a header row and at least one data row" },
      { status: 400 },
    );
  }
  const headerRow = rows[0];
  if (!headerRow) {
    return NextResponse.json({ error: "empty csv" }, { status: 400 });
  }
  const header = headerRow.map((c) => c.trim().toLowerCase());
  const slugIdx = header.indexOf("slug");
  if (slugIdx < 0) {
    return NextResponse.json(
      { error: "csv missing required `slug` column" },
      { status: 400 },
    );
  }
  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `csv exceeds ${MAX_ROWS} data rows` },
      { status: 413 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const outcomes: Outcome[] = [];
  let updated = 0;

  for (let r = 0; r < dataRows.length; r++) {
    const lineNo = r + 2; // 1-based, +1 for header
    const cells = dataRows[r];
    if (!cells) continue;
    // Skip fully-blank lines.
    if (cells.every((c) => c.trim() === "")) continue;

    const rec: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) {
      const key = header[i];
      if (!key) continue;
      rec[key] = (cells[i] ?? "").trim();
    }
    const slug = rec.slug;
    if (!slug) {
      outcomes.push({ row: lineNo, slug: "", ok: false, reason: "empty slug" });
      continue;
    }
    const action = (rec.action || "update").toLowerCase();
    if (!ALLOWED_ACTIONS.has(action)) {
      outcomes.push({
        row: lineNo,
        slug,
        ok: false,
        reason: `unknown action: ${action}`,
      });
      continue;
    }

    const { data: lookup, error: lookupErr } = await supabase
      .from("suppliers")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (lookupErr) {
      outcomes.push({
        row: lineNo,
        slug,
        ok: false,
        reason: `lookup failed: ${lookupErr.message}`,
      });
      continue;
    }
    if (!lookup) {
      outcomes.push({ row: lineNo, slug, ok: false, reason: "supplier not found" });
      continue;
    }

    const built = buildPatch(action, rec);
    if ("error" in built) {
      outcomes.push({ row: lineNo, slug, ok: false, reason: built.error });
      continue;
    }
    const { error: updErr } = await supabase.rpc("admin_supplier_update", {
      p_id: lookup.id as string,
      p_patch: built.patch,
    });
    if (updErr) {
      outcomes.push({
        row: lineNo,
        slug,
        ok: false,
        reason: updErr.message,
      });
      continue;
    }
    outcomes.push({ row: lineNo, slug, ok: true, patch: built.patch });
    updated++;
  }

  const failed = outcomes.filter((o) => o.ok === false) as Array<
    Extract<Outcome, { ok: false }>
  >;
  if (updated > 0) {
    revalidateTag(TAG_DISCOVER_FACETS);
    revalidateTag(TAG_DISCOVER_SUPPLIERS);
    for (const o of outcomes) {
      if (o.ok) revalidateTag(tagSupplier(o.slug));
    }
  }
  return NextResponse.json({
    processed: outcomes.length,
    updated,
    failed_count: failed.length,
    failed,
  });
}
