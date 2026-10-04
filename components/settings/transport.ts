// Every Settings save, out of React so a test can run it with an injected `fetch` (the pattern of
// `components/saved/transport.ts`). One call per form: `POST /api/v1/settings {action, …}`, and the
// avatar's own route. A sentence the route wrote ("Website must start with http:// or https://.")
// is shown as it is; anything else is the form's own sentence, never the route's key
// ("change_email failed").

type Res = { ok: boolean; status: number; json(): Promise<unknown> };
export type Init = { method: string; headers?: Record<string, string>; body?: string | FormData };
export type Fetch = (url: string, init?: Init) => Promise<Res>;

export type Posted = { ok: boolean; message: string | null; info: string | null; json: Record<string, unknown> | null };

/** The sentence a route wrote itself: it ends with a full stop and carries no `detail` key. */
export function routeSentence(json: unknown): string | null {
  const j = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const e = typeof j.error === "string" ? j.error.trim() : "";
  return e && j.detail === undefined && e.endsWith(".") ? e : null;
}

async function send(url: string, init: Init, failed: string, deps: { fetch: Fetch }): Promise<Posted> {
  try {
    const res = await deps.fetch(url, init);
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) return { ok: false, message: routeSentence(json) ?? failed, info: null, json };
    return { ok: true, message: null, info: typeof json?.info === "string" ? json.info : null, json };
  } catch {
    return { ok: false, message: "Could not reach SourceBD. Nothing was changed; try again.", info: null, json: null };
  }
}

export const postSettings = (body: Record<string, unknown>, failed: string, deps: { fetch: Fetch }) =>
  send("/api/v1/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, failed, deps);

export const postAvatar = (file: Blob, deps: { fetch: Fetch }) => {
  const fd = new FormData();
  fd.append("file", file);
  return send("/api/v1/settings/avatar", { method: "POST", body: fd }, "Could not upload the picture. Nothing was changed.", deps);
};

export const deleteAvatar = (deps: { fetch: Fetch }) => send("/api/v1/settings/avatar", { method: "DELETE" }, "Could not remove the picture. Nothing was changed.", deps);

export const SAVE_FAILED = {
  workspace: "Could not save your company details. Nothing was changed.",
  profile: "Could not save your name. Nothing was changed.",
  email: "Could not send the link. Check the address and try again.",
  password: "Could not update your password. Nothing was changed.",
} as const;

/** The browser's `fetch`, in the shape the helpers above take. */
export const browserFetch: Fetch = (url, init) => fetch(url, init as RequestInit);
