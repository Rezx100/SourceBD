// A fake `@/lib/supabase/server` for the /api/v1 route-handler tests (0106).
//
// The routes reach auth, the database and storage only through
// `createSupabaseServerClient`, so this replaces that module in the require
// cache when it loads. Import it BEFORE requiring a route: a route captures
// the client factory when it is first required, so a later swap is invisible
// to it (app/(app)/app/record-routes.test.ts found that out). Each test then
// sets `fake` to the session, role and RPC answers it is about.
//
// What it does NOT cover: the real database. It says what a route does with a
// given answer; migration 0106 itself is executed by CI's replay and by
// ops/dry_run_0106_buyer_workspace.py.

import path from "node:path";

export type Answer = { data: unknown; error: { message: string; code?: string } | null };

export const BUYER_ID = "0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b";

export const fake = {
  userId: BUYER_ID as string | null,
  email: "buyer@example.com" as string | null,
  /** The account's password for `passwordMatches`; `passwordCheckFails` makes the check itself throw. */
  password: "old-password",
  passwordCheckFails: false,
  passwordChecks: [] as { email: string; password: string }[],
  passwordUpdates: [] as string[],
  role: "buyer" as string | null,
  answers: {} as Record<string, Answer>,
  rpcCalls: [] as { fn: string; args: Record<string, unknown> | undefined }[],
  uploads: [] as { bucket: string; path: string; type: string }[],
  removed: [] as { bucket: string; paths: string[] }[],
  uploadError: null as { message: string } | null,
  /** Signed links asked for, and the error a signing answers with (a path the caller may not read). */
  signed: [] as { bucket: string; path: string; seconds: number }[],
  signError: null as { message: string } | null,
  /** The bytes a `.download(path)` answers with, by path; a path not here answers "Object not found". */
  files: {} as Record<string, Uint8Array>,
  downloads: [] as { bucket: string; path: string }[],
  /** Rows `.from(table)` answers for a table other than `profiles`, and the filters each read applied. */
  tables: {} as Record<string, Record<string, unknown>[]>,
  tableError: null as { message: string; code?: string } | null,
  fromCalls: [] as { table: string; columns: string; filters: { op: string; args: unknown[] }[]; update?: Record<string, unknown> }[],
  /** Rows an `.insert()` was given, and the error it answers with (e.g. `{ code: "42703" }` for a missing column). */
  inserted: [] as { table: string; values: Record<string, unknown> }[],
  insertError: null as { message: string; code?: string } | null,
};

export function resetFake(): void {
  fake.userId = BUYER_ID;
  fake.email = "buyer@example.com";
  fake.password = "old-password";
  fake.passwordCheckFails = false;
  fake.passwordChecks = [];
  fake.passwordUpdates = [];
  fake.role = "buyer";
  fake.answers = {};
  fake.rpcCalls = [];
  fake.uploads = [];
  fake.removed = [];
  fake.uploadError = null;
  fake.signed = [];
  fake.signError = null;
  fake.files = {};
  fake.downloads = [];
  fake.tables = {};
  fake.tableError = null;
  fake.fromCalls = [];
  fake.inserted = [];
  fake.insertError = null;
}

/** The RPCs a test saw called, by name. */
export const called = (fn: string) => fake.rpcCalls.filter((c) => c.fn === fn);

/** The four contact columns, which no products or drafts response may carry. */
export const CONTACT_KEY_RE = /email_primary|phones|contact_name|contact_role/;

const STORAGE = "https://supabase.invalid/storage/v1";

const client = {
  auth: {
    getUser: async () => ({ data: { user: fake.userId ? { id: fake.userId, email: fake.email ?? undefined } : null } }),
    updateUser: async (attrs: { password?: string }) => {
      if (attrs.password !== undefined) fake.passwordUpdates.push(attrs.password);
      return { data: {}, error: null };
    },
  },
  rpc: async (fn: string, args?: Record<string, unknown>): Promise<Answer> => {
    fake.rpcCalls.push({ fn, args });
    return fake.answers[fn] ?? { data: null, error: null };
  },
  // getServerRole: from("profiles").select("role").eq("id", uid).maybeSingle().
  // Any other table answers `fake.tables[table]`, filtered by the `.in()` and
  // `.eq()` calls the route made, so a test sees what the route asked for.
  from(table: string) {
    const call = { table, columns: "", filters: [] as { op: string; args: unknown[] }[], update: undefined as Record<string, unknown> | undefined };
    if (table !== "profiles") fake.fromCalls.push(call);
    const rows = () => {
      let out = fake.tables[table] ?? [];
      for (const f of call.filters) {
        const [col, v] = f.args as [string, unknown];
        if (f.op === "in") out = out.filter((r) => (v as unknown[]).includes(r[col]));
        if (f.op === "eq") out = out.filter((r) => r[col] === v);
      }
      return out;
    };
    const chain = {
      // An insert answers `fake.insertError`, or stores the row in `fake.tables` and says it worked.
      insert: async (values: Record<string, unknown>) => {
        fake.inserted.push({ table, values });
        if (fake.insertError) return { data: null, error: fake.insertError };
        (fake.tables[table] ??= []).push(values);
        return { data: null, error: null };
      },
      select: (columns: string) => ((call.columns = columns), chain),
      // An update changes the rows its filters match, in `fake.tables`, and answers them.
      update: (values: Record<string, unknown>) => ((call.update = values), chain),
      eq: (...args: unknown[]) => (call.filters.push({ op: "eq", args }), chain),
      in: (...args: unknown[]) => (call.filters.push({ op: "in", args }), chain),
      maybeSingle: async () => ({ data: fake.role ? { role: fake.role } : null, error: null }),
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve(
          fake.tableError
            ? { data: null, error: fake.tableError }
            : { data: rows().map((r) => (call.update ? Object.assign(r, call.update) : r)), error: null },
        ).then(resolve),
    };
    return chain;
  },
  storage: {
    from: (bucket: string) => ({
      upload: async (p: string, file: File) => {
        fake.uploads.push({ bucket, path: p, type: file.type });
        return { data: fake.uploadError ? null : { path: p }, error: fake.uploadError };
      },
      // The real client's shape: encodeURI(`${url}/object/public/${bucket}/${path}`).
      getPublicUrl: (p: string) => ({ data: { publicUrl: encodeURI(`${STORAGE}/object/public/${bucket}/${p}`) } }),
      createSignedUrl: async (p: string, seconds: number) => {
        fake.signed.push({ bucket, path: p, seconds });
        return fake.signError ? { data: null, error: fake.signError } : { data: { signedUrl: `${STORAGE}/object/sign/${bucket}/${p}?token=t` }, error: null };
      },
      remove: async (paths: string[]) => {
        fake.removed.push({ bucket, paths });
        return { data: [], error: null };
      },
      download: async (p: string) => {
        fake.downloads.push({ bucket, path: p });
        const bytes = fake.files[p];
        return bytes ? { data: new Blob([Uint8Array.from(bytes)]), error: null } : { data: null, error: { message: "Object not found" } };
      },
    }),
  },
};

/** Put `exports` in the require cache under a module of the test build. */
export function installModule(mod: string, exports: object): void {
  const out = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");
  const id = require.resolve(path.join(out, mod));
  require.cache[id] = { id, filename: id, loaded: true, exports, children: [], paths: [] } as unknown as NodeJS.Module;
}

async function passwordMatches(email: string, password: string): Promise<boolean> {
  fake.passwordChecks.push({ email, password });
  if (fake.passwordCheckFails) throw new Error("password check failed: rate limited");
  return password === fake.password;
}

installModule("lib/supabase/server.js", { createSupabaseServerClient: async () => client, passwordMatches });
