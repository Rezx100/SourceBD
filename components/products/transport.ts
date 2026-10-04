// Every call the Products pages make, out of React so a test can run them with an injected `fetch`
// (the pattern of `components/saved/transport.ts`): archive, restore and delete from the list, and the
// editor's save, upload and release of a file. The routes are `POST /api/v1/products {action:"set_status"
// | "upsert"}`, `DELETE /api/v1/products?id=`, and `POST`/`DELETE /api/v1/products/media`; a sentence the
// route itself wrote is shown as it is, and a route key never is.

import { routeSentence } from "@/components/product-form-model";
import { refusal } from "./edit";
import type { ProductStatus } from "./words";

type Res = { ok: boolean; status: number; json(): Promise<unknown> };
export type Init = { method: string; headers?: Record<string, string>; body?: string | FormData; keepalive?: boolean };
export type Fetch = (url: string, init?: Init) => Promise<Res>;

export type Outcome = { ok: boolean; message: string | null };

async function run(req: () => Promise<Res>, failed: string): Promise<Outcome> {
  try {
    const res = await req();
    if (res.ok) return { ok: true, message: null };
    return { ok: false, message: routeSentence(await res.json().catch(() => null)) ?? failed };
  } catch {
    return { ok: false, message: `${failed} No connection.` };
  }
}

export const runSetStatus = (id: string, status: ProductStatus, deps: { fetch: Fetch }): Promise<Outcome> =>
  run(
    () =>
      deps.fetch("/api/v1/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "set_status", id, status }),
      }),
    status === "archived" ? "Could not archive it. Nothing was changed." : "Could not change it. Nothing was changed.",
  );

export const runDelete = (id: string, deps: { fetch: Fetch }): Promise<Outcome> =>
  run(() => deps.fetch(`/api/v1/products?id=${encodeURIComponent(id)}`, { method: "DELETE" }), "Could not delete it. Nothing was removed.");

export type Sent = { ok: boolean; message: string | null; id: string | null; url: string | null };

async function sent(req: () => Promise<Res>, what: "save" | "upload"): Promise<Sent> {
  let res: Res;
  let json: Record<string, unknown> | null = null;
  try {
    res = await req();
    json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  } catch {
    return { ok: false, message: refusal(0, null, what), id: null, url: null };
  }
  const id = typeof json?.id === "string" ? json.id : null;
  const url = typeof json?.url === "string" ? json.url : null;
  const good = res.ok && (what === "save" ? id !== null : url !== null);
  return good ? { ok: true, message: null, id, url } : { ok: false, message: refusal(res.status, routeSentence(json), what), id: null, url: null };
}

/** The editor's save: `{action:"upsert", product}` → `{id}`. */
export const saveProduct = (payload: unknown, deps: { fetch: Fetch }): Promise<Sent> =>
  sent(() => deps.fetch("/api/v1/products", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "upsert", product: payload }) }), "save");

/** One file to storage (`image` or `tech_pack`) → `{url}`; the product keeps the URL. */
export function uploadMedia(file: Blob, kind: "image" | "tech_pack", deps: { fetch: Fetch }): Promise<Sent> {
  const body = new FormData();
  body.append("file", file);
  body.append("kind", kind);
  return sent(() => deps.fetch("/api/v1/products/media", { method: "POST", body }), "upload");
}

/** A stored file the saved product no longer holds leaves storage too; best effort, and `keepalive` so a navigation does not cancel it. */
export const releaseFile = (url: string, deps: { fetch: Fetch }): Promise<unknown> =>
  deps.fetch("/api/v1/products/media", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }), keepalive: true }).catch(() => undefined);

export const browserFetch: Fetch = (url, init) => fetch(url, init as RequestInit);
