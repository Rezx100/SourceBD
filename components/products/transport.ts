// Archive, restore and delete, out of React so a test can run them (the caller injects `fetch`, as
// `components/saved/transport.ts` does). The routes are `POST /api/v1/products {action:"set_status"}`
// and `DELETE /api/v1/products?id=`; a sentence the route itself wrote is shown as it is.

import { routeSentence } from "@/components/product-form-model";
import type { ProductStatus } from "./words";

type Res = { ok: boolean; status: number; json(): Promise<unknown> };
export type Fetch = (url: string, init?: { method: string; headers?: Record<string, string>; body?: string }) => Promise<Res>;

/** `message` is the sentence for a failure, null on success. */
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
