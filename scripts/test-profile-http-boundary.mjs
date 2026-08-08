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
 *   - missing slug                  -> 404 (styled not-found body)
 *   - unpublished non-facility slug -> 404 (RPC miss, no facility mapping)
 *   - unpublished FACILITY slug     -> 308, Location: mother profile
 *   - facility RPC unavailable      -> 404, not 500 (PGRST202: migration
 *     0096 not yet applied — production's state until it is)
 *   - profile RPC statement timeout -> 200 "Service temporarily slow"
 *     (the 57014 branch must not collapse into a misleading 404)
 *   - published slug                -> 200 (happy path intact)
 *   - /app/* without a session      -> 307 to /login (auth gate intact)
 *
 * Scope note (audited and accepted): the status guarantee covers document
 * GET/HEAD requests. RSC client-navigation requests (?_rsc=…) return 200 with
 * the redirect/not-found carried in the flight payload — that is Next's
 * designed client behavior, not the soft-200 this guard exists to kill.
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

import { execSync, spawn } from "node:child_process";
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
const RPC_DOWN = "facility-rpc-unavailable";
const TIMEOUT = "profile-statement-timeout";
const GUARD_TOKEN = "http-guard-access-token";

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
      if (slug === TIMEOUT) {
        // PostgREST shape for a statement timeout (SQLSTATE 57014).
        return json(
          {
            code: "57014",
            details: null,
            hint: null,
            message: "canceling statement due to statement timeout",
          },
          400,
        );
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
      if (slug === RPC_DOWN) {
        // PostgREST shape for "function does not exist" — production's state
        // until migration 0096 is applied.
        return json(
          {
            code: "PGRST202",
            details: null,
            hint: null,
            message:
              "Could not find the function public.facility_parent_slug(p_slug) in the schema cache",
          },
          404,
        );
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
      // Require the exact guard token so the authenticated cases actually
      // prove the app reads and forwards the session token.
      const auth = req.headers.authorization ?? "";
      if (auth !== `Bearer ${GUARD_TOKEN}`) {
        return json({ message: "invalid JWT", code: "invalid_token" }, 401);
      }
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
    access_token: GUARD_TOKEN,
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
    if (process.platform !== "win32") {
      // Children are spawned detached on POSIX, so the server is a process
      // group leader: signal the whole group, else the Next server grandchild
      // outlives the npx shim.
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        try {
          child.kill("SIGTERM");
        } catch {
          // already gone
        }
      }
      return resolve();
    }
    // npx on Windows spawns a cmd shim; kill the whole tree.
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    killer.on("exit", () => resolve());
    killer.on("error", () => resolve());
  });
}

// The Next server can be a grandchild that outlives the npx shim, so also
// kill whatever owns the given port. Windows-only; restricted to node
// processes so a foreign listener is reported, not killed. No-op elsewhere.
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
          ` | ForEach-Object { $p = Get-Process -Id $_ -ErrorAction SilentlyContinue;` +
          ` if ($p -and $p.ProcessName -match '^(node|npx)') { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }`,
      ],
      { stdio: "ignore" },
    );
    ps.on("exit", () => resolve());
    ps.on("error", () => resolve());
  });
}

function gitState() {
  try {
    const sha = execSync("git rev-parse HEAD", { cwd: ROOT }).toString().trim();
    const dirty =
      execSync("git status --porcelain", { cwd: ROOT }).toString().trim().length > 0;
    return { sha, dirty };
  } catch {
    return { sha: null, dirty: true };
  }
}

function runGuardBuild() {
  console.log("building against stub Supabase (this takes several minutes)…");
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "build"], {
      cwd: ROOT,
      env: stubEnv(),
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      detached: process.platform !== "win32",
    });
    let buf = "";
    child.stdout.on("data", (d) => (buf += d));
    child.stderr.on("data", (d) => (buf += d));
    child.on("exit", async (code) => {
      const built = existsSync(join(ROOT, ".next", "BUILD_ID"));
      // `output: "standalone"` fails its symlink copy on Windows (EPERM)
      // AFTER the real build output is written. Tolerate a nonzero exit only
      // for that exact signature; any other failure fails the guard.
      const tail = buf.slice(-4000);
      const standaloneEperm = /EPERM: operation not permitted.*standalone/is.test(tail);
      if (!built || (code !== 0 && !standaloneEperm)) {
        await killTree(child);
        return reject(
          new Error(
            `build failed (exit ${code}, BUILD_ID ${built ? "present" : "missing"}).\n${tail}`,
          ),
        );
      }
      const { sha, dirty } = gitState();
      writeFileSync(
        MARKER,
        JSON.stringify({
          supabaseUrl: MOCK_URL,
          sha,
          dirty,
          builtAt: new Date().toISOString(),
        }),
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
  // Refuse to test a stale artifact: the build reflects the tree it was
  // built from, not the tree that happens to be checked out now.
  const { sha, dirty } = gitState();
  if (!marker.sha || marker.sha !== sha || marker.dirty || dirty) {
    console.error(
      `ERROR: stub-built artifact is stale (built from ${marker.sha ?? "unknown"}` +
        `${marker.dirty ? " + dirty tree" : ""}; now ${sha ?? "unknown"}${dirty ? " + dirty tree" : ""}).\n` +
        "Run with --build to rebuild against the current tree.",
    );
    process.exit(2);
  }
}

function startServerAndWait(args, env, readyToken) {
  const child = spawn("npx", args, {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    detached: process.platform !== "win32",
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

async function probeOnce(path, { auth = false } = {}) {
  const headers = { "user-agent": "sourcebd-http-guard/1.0" };
  if (auth) headers.cookie = buildAuthCookieHeader();
  const res = await fetch(`${APP_URL}${path}`, {
    redirect: "manual",
    headers,
    // Dev-mode cold compiles can take minutes on a loaded machine; the
    // default undici headers timeout would otherwise outwait the harness.
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  return {
    status: res.status,
    location: res.headers.get("location"),
    body: text,
    bytes: text.length,
  };
}

// In --dev mode the first hit on a route pays Next's compile cost; retry
// through it rather than failing the run on a slow compile.
async function probe(path, { auth = false, devMode = false } = {}) {
  const attempts = devMode ? 4 : 1;
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await probeOnce(path, { auth });
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }
  throw lastErr;
}

// Next may emit an absolute Location; compare on the path so the assertion
// is exact about WHERE the redirect lands, not just its suffix.
function normalizeLocation(loc) {
  if (!loc) return null;
  if (loc.startsWith(APP_URL)) return loc.slice(APP_URL.length);
  return loc;
}

const NOT_FOUND_MARKER = "Page not found";
const SLOW_MARKER = "Service temporarily slow";

const CASES = [
  {
    name: "marketing: missing slug -> 404",
    path: `/suppliers/${MISSING}`,
    expect: { status: 404, bodyIncludes: NOT_FOUND_MARKER },
  },
  {
    name: "marketing: unpublished non-facility slug -> 404",
    path: `/suppliers/${UNPUBLISHED}`,
    expect: { status: 404, bodyIncludes: NOT_FOUND_MARKER },
  },
  {
    name: "marketing: facility slug -> 308 to mother",
    path: `/suppliers/${FACILITY}`,
    expect: { status: 308, location: `/suppliers/${MOTHER}` },
  },
  {
    name: "marketing: facility RPC unavailable -> 404, not 500",
    path: `/suppliers/${RPC_DOWN}`,
    expect: { status: 404, bodyIncludes: NOT_FOUND_MARKER },
  },
  {
    name: "marketing: profile timeout -> 200 slow card",
    path: `/suppliers/${TIMEOUT}`,
    expect: { status: 200, bodyIncludes: SLOW_MARKER },
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
    expect: { status: 404, bodyIncludes: NOT_FOUND_MARKER },
  },
  {
    name: "app: unpublished non-facility slug -> 404 (authenticated)",
    path: `/app/suppliers/${UNPUBLISHED}`,
    auth: true,
    expect: { status: 404, bodyIncludes: NOT_FOUND_MARKER },
  },
  {
    name: "app: facility slug -> 308 to mother (authenticated)",
    path: `/app/suppliers/${FACILITY}`,
    auth: true,
    expect: { status: 308, location: `/app/suppliers/${MOTHER}` },
  },
  {
    name: "app: facility RPC unavailable -> 404, not 500 (authenticated)",
    path: `/app/suppliers/${RPC_DOWN}`,
    auth: true,
    expect: { status: 404, bodyIncludes: NOT_FOUND_MARKER },
  },
  {
    name: "app: profile timeout -> 200 slow card (authenticated)",
    path: `/app/suppliers/${TIMEOUT}`,
    auth: true,
    expect: { status: 200, bodyIncludes: SLOW_MARKER },
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

  // Pre-clean: a previous run's server or mock can outlive its npx shim.
  await killPortOwner(APP_PORT);
  await killPortOwner(MOCK_PORT);
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
      const got = await probe(c.path, {
        auth: c.auth === true,
        devMode: mode === "dev",
      });
      const problems = [];
      if (got.status !== c.expect.status) {
        problems.push(`status ${got.status} != ${c.expect.status}`);
      }
      if (c.expect.location) {
        const loc = normalizeLocation(got.location);
        if (loc !== c.expect.location) {
          problems.push(`location ${got.location ?? "<none>"} != ${c.expect.location}`);
        }
      }
      if (c.expect.locationIncludes) {
        const loc = got.location ?? "";
        if (!loc.includes(c.expect.locationIncludes)) {
          problems.push(`location ${loc ?? "<none>"} missing ${c.expect.locationIncludes}`);
        }
      }
      if (c.expect.bodyIncludes) {
        if (!got.body.includes(c.expect.bodyIncludes)) {
          problems.push(`body missing "${c.expect.bodyIncludes}" (${got.bytes} bytes)`);
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
    await killPortOwner(MOCK_PORT);
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
