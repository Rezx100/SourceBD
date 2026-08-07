/**
 * HTTP-boundary guard for the supplier profile miss path — REZ-72 / REZ-58
 * Stage 2 durable guard.
 *
 * WHY THIS EXISTS: REZ-72 shipped 361 green unit tests, every one asserting a
 * pure function's return value, while the route streamed its shell and
 * committed HTTP 200 before notFound()/permanentRedirect() could set the
 * status. Helper-level tests cannot see that. This script asserts the
 * OBSERVABLE boundary: the HTTP status and Location header on the wire, from
 * the real application server, against a stub Supabase.
 *
 * What it proves (both route groups):
 *   - missing slug                  -> 404
 *   - unpublished non-facility slug -> 404 (RPC miss, no facility mapping)
 *   - unpublished FACILITY slug     -> 308, Location: mother profile
 *   - published slug                -> 200 (happy path intact)
 *   - /app/* without a session      -> 307 to /login (auth gate intact)
 *
 * NEXT_PUBLIC_* variables are inlined at BUILD time, so the app must be
 * compiled against the stub — pointing env at `next start` is not enough.
 * Modes:
 *   node scripts/test-profile-http-boundary.mjs --build   # full prod proof:
 *                                                         # builds with stub
 *                                                         # env, `next start`,
 *                                                         # tests (~8 min)
 *   node scripts/test-profile-http-boundary.mjs --dev     # fast iteration:
 *                                                         # `next dev` with
 *                                                         # stub env
 *   node scripts/test-profile-http-boundary.mjs           # reuse a previous
 *                                                         # --build artifact
 *
 * No production resources are touched: the app under test is pointed at a
 * local stub that answers the exact RPC/REST/auth calls the routes make.
 */

import { spawn } from "node:child_process";
import http from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const MOCK_PORT = 8901;
const APP_PORT = 3100;
const MOCK_URL = `http://localhost:${MOCK_PORT}`;
const APP_URL = `http://localhost:${APP_PORT}`;
const MARKER = join(ROOT, ".next", "http-guard-env.json");

const MOTHER = "mother-company-ltd";
const FACILITY = "mother-company-ltd-extension";
const MISSING = "this-slug-cannot-possibly-exist-http-guard";
const UNPUBLISHED = "unpublished-plain-supplier-ltd";

const requestLog = [];

// Minimal but complete payload matching the routes' ProfilePayload type.
const HAPPY_PAYLOAD = {
  supplier: {
    id: "00000000-0000-4000-8000-000000000001",
    slug: MOTHER,
    company_name: "Mother Company Ltd",
    entity_type: "factory",
    city: "Gazipur",
    district: "Dhaka",
    country: "Bangladesh",
    address_raw: "Plot 1, Example Road",
    completeness_pct: 80,
    is_sanctioned: false,
    parent_group_name: null,
    established_date: null,
    bepza_zone: null,
    factory_types: [],
    principal_products: [],
    employees_total: 1200,
    employees_male: 600,
    employees_female: 600,
    machines_sewing: 400,
    production_capacity_pcs_day: 5000,
    production_capacity_dozen_yearly: null,
    source_tags: ["BGMEA"],
  },
  t13_source_count: 1,
  pills: [],
  certifications: [],
  rsc_remediation: null,
  brand_attributions: [],
  sanctions: [],
  provenance: [],
  addresses: [],
  documents: [],
};

const TEST_USER = {
  id: "00000000-0000-4000-8000-0000000000aa",
  aud: "authenticated",
  role: "authenticated",
  email: "http-guard@example.test",
};

function mockHandler(req, res) {
  const url = new URL(req.url, MOCK_URL);
  requestLog.push(`${req.method} ${url.pathname}`);
  const json = (body, status = 200) => {
    const text = JSON.stringify(body);
    res.writeHead(status, { "content-type": "application/json" });
    res.end(text);
  };
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (url.pathname === "/rest/v1/rpc/buyer_supplier_profile") {
      let slug = null;
      try {
        slug = JSON.parse(body || "{}").p_slug ?? null;
      } catch {
        slug = null;
      }
      return json(slug === MOTHER ? HAPPY_PAYLOAD : null);
    }
    if (url.pathname === "/rest/v1/rpc/facility_parent_slug") {
      let slug = null;
      try {
        slug = JSON.parse(body || "{}").p_slug ?? null;
      } catch {
        slug = null;
      }
      return json(slug === FACILITY ? MOTHER : null);
    }
    if (url.pathname === "/rest/v1/rpc/rl_check") {
      return json({ ok: true, retry_after_seconds: 0 });
    }
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      return json(null);
    }
    if (url.pathname === "/auth/v1/user") {
      return json(TEST_USER);
    }
    if (url.pathname.startsWith("/auth/v1/")) {
      return json({ error: "not implemented in stub" }, 400);
    }
    if (url.pathname === "/rest/v1/profiles") {
      const row = { role: "buyer", is_suspended: false };
      const wantsObject = (req.headers.accept || "").includes("vnd.pgrst.object");
      return json(wantsObject ? row : [row]);
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      // PostgREST shape for "object requested, 0 rows" so maybeSingle()
      // resolves to null instead of throwing.
      const wantsObject = (req.headers.accept || "").includes("vnd.pgrst.object");
      if (wantsObject) {
        return json(
          {
            code: "PGRST116",
            details: "The result contains 0 rows",
            hint: null,
            message: "JSON object requested, multiple (or no) rows returned",
          },
          406,
        );
      }
      return json([]);
    }
    return json({ error: "unmapped stub path" }, 404);
  });
}

function buildAuthCookieHeader() {
  const session = {
    access_token: "http-guard-access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "http-guard-refresh-token",
    user: TEST_USER,
  };
  // @supabase/ssr cookieEncoding "base64url" writes values as
  // `base64-<base64url(JSON)>`; getChunks only decodes when the prefix is
  // present. Storage key is sb-<hostname first label>-auth-token
  // (supabase-js SupabaseClient).
  const value =
    "base64-" + Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `sb-localhost-auth-token=${value}`;
}

function stubEnv() {
  return {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: MOCK_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "http-guard-anon-key",
    NEXT_PUBLIC_SITE_URL: APP_URL,
    NEXT_PUBLIC_APP_URL: APP_URL,
    SENTRY_AUTH_TOKEN: "",
    NEXT_TELEMETRY_DISABLED: "1",
  };
}

function startMock() {
  const server = http.createServer(mockHandler);
  const sockets = new Set();
  server.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  });
  server.destroyAll = () => {
    for (const s of sockets) s.destroy();
  };
  return new Promise((resolve) => {
    server.listen(MOCK_PORT, "127.0.0.1", () => resolve(server));
  });
}

function killTree(child) {
  return new Promise((resolve) => {
    if (!child || !child.pid) return resolve();
    // npx on Windows spawns a cmd shim; kill the whole tree.
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    killer.on("exit", () => resolve());
    killer.on("error", () => resolve());
  });
}

// The Next server can be a grandchild that outlives the npx shim, so also
// kill whatever owns the app port. Windows-only (netstat/taskkill); no-op
// elsewhere beyond the tree kill above.
function killPortOwner(port) {
  return new Promise((resolve) => {
    if (process.platform !== "win32") return resolve();
    const ps = spawn(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue` +
          ` | Select-Object -ExpandProperty OwningProcess -Unique` +
          ` | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }`,
      ],
      { stdio: "ignore" },
    );
    ps.on("exit", () => resolve());
    ps.on("error", () => resolve());
  });
}

function runGuardBuild() {
  console.log("building against stub Supabase (this takes several minutes)…");
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "build"], {
      cwd: ROOT,
      env: stubEnv(),
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });
    let buf = "";
    child.stdout.on("data", (d) => (buf += d));
    child.stderr.on("data", (d) => (buf += d));
    child.on("exit", async (code) => {
      // `output: "standalone"` fails its symlink copy on Windows (EPERM)
      // AFTER the real build output is written; BUILD_ID is the authority.
      const built = existsSync(join(ROOT, ".next", "BUILD_ID"));
      if (!built) {
        return reject(new Error(`build produced no BUILD_ID (exit ${code}).\n${buf.slice(-4000)}`));
      }
      writeFileSync(
        MARKER,
        JSON.stringify({ supabaseUrl: MOCK_URL, builtAt: new Date().toISOString() }),
      );
      await killTree(child);
      resolve();
    });
  });
}

function checkGuardBuild() {
  if (!existsSync(join(ROOT, ".next", "BUILD_ID")) || !existsSync(MARKER)) {
    console.error(
      "ERROR: no stub-built artifact. Run with --build first.\n" +
        "(A normal `npm run build` inlines the REAL Supabase URL from .env;\n" +
        "testing it would silently hit production.)",
    );
    process.exit(2);
  }
  const marker = JSON.parse(readFileSync(MARKER, "utf8"));
  if (marker.supabaseUrl !== MOCK_URL) {
    console.error("ERROR: .next was not built against the stub. Run with --build.");
    process.exit(2);
  }
}

function startServerAndWait(args, env, readyToken) {
  const child = spawn("npx", args, {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });
  let buf = "";
  child.stdout.on("data", (d) => (buf += d));
  child.stderr.on("data", (d) => (buf += d));
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 120_000;
    const timer = setInterval(() => {
      if (buf.includes(readyToken)) {
        clearInterval(timer);
        resolve({ child, log: () => buf });
      } else if (Date.now() > deadline) {
        clearInterval(timer);
        reject(new Error(`server did not become ready.\n${buf.slice(-4000)}`));
      }
    }, 250);
    child.on("exit", (code) => {
      clearInterval(timer);
      reject(new Error(`server exited early (${code}).\n${buf.slice(-4000)}`));
    });
  });
}

async function probe(path, { auth = false } = {}) {
  const headers = { "user-agent": "sourcebd-http-guard/1.0" };
  if (auth) headers.cookie = buildAuthCookieHeader();
  const res = await fetch(`${APP_URL}${path}`, {
    redirect: "manual",
    headers,
  });
  const text = await res.text();
  return {
    status: res.status,
    location: res.headers.get("location"),
    bytes: text.length,
  };
}

const CASES = [
  {
    name: "marketing: missing slug -> 404",
    path: `/suppliers/${MISSING}`,
    expect: { status: 404 },
  },
  {
    name: "marketing: unpublished non-facility slug -> 404",
    path: `/suppliers/${UNPUBLISHED}`,
    expect: { status: 404 },
  },
  {
    name: "marketing: facility slug -> 308 to mother",
    path: `/suppliers/${FACILITY}`,
    expect: { status: 308, locationSuffix: `/suppliers/${MOTHER}` },
  },
  {
    name: "marketing: published slug -> 200",
    path: `/suppliers/${MOTHER}`,
    expect: { status: 200 },
  },
  {
    name: "app: missing slug -> 404 (authenticated)",
    path: `/app/suppliers/${MISSING}`,
    auth: true,
    expect: { status: 404 },
  },
  {
    name: "app: unpublished non-facility slug -> 404 (authenticated)",
    path: `/app/suppliers/${UNPUBLISHED}`,
    auth: true,
    expect: { status: 404 },
  },
  {
    name: "app: facility slug -> 308 to mother (authenticated)",
    path: `/app/suppliers/${FACILITY}`,
    auth: true,
    expect: { status: 308, locationSuffix: `/app/suppliers/${MOTHER}` },
  },
  {
    name: "app: published slug -> 200 (authenticated)",
    path: `/app/suppliers/${MOTHER}`,
    auth: true,
    expect: { status: 200 },
  },
  {
    name: "app: anonymous still gated -> 307 to /login",
    path: `/app/suppliers/${MOTHER}`,
    expect: { status: 307, locationIncludes: "/login" },
  },
];

async function main() {
  const mode = process.argv.includes("--build")
    ? "build"
    : process.argv.includes("--dev")
      ? "dev"
      : "reuse";

  // Pre-clean: a previous run's server can outlive its npx shim.
  await killPortOwner(APP_PORT);
  const mock = await startMock();
  let server = null;
  let failures = 0;
  try {
    if (mode === "build") {
      await runGuardBuild();
    } else if (mode === "reuse") {
      checkGuardBuild();
    }
    if (mode === "dev") {
      server = await startServerAndWait(
        ["next", "dev", "-p", String(APP_PORT)],
        stubEnv(),
        "Ready",
      );
    } else {
      const buildId = readFileSync(join(ROOT, ".next", "BUILD_ID"), "utf8").trim();
      console.log(`testing build ${buildId}`);
      server = await startServerAndWait(
        ["next", "start", "-p", String(APP_PORT)],
        stubEnv(),
        "Ready",
      );
    }

    for (const c of CASES) {
      const got = await probe(c.path, { auth: c.auth === true });
      const problems = [];
      if (got.status !== c.expect.status) {
        problems.push(`status ${got.status} != ${c.expect.status}`);
      }
      if (c.expect.locationSuffix) {
        const loc = got.location ?? "";
        if (!loc.endsWith(c.expect.locationSuffix)) {
          problems.push(`location ${loc ?? "<none>"} does not end with ${c.expect.locationSuffix}`);
        }
      }
      if (c.expect.locationIncludes) {
        const loc = got.location ?? "";
        if (!loc.includes(c.expect.locationIncludes)) {
          problems.push(`location ${loc ?? "<none>"} missing ${c.expect.locationIncludes}`);
        }
      }
      if (problems.length === 0) {
        console.log(`PASS  ${c.name}  [${got.status}${got.location ? ` -> ${got.location}` : ""}]`);
      } else {
        failures += 1;
        console.log(`FAIL  ${c.name}  — ${problems.join("; ")}`);
      }
    }
  } finally {
    if (server) await killTree(server.child);
    await killPortOwner(APP_PORT);
    mock.destroyAll();
    mock.close();
  }

  if (failures > 0) {
    console.log(`\n${failures} case(s) failed. Stub saw:`);
    for (const line of requestLog) console.log(`  ${line}`);
    process.exit(1);
  }
  console.log(`\nAll ${CASES.length} HTTP-boundary cases passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
