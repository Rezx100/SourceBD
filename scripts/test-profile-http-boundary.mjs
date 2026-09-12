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
 *   - profile RPC statement timeout -> 307 to /temporarily-slow with
 *     private, no-store (not a 404; not s-maxage). Retry POST then
 *     recovers to 200 once the stub returns a pack. HS/facility-only
 *     57014 stays 200 on the factory URL.
 *   - published slug                -> 200 (happy path intact)
 *   - /app/* without a session      -> 307 to /login (auth gate intact)
 *
 * Scope note (audited and accepted): the status guarantee covers document
 * GET requests (probes issue GET only). RSC client-navigation requests
 * (?_rsc=…) return 200 with the redirect/not-found carried in the flight
 * payload — that is Next's designed client behavior, not the soft-200 this
 * guard exists to kill.
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
 *                                                         # --build artifact;
 *                                                         # refuses unless the
 *                                                         # tree content is
 *                                                         # identical to the
 *                                                         # built state
 *
 * No production resources are touched: the app under test is pointed at a
 * local stub that answers the exact RPC/REST/auth calls the routes make.
 */

import { execSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import http from "node:http";
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const MOCK_PORT = 8901;
const APP_PORT = 3100;
const MOCK_URL = `http://localhost:${MOCK_PORT}`;
const APP_URL = `http://localhost:${APP_PORT}`;
const SITE_ORIGIN = "https://sourcebd.net";
const MARKER = join(ROOT, ".next", "http-guard-env.json");

const MOTHER = "mother-company-ltd";
const ASSOCIATE_ONLY = "ocean-cross-international";
const UNRESOLVED_BGMEA = "unresolved-bgmea-supplier";
const HABITUS = "habitus-fashion";
const FAKHRUDDIN = "fakhruddin-textile-mills";
const FACILITY = "mother-company-ltd-extension";
const MISSING = "this-slug-cannot-possibly-exist-http-guard";
const UNPUBLISHED = "unpublished-plain-supplier-ltd";
const RPC_DOWN = "facility-rpc-unavailable";
const TIMEOUT = "profile-statement-timeout";
const TIMEOUT_OVERLAP = "profile-statement-timeout-overlap";
const HS_TIMEOUT = "hs-codes-statement-timeout";
const HS_TIMEOUT_IN_DATA = "hs-codes-timeout-in-data";
const FACILITY_TIMEOUT = "facility-panel-statement-timeout";
const PARENT_TIMEOUT = "parent-lookup-statement-timeout";
const PARENT_TIMEOUT_IN_DATA = "parent-lookup-timeout-in-data";
const TIMEOUT_IN_DATA = "profile-timeout-in-data";
const OVERVIEW_TIMEOUT = "overview-statement-timeout";
const STALE_SUCCESS = "inflight-success-then-timeout";
const SELF = "self-parented-ltd";
const GUARD_TOKEN = "http-guard-access-token";
let timeoutRecovered = false;
let overlapRecovered = false;
let timeoutOverlapHoldMs = 0;
const overlapProfileOutcomes = [];
let overviewRecovered = false;
let overviewHoldMs = 0;
const overviewProfileOutcomes = [];
let motherCompanyName = "Mother Company Ltd";
let staleSuccessPhase = "success";
let staleSuccessHoldMs = 0;

const STATEMENT_TIMEOUT = {
  code: "57014",
  details: null,
  hint: null,
  message: "canceling statement due to statement timeout",
};

const requestLog = [];
const PROFILE_RPC = "POST /rest/v1/rpc/buyer_supplier_profile";
const FACILITY_RPC = "POST /rest/v1/rpc/buyer_supplier_facility_panel";
const HS_RPC = "POST /rest/v1/rpc/supplier_epb_hscodes";
const PARENT_RPC = "POST /rest/v1/rpc/facility_parent_slug";
const PACK_RPCS = [PROFILE_RPC, FACILITY_RPC, HS_RPC];
const MISS_RPCS = [PROFILE_RPC, PARENT_RPC];

function rpcCount(line) {
  return requestLog.filter((l) => l === line).length;
}

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
  pills: [
    {
      source_code: "BGMEA",
      label: "BGMEA General member #",
      value: "1",
      verified: true,
      source_url: "https://www.bgmea.com.bd/member/951",
      inherited_from: null,
      inherited_from_name: null,
    },
  ],
  certifications: [],
  rsc_remediation: null,
  brand_attributions: [],
  sanctions: [],
  provenance: [],
  addresses: [],
  documents: [],
};

const ASSOCIATE_PAYLOAD = {
  ...HAPPY_PAYLOAD,
  supplier: {
    ...HAPPY_PAYLOAD.supplier,
    slug: ASSOCIATE_ONLY,
    company_name: "Ocean Cross International",
  },
  pills: [
    {
      source_code: "BGMEA",
      label: "BGMEA Associate member #",
      value: "1",
      verified: true,
      source_url: null,
      inherited_from: null,
      inherited_from_name: null,
    },
  ],
};

const UNRESOLVED_PAYLOAD = {
  ...HAPPY_PAYLOAD,
  supplier: {
    ...HAPPY_PAYLOAD.supplier,
    slug: UNRESOLVED_BGMEA,
    company_name: "Unresolved BGMEA Supplier",
  },
  // Production 0101 omits BGMEA pills when member_type is unknown — no Verified badge.
  pills: [],
};

const HABITUS_PAYLOAD = {
  ...HAPPY_PAYLOAD,
  supplier: {
    ...HAPPY_PAYLOAD.supplier,
    slug: HABITUS,
    company_name: "HABITUS FASHION LIMITED",
  },
  addresses: [
    {
      kind: "factory",
      address: "Gajaria Para, Kauitis\nGazipur\nGazipur",
      source_code: "BGMEA",
      fetched_at: "2026-07-24T06:42:34.407591Z",
    },
    {
      kind: "factory",
      address: "GAJARIA PARA, BHAWAL MIRZAPUR, GAZIPUR SADAR, GAZIPUR, SADAR, GAZIPUR",
      source_code: "BKMEA",
      fetched_at: "2026-08-02T05:04:41.110702Z",
    },
    {
      kind: "factory",
      address: "Gojariapara, Vhawal Mirzapur, Gazipur Sadar PS, Gazipur - 1703, Bangladesh",
      source_code: "OEKO_TEX",
      fetched_at: "2026-06-27T02:28:59.512381Z",
    },
    {
      kind: "mailing",
      address: "Fakir Khali Road, Boro Beraid, Badda\nDhaka\nDhaka",
      source_code: "BGMEA",
      fetched_at: "2026-07-24T06:42:34.407591Z",
    },
    {
      kind: "mailing",
      address: "FOKIRKHALI ROAD, BORO BERAID, BADDA, DHAKA, BADDA, DHAKA",
      source_code: "BKMEA",
      fetched_at: "2026-08-02T05:04:41.110702Z",
    },
  ],
};

const FAKHRUDDIN_PAYLOAD = {
  ...HAPPY_PAYLOAD,
  supplier: {
    ...HAPPY_PAYLOAD.supplier,
    slug: FAKHRUDDIN,
    company_name: "FAKHRUDDIN TEXTILE MILLS LTD.",
  },
  addresses: [
    {
      kind: "factory",
      address: "Kewa, Ghorgaria, Master Bari, Sreepur\nGazipur\nGazipur",
      source_code: "BGMEA",
      fetched_at: "2026-07-24T06:25:10.876Z",
    },
    {
      kind: "factory",
      address: "MOUZA KEWA, SREEPUR, GAZIPUR",
      source_code: "BKMEA",
      fetched_at: "2026-08-02T03:02:29.550386Z",
    },
    {
      kind: "factory",
      address: "Ghargaria Master Bari, Kewa, Sreepur, Gazipur - 1740, Bangladesh",
      source_code: "OEKO_TEX",
      fetched_at: "2026-06-27T02:27:01.510678Z",
    },
    {
      kind: "mailing",
      address: "235/B, Bir Uttam Mir Sawkat Sarak, Tejgaon I/A\nDhaka\nDhaka",
      source_code: "BGMEA",
      fetched_at: "2026-07-24T06:25:10.876Z",
    },
    {
      kind: "mailing",
      address: "235/B, TEJGAON I/A-1208, TEJGAON, DHAKA",
      source_code: "BKMEA",
      fetched_at: "2026-08-02T03:02:29.550386Z",
    },
  ],
};

/** REZ-73/109 — mother facility panel shape from buyer_supplier_facility_panel. */
const HAPPY_FACILITY_PANEL = {
  facility_count: 1,
  facilities: [
    {
      name: "Mother Company Ltd Extension",
      slug: "secret-facility-slug",
      phone: "+8801",
      email: "leak@example.com",
      addresses: [
        {
          kind: "factory",
          address: "Plot 1, Gazipur",
          source_code: "RSC",
        },
      ],
      pills: [
        {
          source_code: "RSC",
          label: "RSC ID",
          value: "99999",
          verified: true,
          source_url: "https://www.rsc-bd.org/",
        },
      ],
      rsc: {
        progress_pct: 80,
        workers_count: 500,
        remediation_status: "ontrack",
        training_status: null,
      },
    },
  ],
  group: {
    employees_total: {
      own: 1200,
      known_sum: 1200,
      facility_count: 1,
      building_count: 2,
      unknown_count: 1,
    },
    machines_sewing: {
      own: 400,
      known_sum: 450,
      facility_count: 1,
      building_count: 2,
      unknown_count: 0,
    },
    production_capacity_pcs_day: {
      own: 5000,
      known_sum: 6000,
      facility_count: 1,
      building_count: 2,
      unknown_count: 0,
    },
    production_capacity_dozen_yearly: {
      own: null,
      known_sum: null,
      facility_count: 1,
      building_count: 2,
      unknown_count: 2,
    },
  },
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
        if (timeoutRecovered) {
          return json({
            ...HAPPY_PAYLOAD,
            supplier: {
              ...HAPPY_PAYLOAD.supplier,
              slug: TIMEOUT,
              company_name: "Recovered Timeout Ltd",
            },
          });
        }
        return json(STATEMENT_TIMEOUT, 400);
      }
      if (slug === TIMEOUT_IN_DATA) {
        return json(STATEMENT_TIMEOUT, 200);
      }
      if (slug === OVERVIEW_TIMEOUT) {
        const recoveredAtStart = overviewRecovered;
        overviewProfileOutcomes.push(recoveredAtStart ? "recovered" : "57014");
        const hold = overviewHoldMs;
        overviewHoldMs = 0;
        const respond = () => {
          if (recoveredAtStart) {
            return json({
              ...HAPPY_PAYLOAD,
              supplier: {
                ...HAPPY_PAYLOAD.supplier,
                slug: OVERVIEW_TIMEOUT,
                company_name: "Recovered Overview Ltd",
              },
            });
          }
          return json(STATEMENT_TIMEOUT, 400);
        };
        if (hold > 0) {
          setTimeout(respond, hold);
          return;
        }
        return respond();
      }
      if (slug === STALE_SUCCESS) {
        const phaseAtStart = staleSuccessPhase;
        const respond = () => {
          if (phaseAtStart === "success") {
            return json({
              ...HAPPY_PAYLOAD,
              supplier: {
                ...HAPPY_PAYLOAD.supplier,
                slug: STALE_SUCCESS,
                company_name: "Stale Success Ltd",
              },
            });
          }
          return json(STATEMENT_TIMEOUT, 400);
        };
        if (phaseAtStart === "success" && staleSuccessHoldMs > 0) {
          const hold = staleSuccessHoldMs;
          staleSuccessHoldMs = 0;
          setTimeout(respond, hold);
          return;
        }
        return respond();
      }
      if (slug === TIMEOUT_OVERLAP) {
        const recoveredAtStart = overlapRecovered;
        overlapProfileOutcomes.push(recoveredAtStart ? "recovered" : "57014");
        const respond = () => {
          if (recoveredAtStart) {
            return json({
              ...HAPPY_PAYLOAD,
              supplier: {
                ...HAPPY_PAYLOAD.supplier,
                slug: TIMEOUT_OVERLAP,
                company_name: "Recovered Overlap Ltd",
              },
            });
          }
          return json(STATEMENT_TIMEOUT, 400);
        };
        if (!recoveredAtStart && timeoutOverlapHoldMs > 0) {
          const hold = timeoutOverlapHoldMs;
          timeoutOverlapHoldMs = 0;
          setTimeout(respond, hold);
          return;
        }
        return respond();
      }
      if (slug === HS_TIMEOUT || slug === HS_TIMEOUT_IN_DATA) {
        return json({
          ...HAPPY_PAYLOAD,
          supplier: {
            ...HAPPY_PAYLOAD.supplier,
            slug,
            company_name:
              slug === HS_TIMEOUT_IN_DATA
                ? "HS Timeout In Data Ltd"
                : "HS Timeout Ltd",
          },
        });
      }
      if (slug === FACILITY_TIMEOUT) {
        return json({
          ...HAPPY_PAYLOAD,
          supplier: {
            ...HAPPY_PAYLOAD.supplier,
            slug: FACILITY_TIMEOUT,
            company_name: "Facility Timeout Ltd",
          },
        });
      }
      if (slug === MOTHER) {
        return json({
          ...HAPPY_PAYLOAD,
          supplier: {
            ...HAPPY_PAYLOAD.supplier,
            company_name: motherCompanyName,
          },
        });
      }
      if (slug === ASSOCIATE_ONLY) return json(ASSOCIATE_PAYLOAD);
      if (slug === UNRESOLVED_BGMEA) return json(UNRESOLVED_PAYLOAD);
      if (slug === HABITUS) return json(HABITUS_PAYLOAD);
      if (slug === FAKHRUDDIN) return json(FAKHRUDDIN_PAYLOAD);
      return json(null);
    }
    if (url.pathname === "/rest/v1/rpc/supplier_epb_hscodes") {
      let slug = null;
      try {
        slug = JSON.parse(body || "{}").p_slug ?? null;
      } catch {
        slug = null;
      }
      if (slug === HS_TIMEOUT) {
        return json(STATEMENT_TIMEOUT, 400);
      }
      if (slug === HS_TIMEOUT_IN_DATA) {
        return json(STATEMENT_TIMEOUT, 200);
      }
      if (
        slug === MOTHER ||
        slug === FACILITY_TIMEOUT ||
        slug === STALE_SUCCESS ||
        (slug === TIMEOUT && timeoutRecovered) ||
        (slug === TIMEOUT_OVERLAP && overlapRecovered) ||
        (slug === OVERVIEW_TIMEOUT && overviewRecovered)
      ) {
        return json([
          {
            code: "6103",
            description: "Men's or boys' suits",
            source_url: "https://edb.epb.gov.bd/hscode-exporters/813",
          },
        ]);
      }
      return json([]);
    }
    if (url.pathname === "/rest/v1/rpc/buyer_supplier_facility_panel") {
      let slug = null;
      try {
        slug = JSON.parse(body || "{}").p_slug ?? null;
      } catch {
        slug = null;
      }
      if (slug === FACILITY_TIMEOUT) {
        return json(STATEMENT_TIMEOUT, 200);
      }
      if (
        slug === MOTHER ||
        slug === HS_TIMEOUT ||
        slug === HS_TIMEOUT_IN_DATA ||
        slug === STALE_SUCCESS ||
        (slug === TIMEOUT && timeoutRecovered) ||
        (slug === TIMEOUT_OVERLAP && overlapRecovered) ||
        (slug === OVERVIEW_TIMEOUT && overviewRecovered)
      ) {
        return json(HAPPY_FACILITY_PANEL);
      }
      return json(null);
    }
    if (url.pathname === "/rest/v1/rpc/facility_parent_slug") {
      let slug = null;
      try {
        slug = JSON.parse(body || "{}").p_slug ?? null;
      } catch {
        slug = null;
      }
      if (slug === PARENT_TIMEOUT) {
        return json(STATEMENT_TIMEOUT, 400);
      }
      if (slug === PARENT_TIMEOUT_IN_DATA) {
        return json(STATEMENT_TIMEOUT, 200);
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
      if (slug === SELF) {
        // A row whose facility_of points at itself: the RPC echoes the
        // requested slug. The route must treat that as no mapping (404),
        // never a 308 to its own URL.
        return json(SELF);
      }
      return json(slug === FACILITY ? MOTHER : null);
    }
    if (url.pathname === "/rest/v1/rpc/discover_suppliers") {
      return json([
        {
          id: "00000000-0000-4000-8000-000000000099",
          slug: OVERVIEW_TIMEOUT,
          company_name: "Overview Timeout Ltd",
          employees_total: 100,
        },
        {
          id: "00000000-0000-4000-8000-000000000098",
          slug: MOTHER,
          company_name: "Mother Company Ltd",
          employees_total: 1200,
        },
      ]);
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
    NEXT_PUBLIC_SITE_URL: "",
    NEXT_PUBLIC_APP_URL: "",
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
          ` if ($p -and $p.ProcessName -eq 'node') { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }`,
      ],
      { stdio: "ignore" },
    );
    ps.on("exit", () => resolve());
    ps.on("error", () => resolve());
  });
}

// A content fingerprint of everything the build could read: HEAD SHA, the
// porcelain status, the full tracked diff, and the content of untracked
// files under bundle roots (the file-system router picks up new route files
// with no tracked reference, so their bytes must move the fingerprint too).
// Comparing this BEFORE and AFTER the build watches the whole build window:
// a mid-build commit, edit, edit-revert-to-different-content, or untracked
// route file appearing all change the fingerprint and void the evidence.
function treeState() {
  try {
    const opts = { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 };
    const sha = execSync("git rev-parse HEAD", opts).toString().trim();
    const porcelain = execSync("git status --porcelain -uall", opts).toString();
    const trackedDiff = execSync("git diff HEAD", opts).toString();
    const hash = createHash("sha256");
    hash.update(porcelain);
    hash.update("\0");
    hash.update(trackedDiff);
    for (const line of porcelain.split("\n")) {
      const m = line.match(/^\?\? (.+)$/);
      if (!m) continue;
      const p = m[1].trim().replace(/^"|"$/g, "");
      if (!/^(app|components|lib|public)\//.test(p)) continue;
      try {
        if (statSync(join(ROOT, p)).isDirectory()) continue;
        hash.update("\0" + p + "\0");
        hash.update(readFileSync(join(ROOT, p)));
      } catch {
        // Vanished mid-read: the porcelain half of the fingerprint already
        // moved, so the comparison still fails closed.
      }
    }
    return { sha, treeHash: hash.digest("hex"), dirty: porcelain.trim().length > 0 };
  } catch {
    return { sha: null, treeHash: null, dirty: true };
  }
}

function runGuardBuild() {
  console.log("building against stub Supabase (this takes several minutes)…");
  const before = treeState();
  // A previous run's Retry can leave a FETCH entry for the timeout slug
  // as a successful factory pack. next build does not always wipe that.
  rmSync(join(ROOT, ".next", "cache"), { recursive: true, force: true });
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
      const after = treeState();
      if (!before.sha || before.sha !== after.sha || before.treeHash !== after.treeHash) {
        await killTree(child);
        return reject(
          new Error(
            "the tree changed while the guard build was running " +
              `(sha ${before.sha ?? "?"} -> ${after.sha ?? "?"}); ` +
              "the artifact cannot be tied to any candidate. Rebuild on a settled tree.",
          ),
        );
      }
      writeFileSync(
        MARKER,
        JSON.stringify({
          supabaseUrl: MOCK_URL,
          sha: after.sha,
          treeHash: after.treeHash,
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
  // Refuse to test a stale artifact: the build reflects the exact tree
  // content it was built from, not the tree that happens to be here now.
  const now = treeState();
  if (!marker.sha || marker.sha !== now.sha || marker.treeHash !== now.treeHash) {
    console.error(
      `ERROR: stub-built artifact is stale (built from sha ${marker.sha ?? "unknown"}; ` +
        `now ${now.sha ?? "unknown"}, tree content ${marker.treeHash === now.treeHash ? "unchanged" : "differs"}).\n` +
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
    cacheControl: res.headers.get("cache-control"),
    setCookie: res.headers.get("set-cookie"),
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

function rawRequest(method, pathname, { headers, body } = {}) {
  const bodyBuf = body == null ? null : Buffer.from(body);
  const u = new URL(APP_URL);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: pathname,
        method,
        headers: {
          ...headers,
          ...(bodyBuf ? { "content-length": String(bodyBuf.length) } : {}),
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            location: res.headers.location ?? null,
            cacheControl: res.headers["cache-control"] ?? null,
          });
        });
      },
    );
    req.on("error", reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

function rawPost(pathname, { headers, body }) {
  return rawRequest("POST", pathname, { headers, body });
}

// Next may emit an absolute Location; compare on the path so the assertion
// is exact about WHERE the redirect lands, not just its suffix.
// force-static + permanentRedirect can emit the same Location twice; the
// Fetch API joins those into "a, a". Same destination twice is still that
// destination. Two different destinations must not pass.
function firstLocation(loc) {
  if (!loc) return null;
  return loc.split(",")[0].trim();
}

function normalizeLocation(loc) {
  if (!loc) return null;
  const parts = loc.split(",").map((piece) => {
    const trimmed = piece.trim();
    if (trimmed.startsWith(APP_URL)) return trimmed.slice(APP_URL.length);
    if (trimmed.startsWith(SITE_ORIGIN)) return trimmed.slice(SITE_ORIGIN.length);
    return trimmed;
  });
  const unique = [...new Set(parts)];
  if (unique.length === 1) return unique[0] ?? null;
  return loc;
}

function assertPrivateNoStore(cc, problems, label) {
  const value = cc ?? "";
  if (!/private,\s*no-store/.test(value)) {
    problems.push(
      `${label}: Cache-Control ${value || "<none>"} missing private, no-store`,
    );
  }
  if (/s-maxage=[1-9]/.test(value)) {
    problems.push(`${label}: Cache-Control ${value} has s-maxage`);
  }
}

function assertSmaxage300(cc, problems, label) {
  if (!/s-maxage=300/.test(cc ?? "")) {
    problems.push(
      `${label}: Cache-Control ${cc || "<none>"} missing s-maxage=300`,
    );
  }
  if (/no-store|\bprivate\b|\bno-cache\b/.test(cc ?? "")) {
    problems.push(
      `${label}: Cache-Control ${cc || "<none>"} is not CDN-reusable`,
    );
  }
}

function productionTreeHas(dir, needle) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".cache") {
      continue;
    }
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (productionTreeHas(p, needle)) return true;
    } else if (
      /\.(ts|tsx|js|mjs)$/.test(name) &&
      !/\.test\.(ts|tsx|js)$/.test(name)
    ) {
      if (readFileSync(p, "utf8").includes(needle)) return true;
    }
  }
  return false;
}

function assertAbsoluteOnSite(loc, { pathname, search }, problems, label) {
  const first = firstLocation(loc);
  if (!first || !/^https?:\/\//i.test(first)) {
    problems.push(`${label}: Location ${loc || "<none>"} is not absolute`);
    return;
  }
  let parsed = null;
  try {
    parsed = new URL(first);
  } catch {
    parsed = null;
  }
  if (!parsed) {
    problems.push(`${label}: Location ${first} is not a URL`);
    return;
  }
  if (parsed.origin !== SITE_ORIGIN) {
    problems.push(
      `${label}: Location origin ${parsed.origin} != ${SITE_ORIGIN}`,
    );
  }
  if (/evil\.example/i.test(parsed.host)) {
    problems.push(`${label}: Location host ${parsed.host} is off-site`);
  }
  if (parsed.pathname !== pathname) {
    problems.push(`${label}: Location path ${parsed.pathname} != ${pathname}`);
  }
  if (search != null && parsed.search !== search) {
    problems.push(
      `${label}: Location search ${parsed.search} != ${search}`,
    );
  }
}

const NOT_FOUND_MARKER = "Page not found";
const SLOW_MARKER = "Service temporarily slow";

const CASES = [
  {
    name: "public: missing slug -> 404",
    path: `/suppliers/${MISSING}`,
    expect: {
      status: 404,
      bodyIncludes: NOT_FOUND_MARKER,
      replayMustNotRpc: MISS_RPCS,
    },
  },
  {
    name: "public: unpublished non-facility slug -> 404",
    path: `/suppliers/${UNPUBLISHED}`,
    expect: {
      status: 404,
      bodyIncludes: NOT_FOUND_MARKER,
      replayMustNotRpc: MISS_RPCS,
    },
  },
  {
    name: "public: facility slug -> 308 to mother",
    path: `/suppliers/${FACILITY}`,
    expect: {
      status: 308,
      location: `/suppliers/${MOTHER}`,
      locationMustBeAbsolute: true,
      locationOrigin: SITE_ORIGIN,
      replayMustNotRpc: MISS_RPCS,
    },
  },
  {
    name: "public: facility RPC unavailable -> 404, not 500",
    path: `/suppliers/${RPC_DOWN}`,
    expect: { status: 404, bodyIncludes: NOT_FOUND_MARKER },
  },
  {
    name: "public: parent-lookup timeout on a miss -> 307 slow page, not 500",
    path: `/suppliers/${PARENT_TIMEOUT}`,
    expect: {
      status: 307,
      location: `/temporarily-slow?slug=${PARENT_TIMEOUT}`,
      locationMustBeAbsolute: true,
      locationOrigin: SITE_ORIGIN,
      cacheControlOnAllHits: true,
      cacheControlMustMatch: /private,\s*no-store/,
      cacheControlMustNotMatch: /s-maxage=[1-9]/,
    },
  },
  {
    name: "public: parent-lookup timeout in data (HTTP 200 body) -> 307 slow page",
    path: `/suppliers/${PARENT_TIMEOUT_IN_DATA}`,
    expect: {
      status: 307,
      location: `/temporarily-slow?slug=${PARENT_TIMEOUT_IN_DATA}`,
      locationMustBeAbsolute: true,
      locationOrigin: SITE_ORIGIN,
      cacheControlOnAllHits: true,
      cacheControlMustMatch: /private,\s*no-store/,
      cacheControlMustNotMatch: /s-maxage=[1-9]/,
    },
  },
  {
    name: "public: profile timeout -> 307 to uncached slow page",
    path: `/suppliers/${TIMEOUT}`,
    expect: {
      status: 307,
      location: `/temporarily-slow?slug=${TIMEOUT}`,
      locationMustBeAbsolute: true,
      locationOrigin: SITE_ORIGIN,
      cacheControlOnAllHits: true,
      cacheControlMustMatch: /private,\s*no-store/,
      cacheControlMustNotMatch: /s-maxage=[1-9]/,
      replayMustNotRpc: PACK_RPCS,
    },
  },
  {
    name: "public: profile timeout in data (HTTP 200 body) -> 307 slow page",
    path: `/suppliers/${TIMEOUT_IN_DATA}`,
    expect: {
      status: 307,
      location: `/temporarily-slow?slug=${TIMEOUT_IN_DATA}`,
      locationMustBeAbsolute: true,
      locationOrigin: SITE_ORIGIN,
      cacheControlOnAllHits: true,
      cacheControlMustMatch: /private,\s*no-store/,
      cacheControlMustNotMatch: /s-maxage=[1-9]/,
    },
  },
  {
    // Status 200 + slow title + Retry form is the missing-company
    // counterexample. Do not bodyExcludes "Page not found": Next embeds
    // app/not-found.tsx in the RSC payload of successful documents.
    name: "public: timeout destination -> 200 slow card, not CDN-cached",
    path: `/temporarily-slow?slug=${TIMEOUT}`,
    expect: {
      status: 200,
      bodyIncludes: SLOW_MARKER,
      bodyIncludesAll: [
        "Retry",
        'action="/temporarily-slow/retry"',
        'method="POST"',
        'name="slug"',
        `value="${TIMEOUT}"`,
        "<title>Service temporarily slow",
      ],
      bodyExcludes: ["?retry=1"],
      cacheControlOnAllHits: true,
      cacheControlMustMatch: /private,\s*no-store/,
      cacheControlMustNotMatch: /s-maxage=[1-9]/,
    },
  },
  {
    name: "public: HS-only timeout -> 200 factory, not a slow-page 307",
    path: `/suppliers/${HS_TIMEOUT}`,
    expect: {
      status: 200,
      bodyIncludes: "HS Timeout Ltd",
      bodyIncludesAll: [
        'data-epb-hscodes-error=""',
        "EPB export products could not load just now.",
      ],
      bodyExcludes: ['data-epb-hscode="6103"', "0 HS code", "0 HS codes"],
      replayCacheControlMustMatch: /s-maxage=300/,
      replayCacheControlMustNotMatch: /no-store|\bprivate\b|\bno-cache\b/,
      replayMustNotRpc: PACK_RPCS,
      hit1MustRpcExact: 1,
    },
  },
  {
    name: "public: HS-only timeout in data (HTTP 200 body) -> 200 factory",
    path: `/suppliers/${HS_TIMEOUT_IN_DATA}`,
    expect: {
      status: 200,
      bodyIncludes: "HS Timeout In Data Ltd",
      bodyIncludesAll: [
        'data-epb-hscodes-error=""',
        "EPB export products could not load just now.",
      ],
      bodyExcludes: ['data-epb-hscode="6103"', "0 HS code", "0 HS codes"],
      replayCacheControlMustMatch: /s-maxage=300/,
      replayCacheControlMustNotMatch: /no-store|\bprivate\b|\bno-cache\b/,
      replayMustNotRpc: PACK_RPCS,
      hit1MustRpcExact: 1,
    },
  },
  {
    name: "public: facility-panel-only timeout -> 200 factory, not a 307",
    path: `/suppliers/${FACILITY_TIMEOUT}`,
    expect: {
      status: 200,
      bodyIncludes: "Facility Timeout Ltd",
      bodyIncludesAll: [
        "data-facilities-error",
        "Facilities could not load just now.",
      ],
      bodyExcludes: ["Mother Company Ltd Extension", "0 extension building"],
      replayCacheControlMustMatch: /s-maxage=300/,
      replayCacheControlMustNotMatch: /no-store|\bprivate\b|\bno-cache\b/,
      replayMustNotRpc: PACK_RPCS,
      hit1MustRpcExact: 1,
    },
  },
  {
    name: "public: self-parented slug -> 404, no self-redirect",
    path: `/suppliers/${SELF}`,
    expect: {
      status: 404,
      bodyIncludes: NOT_FOUND_MARKER,
      replayMustNotRpc: MISS_RPCS,
    },
  },
  {
    name: "public: published slug -> 200",
    path: `/suppliers/${MOTHER}`,
    expect: {
      status: 200,
      bodyIncludes: 'data-epb-hscode="6103"',
      replayCacheControlMustMatch: /s-maxage=300/,
      replayCacheControlMustNotMatch: /no-store|\bprivate\b|\bno-cache\b/,
      replayMustNotRpc: PACK_RPCS,
      hit1MustRpcExact: 1,
      mustNotSetCookie: true,
    },
  },
  {
    name: "public: BGMEA General register named + member_id link (REZ-115)",
    path: `/suppliers/${MOTHER}`,
    expect: {
      status: 200,
      bodyIncludesAll: [
        "General member",
        "Verify on BGMEA",
        'href="https://www.bgmea.com.bd/member/951"',
      ],
      bodyExcludes: ['href="https://www.bgmea.com.bd/member/1"'],
    },
  },
  {
    name: "public: Associate BGMEA named and must not deep-link /member (REZ-115)",
    path: `/suppliers/${ASSOCIATE_ONLY}`,
    expect: {
      status: 200,
      bodyIncludesAll: ["Associate member", "1"],
      bodyExcludes: [
        "General member",
        "Verify on BGMEA",
        "https://www.bgmea.com.bd/member/",
      ],
    },
  },
  {
    name: "public: unresolved BGMEA omitted from Verified registry pills (REZ-115)",
    path: `/suppliers/${UNRESOLVED_BGMEA}`,
    expect: {
      status: 200,
      bodyExcludes: [
        "General member",
        "Associate member",
        "Verify on BGMEA",
        "BGMEA General",
        "BGMEA Associate",
      ],
    },
  },
  {
    name: "public: Habitus Fashion factory is one premises with Also recorded as pills",
    path: `/suppliers/${HABITUS}`,
    expect: {
      status: 200,
      bodyIncludesAll: [
        "HABITUS FASHION LIMITED",
        "Also recorded as",
        "data-also-recorded",
        "data-also-recorded-as",
        "data-location-row",
        "data-also-recorded-authorities",
        "Gojariapara",
        "2 unique locations",
        "5 source records",
        "OEKO-TEX",
      ],
      bodyCount: {
        'data-location-group="Factories"': 1,
        'data-location-group="Mailing addresses"': 1,
      },
    },
  },
  {
    name: "public: Fakhruddin Textile Mills factory is one premises with Also recorded as pills",
    path: `/suppliers/${FAKHRUDDIN}`,
    expect: {
      status: 200,
      bodyIncludesAll: [
        "FAKHRUDDIN TEXTILE MILLS",
        "Also recorded as",
        "data-also-recorded",
        "data-also-recorded-as",
        "data-location-row",
        "data-also-recorded-authorities",
        "Mouza Kewa",
        "2 unique locations",
        "5 source records",
        "Kewa",
      ],
      bodyCount: {
        'data-location-group="Factories"': 1,
        'data-location-group="Mailing addresses"': 1,
      },
    },
  },
  {
    name: "public: mother Facilities section + RSC-preferred group workers (REZ-114)",
    path: `/suppliers/${MOTHER}`,
    expect: {
      status: 200,
      // Mother registry 1200 + building RSC 500 → RSC-only sum 500 across 1 of 2
      bodyIncludes: "500 across 1 of 2 sites",
    },
  },
  {
    name: "public: mother Facilities lists extension building name",
    path: `/suppliers/${MOTHER}`,
    expect: {
      status: 200,
      bodyIncludes: "Mother Company Ltd Extension",
    },
  },
  {
    name: "public: mother Facilities shows facility address (REZ-109)",
    path: `/suppliers/${MOTHER}`,
    expect: {
      status: 200,
      bodyIncludes: "Plot 1, Gazipur",
    },
  },
  {
    name: "public: mother Facilities shows facility registry pill (REZ-109)",
    path: `/suppliers/${MOTHER}`,
    expect: {
      status: 200,
      bodyIncludes: "RSC ID 99999",
    },
  },
  {
    name: "public: mother Facilities shows facility RSC progress (REZ-109)",
    path: `/suppliers/${MOTHER}`,
    expect: {
      status: 200,
      bodyIncludes: "80% remediated",
    },
  },
  {
    name: "public: mother Facilities omits facility secrets (REZ-109)",
    path: `/suppliers/${MOTHER}`,
    expect: {
      status: 200,
      bodyExcludes: ["secret-facility-slug", "+8801", "leak@example.com"],
    },
  },
  {
    name: "public: mother Facilities labelled group totals on the wire",
    path: `/suppliers/${MOTHER}`,
    expect: {
      status: 200,
      bodyIncludesAll: [
        "Production workers — group total",
        "Sewing machines — group total",
        "Daily output — group total",
        "Annual output — group total",
        "unknown across 2 buildings, 2 unknown",
      ],
    },
  },
  {
    name: "public: homepage overview timeout is not stored 300s",
    path: "/",
    expect: {
      status: 200,
      mustNotRpcOnAnyHit: [FACILITY_RPC, HS_RPC],
      hit1MustRpcLines: { [PROFILE_RPC]: 1 },
      replayMustNotRpc: [PROFILE_RPC],
      cacheControlOnAllHits: true,
      cacheControlMustMatch: /private,\s*no-store/,
      cacheControlMustNotMatch: /s-maxage=[1-9]/,
      bodyExcludes: [
        "Overview Timeout Ltd",
        "Mother Company Ltd",
        SLOW_MARKER,
        'aria-label="Evidence anatomy"',
        "aria-label='Evidence anatomy'",
      ],
    },
  },
  {
    name: "buyer session: public timeout slug -> app, not slow page",
    path: `/suppliers/${TIMEOUT}`,
    auth: true,
    expect: {
      status: 307,
      location: `/app/suppliers/${TIMEOUT}`,
      locationMustBeAbsolute: true,
      locationOrigin: SITE_ORIGIN,
      cacheControlOnAllHits: true,
      cacheControlMustMatch: /private,\s*no-store/,
      cacheControlMustNotMatch: /s-maxage=[1-9]/,
    },
  },
  {
    name: "buyer session: I-034 published factory -> app, not cached 300s",
    path: `/suppliers/${MOTHER}`,
    auth: true,
    expect: {
      status: 307,
      location: `/app/suppliers/${MOTHER}`,
      locationMustBeAbsolute: true,
      locationOrigin: SITE_ORIGIN,
      cacheControlOnAllHits: true,
      cacheControlMustMatch: /private,\s*no-store/,
      cacheControlMustNotMatch: /s-maxage=[1-9]/,
    },
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
    expect: {
      status: 308,
      location: `/app/suppliers/${MOTHER}`,
      locationMustBeAbsolute: true,
      locationOrigin: SITE_ORIGIN,
    },
  },
  {
    name: "app: facility RPC unavailable -> 404, not 500 (authenticated)",
    path: `/app/suppliers/${RPC_DOWN}`,
    auth: true,
    expect: { status: 404, bodyIncludes: NOT_FOUND_MARKER },
  },
  {
    name: "app: parent-lookup timeout on a miss -> 200 slow card, not 500",
    path: `/app/suppliers/${PARENT_TIMEOUT}`,
    auth: true,
    expect: {
      status: 200,
      bodyIncludes: SLOW_MARKER,
      bodyIncludesAll: ["Retry", `/app/suppliers/${PARENT_TIMEOUT}`],
      cacheControlOnAllHits: true,
      cacheControlMustMatch: /no-store|\bprivate\b/,
      cacheControlMustNotMatch: /s-maxage=[1-9]/,
    },
  },
  {
    name: "app: parent-lookup timeout in data (HTTP 200 body) -> 200 slow card",
    path: `/app/suppliers/${PARENT_TIMEOUT_IN_DATA}`,
    auth: true,
    expect: {
      status: 200,
      bodyIncludes: SLOW_MARKER,
      bodyIncludesAll: ["Retry", `/app/suppliers/${PARENT_TIMEOUT_IN_DATA}`],
      cacheControlOnAllHits: true,
      cacheControlMustMatch: /no-store|\bprivate\b/,
      cacheControlMustNotMatch: /s-maxage=[1-9]/,
    },
  },
  {
    name: "app: facility-panel-only timeout -> 200 with facilities error",
    path: `/app/suppliers/${FACILITY_TIMEOUT}`,
    auth: true,
    expect: {
      status: 200,
      bodyIncludes: "Facility Timeout Ltd",
      bodyIncludesAll: [
        "data-facilities-error",
        "Facilities could not load just now.",
      ],
      bodyExcludes: ["Mother Company Ltd Extension", "0 extension building"],
    },
  },
  {
    name: "app: HS-only timeout -> 200 with HS error",
    path: `/app/suppliers/${HS_TIMEOUT}`,
    auth: true,
    expect: {
      status: 200,
      bodyIncludes: "HS Timeout Ltd",
      bodyIncludesAll: [
        'data-epb-hscodes-error=""',
        "EPB export products could not load just now.",
      ],
      bodyExcludes: ['data-epb-hscode="6103"', "0 HS code", "0 HS codes"],
    },
  },
  {
    name: "app: HS-only timeout in data (HTTP 200 body) -> 200 with HS error",
    path: `/app/suppliers/${HS_TIMEOUT_IN_DATA}`,
    auth: true,
    expect: {
      status: 200,
      bodyIncludes: "HS Timeout In Data Ltd",
      bodyIncludesAll: [
        'data-epb-hscodes-error=""',
        "EPB export products could not load just now.",
      ],
      bodyExcludes: ['data-epb-hscode="6103"', "0 HS code", "0 HS codes"],
    },
  },
  {
    name: "app: profile timeout in data (HTTP 200 body) -> 200 slow card",
    path: `/app/suppliers/${TIMEOUT_IN_DATA}`,
    auth: true,
    expect: {
      status: 200,
      bodyIncludes: SLOW_MARKER,
      bodyIncludesAll: ["Retry", `/app/suppliers/${TIMEOUT_IN_DATA}`],
      cacheControlOnAllHits: true,
      cacheControlMustMatch: /no-store|\bprivate\b/,
      cacheControlMustNotMatch: /s-maxage=[1-9]/,
    },
  },
  {
    name: "app: profile timeout -> 200 slow card (authenticated)",
    path: `/app/suppliers/${TIMEOUT}`,
    auth: true,
    expect: {
      status: 200,
      bodyIncludes: SLOW_MARKER,
      bodyIncludesAll: ["Retry", `/app/suppliers/${TIMEOUT}`],
      cacheControlOnAllHits: true,
      cacheControlMustMatch: /no-store|\bprivate\b/,
      cacheControlMustNotMatch: /s-maxage=[1-9]/,
    },
  },
  {
    name: "app: self-parented slug -> 404, no self-redirect (authenticated)",
    path: `/app/suppliers/${SELF}`,
    auth: true,
    expect: { status: 404, bodyIncludes: NOT_FOUND_MARKER },
  },
  {
    name: "app: published slug -> 200 (authenticated)",
    path: `/app/suppliers/${MOTHER}`,
    auth: true,
    expect: {
      status: 200,
      cacheControlOnAllHits: true,
      cacheControlMustMatch: /no-store|private/,
      cacheControlMustNotMatch: /s-maxage=[1-9]/,
    },
  },
  {
    name: "app: mother Facilities section + RSC-preferred group workers (REZ-114)",
    path: `/app/suppliers/${MOTHER}`,
    auth: true,
    expect: {
      status: 200,
      bodyIncludes: "500 across 1 of 2 sites",
    },
  },
  {
    name: "app: mother Facilities lists extension building name",
    path: `/app/suppliers/${MOTHER}`,
    auth: true,
    expect: {
      status: 200,
      bodyIncludes: "Mother Company Ltd Extension",
    },
  },
  {
    name: "app: mother Facilities shows facility address (REZ-109)",
    path: `/app/suppliers/${MOTHER}`,
    auth: true,
    expect: {
      status: 200,
      bodyIncludes: "Plot 1, Gazipur",
    },
  },
  {
    name: "app: mother Facilities shows facility registry pill (REZ-109)",
    path: `/app/suppliers/${MOTHER}`,
    auth: true,
    expect: {
      status: 200,
      bodyIncludes: "RSC ID 99999",
    },
  },
  {
    name: "app: mother Facilities shows facility RSC progress (REZ-109)",
    path: `/app/suppliers/${MOTHER}`,
    auth: true,
    expect: {
      status: 200,
      bodyIncludes: "80% remediated",
    },
  },
  {
    name: "app: mother Facilities omits facility secrets (REZ-109)",
    path: `/app/suppliers/${MOTHER}`,
    auth: true,
    expect: {
      status: 200,
      bodyExcludes: ["secret-facility-slug", "+8801", "leak@example.com"],
    },
  },
  {
    name: "app: mother Facilities labelled group totals on the wire",
    path: `/app/suppliers/${MOTHER}`,
    auth: true,
    expect: {
      status: 200,
      bodyIncludesAll: [
        "Production workers — group total",
        "Sewing machines — group total",
        "Daily output — group total",
        "Annual output — group total",
        "unknown across 2 buildings, 2 unknown",
      ],
    },
  },
  {
    name: "app: anonymous still gated -> 307 to /login",
    path: `/app/suppliers/${MOTHER}`,
    // Middleware appends ?next=<original>, so assert the exact path and let
    // the query vary.
    expect: { status: 307, locationPath: "/login" },
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
  let extraPassed = 0;
  timeoutRecovered = false;
  overlapRecovered = false;
  timeoutOverlapHoldMs = 0;
  overlapProfileOutcomes.length = 0;
  overviewRecovered = false;
  overviewHoldMs = 0;
  overviewProfileOutcomes.length = 0;
  motherCompanyName = "Mother Company Ltd";
  staleSuccessPhase = "success";
  staleSuccessHoldMs = 0;
  try {
    if (mode === "build") {
      // runGuardBuild fingerprints the tree before and after the build and
      // refuses to tie the artifact to a tree that moved mid-build.
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
      const opts = { auth: c.auth === true, devMode: mode === "dev" };
      const rpcBeforeHit1 = {};
      if (
        typeof c.expect.hit1MustRpcMax === "number" ||
        typeof c.expect.hit1MustRpcExact === "number"
      ) {
        for (const line of PACK_RPCS) {
          rpcBeforeHit1[line] = rpcCount(line);
        }
      }
      if (c.expect.hit1MustRpcLines && typeof c.expect.hit1MustRpcLines === "object") {
        for (const line of Object.keys(c.expect.hit1MustRpcLines)) {
          rpcBeforeHit1[line] = rpcCount(line);
        }
      }
      if (Array.isArray(c.expect.mustNotRpcOnAnyHit)) {
        for (const line of c.expect.mustNotRpcOnAnyHit) {
          rpcBeforeHit1[line] = rpcCount(line);
        }
      }
      const hits = [await probe(c.path, opts)];
      // Second hit: an idempotency pin — the miss path must answer the same
      // status on every request, not just the first. After the public route
      // stopped reading cookies(), hit 2 is also the ISR/CDN replay: a
      // published 200 must not come back as Cache-Control: private, no-store.
      const rpcBeforeReplay = {};
      if (
        Array.isArray(c.expect.replayMustNotRpc) ||
        Array.isArray(c.expect.replayMustRpc)
      ) {
        for (const line of [
          ...(c.expect.replayMustNotRpc ?? []),
          ...(c.expect.replayMustRpc ?? []),
        ]) {
          rpcBeforeReplay[line] = rpcCount(line);
        }
      }
      const hit1RpcProblems = [];
      if (typeof c.expect.hit1MustRpcMax === "number") {
        for (const line of PACK_RPCS) {
          const before = rpcBeforeHit1[line] ?? 0;
          const delta = rpcCount(line) - before;
          if (delta < 1 || delta > c.expect.hit1MustRpcMax) {
            hit1RpcProblems.push(
              `hit 1: ${line} delta ${delta} not in 1..${c.expect.hit1MustRpcMax}`,
            );
          }
        }
      }
      if (typeof c.expect.hit1MustRpcExact === "number") {
        for (const line of PACK_RPCS) {
          const before = rpcBeforeHit1[line] ?? 0;
          const delta = rpcCount(line) - before;
          if (delta !== c.expect.hit1MustRpcExact) {
            hit1RpcProblems.push(
              `hit 1: ${line} delta ${delta} != ${c.expect.hit1MustRpcExact}`,
            );
          }
        }
      }
      if (c.expect.hit1MustRpcLines && typeof c.expect.hit1MustRpcLines === "object") {
        for (const [line, exact] of Object.entries(c.expect.hit1MustRpcLines)) {
          const before = rpcBeforeHit1[line] ?? 0;
          const delta = rpcCount(line) - before;
          if (delta !== exact) {
            hit1RpcProblems.push(`hit 1: ${line} delta ${delta} != ${exact}`);
          }
        }
      }
      hits.push(await probe(c.path, { ...opts, devMode: false }));

      const caseProblems = [...hit1RpcProblems];
      hits.forEach((got, i) => {
        const label = i === 0 ? "hit 1" : "hit 2 (replay)";
        if (got.status !== c.expect.status) {
          caseProblems.push(`${label}: status ${got.status} != ${c.expect.status}`);
        }
        if (c.expect.locationMustBeAbsolute) {
          const first = firstLocation(got.location);
          if (!first || !/^https?:\/\//i.test(first)) {
            caseProblems.push(
              `${label}: Location ${got.location ?? "<none>"} is not absolute`,
            );
          }
        }
        if (c.expect.locationOrigin) {
          const first = firstLocation(got.location);
          let parsed = null;
          try {
            parsed =
              first && /^https?:\/\//i.test(first) ? new URL(first) : null;
          } catch {
            parsed = null;
          }
          if (!parsed || parsed.origin !== c.expect.locationOrigin) {
            caseProblems.push(
              `${label}: Location origin ${got.location ?? "<none>"} != ${c.expect.locationOrigin}`,
            );
          }
        }
        if (c.expect.location) {
          if (c.expect.locationMustBeAbsolute) {
            const q = c.expect.location.indexOf("?");
            const pathname =
              q === -1 ? c.expect.location : c.expect.location.slice(0, q);
            const search = q === -1 ? "" : c.expect.location.slice(q);
            assertAbsoluteOnSite(
              got.location,
              { pathname, search },
              caseProblems,
              label,
            );
          } else {
            const loc = normalizeLocation(got.location);
            if (loc !== c.expect.location) {
              caseProblems.push(
                `${label}: location ${got.location ?? "<none>"} != ${c.expect.location}`,
              );
            }
          }
        }
        if (c.expect.locationPath) {
          const first = firstLocation(got.location);
          let parsed = null;
          try {
            parsed = first && /^https?:\/\//i.test(first) ? new URL(first) : null;
          } catch {
            parsed = null;
          }
          if (
            !parsed ||
            parsed.pathname !== c.expect.locationPath ||
            parsed.origin !== SITE_ORIGIN
          ) {
            caseProblems.push(
              `${label}: location ${got.location ?? "<none>"} is not on-site path ${c.expect.locationPath}`,
            );
          }
        }
        if (c.expect.mustNotSetCookie && got.setCookie) {
          caseProblems.push(`${label}: Set-Cookie ${got.setCookie}`);
        }
        if (c.expect.bodyIncludes && !got.body.includes(c.expect.bodyIncludes)) {
          caseProblems.push(
            `${label}: body missing "${c.expect.bodyIncludes}" (${got.bytes} bytes)`,
          );
        }
        if (Array.isArray(c.expect.bodyIncludesAll)) {
          for (const needle of c.expect.bodyIncludesAll) {
            if (!got.body.includes(needle)) {
              caseProblems.push(
                `${label}: body missing "${needle}" (${got.bytes} bytes)`,
              );
            }
          }
        }
        if (c.expect.bodyCount && typeof c.expect.bodyCount === "object") {
          for (const [needle, n] of Object.entries(c.expect.bodyCount)) {
            const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const gotN = (got.body.match(new RegExp(escaped, "g")) ?? []).length;
            if (gotN !== n) {
              caseProblems.push(
                `${label}: count of "${needle}" is ${gotN} != ${n}`,
              );
            }
          }
        }
        if (Array.isArray(c.expect.bodyExcludes)) {
          for (const needle of c.expect.bodyExcludes) {
            if (got.body.includes(needle)) {
              caseProblems.push(
                `${label}: body must not contain "${needle}"`,
              );
            }
          }
        }
      });
      if (mode !== "dev") {
        const applyCc = (got, label, must, mustNot) => {
          const cc = got?.cacheControl ?? "";
          if (must && !must.test(cc)) {
            caseProblems.push(
              `${label}: Cache-Control ${cc || "<none>"} did not match ${must}`,
            );
          }
          if (mustNot && mustNot.test(cc)) {
            caseProblems.push(
              `${label}: Cache-Control ${cc || "<none>"} matched forbidden ${mustNot}`,
            );
          }
        };
        if (c.expect.cacheControlOnAllHits) {
          hits.forEach((got, i) => {
            applyCc(
              got,
              i === 0 ? "hit 1" : "hit 2 (replay)",
              c.expect.cacheControlMustMatch,
              c.expect.cacheControlMustNotMatch,
            );
          });
        } else if (
          c.expect.replayCacheControlMustMatch ||
          c.expect.replayCacheControlMustNotMatch
        ) {
          applyCc(
            hits[1],
            "hit 2 (replay)",
            c.expect.replayCacheControlMustMatch,
            c.expect.replayCacheControlMustNotMatch,
          );
        }
      }
      if (Array.isArray(c.expect.replayMustNotRpc)) {
        for (const line of c.expect.replayMustNotRpc) {
          const before = rpcBeforeReplay[line] ?? 0;
          const after = rpcCount(line);
          if (after !== before) {
            caseProblems.push(
              `hit 2 (replay): ${line} fired again (${before} -> ${after})`,
            );
          }
        }
      }
      if (Array.isArray(c.expect.replayMustRpc)) {
        for (const line of c.expect.replayMustRpc) {
          const before = rpcBeforeReplay[line] ?? 0;
          const after = rpcCount(line);
          if (after <= before) {
            caseProblems.push(
              `hit 2 (replay): ${line} did not fire again (${before} -> ${after})`,
            );
          }
        }
      }
      if (Array.isArray(c.expect.mustNotRpcOnAnyHit)) {
        for (const line of c.expect.mustNotRpcOnAnyHit) {
          const before = rpcBeforeHit1[line] ?? 0;
          const after = rpcCount(line);
          if (after !== before) {
            caseProblems.push(
              `${line} fired (${before} -> ${after}); homepage must not load the factory pack`,
            );
          }
        }
      }

      if (caseProblems.length === 0) {
        const got = hits[0];
        console.log(`PASS  ${c.name}  [${got.status}${got.location ? ` -> ${got.location}` : ""}]`);
      } else {
        failures += 1;
        console.log(`FAIL  ${c.name}  — ${caseProblems.join("; ")}`);
      }
    }

    const extra = (name, problems) => {
      if (problems.length === 0) {
        console.log(`PASS  ${name}`);
        return 1;
      }
      failures += 1;
      console.log(`FAIL  ${name}  — ${problems.join("; ")}`);
      return 0;
    };

    {
      const problems = [];
      const evil = await fetch(`${APP_URL}/temporarily-slow/retry`, {
        method: "POST",
        redirect: "manual",
        headers: {
          origin: "https://evil.example",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ slug: TIMEOUT }),
        signal: AbortSignal.timeout(120_000),
      });
      if (evil.status !== 403) {
        problems.push(`status ${evil.status} != 403`);
      }
      const still = await probe(`/suppliers/${TIMEOUT}`);
      if (still.status !== 307) {
        problems.push(
          `after foreign Origin POST, GET ${still.status} != 307`,
        );
      }
      extraPassed += extra(
        "public: Retry POST from foreign Origin -> 403, shed still pinned",
        problems,
      );
    }

    {
      const problems = [];
      const missing = await fetch(`${APP_URL}/temporarily-slow/retry`, {
        method: "POST",
        redirect: "manual",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ slug: TIMEOUT }),
        signal: AbortSignal.timeout(120_000),
      });
      if (missing.status !== 403) {
        problems.push(`status ${missing.status} != 403`);
      }
      extraPassed += extra(
        "public: Retry POST without Origin -> 403",
        problems,
      );
    }

    {
      const problems = [];
      const rpcBefore = {};
      for (const line of PACK_RPCS) rpcBefore[line] = rpcCount(line);
      const bypass = await probe(`/suppliers/${TIMEOUT}?retry=1`);
      if (bypass.status !== 307) {
        problems.push(`status ${bypass.status} != 307`);
      }
      assertAbsoluteOnSite(
        bypass.location,
        { pathname: "/temporarily-slow", search: `?slug=${TIMEOUT}` },
        problems,
        "?retry=1",
      );
      if (!/private,\s*no-store/.test(bypass.cacheControl ?? "")) {
        problems.push(
          `Cache-Control ${bypass.cacheControl || "<none>"} missing private, no-store`,
        );
      }
      if (/s-maxage=[1-9]/.test(bypass.cacheControl ?? "")) {
        problems.push(
          `Cache-Control ${bypass.cacheControl} has s-maxage`,
        );
      }
      for (const line of PACK_RPCS) {
        const after = rpcCount(line);
        if (after !== rpcBefore[line]) {
          problems.push(
            `${line} fired (${rpcBefore[line]} -> ${after})`,
          );
        }
      }
      extraPassed += extra(
        "public: GET ?retry=1 while 57014 -> 307, not 500",
        problems,
      );
    }

    {
      const problems = [];
      const head = await fetch(`${APP_URL}/suppliers/${TIMEOUT}`, {
        method: "HEAD",
        redirect: "manual",
        headers: { "user-agent": "sourcebd-http-guard/1.0" },
        signal: AbortSignal.timeout(120_000),
      });
      if (head.status !== 307) {
        problems.push(`status ${head.status} != 307`);
      }
      assertAbsoluteOnSite(
        head.headers.get("location"),
        { pathname: "/temporarily-slow", search: `?slug=${TIMEOUT}` },
        problems,
        "HEAD",
      );
      const cc = head.headers.get("cache-control") ?? "";
      if (!/private,\s*no-store/.test(cc)) {
        problems.push(`Cache-Control ${cc || "<none>"} missing private, no-store`);
      }
      if (/s-maxage=[1-9]/.test(cc)) {
        problems.push(`Cache-Control ${cc} has s-maxage`);
      }
      extraPassed += extra(
        "public: HEAD timeout -> 307 no-store",
        problems,
      );
    }

    {
      const problems = [];
      const form = new URLSearchParams({ slug: TIMEOUT }).toString();
      const spoof = await rawPost("/temporarily-slow/retry", {
        headers: {
          origin: "http://evil.example",
          host: "evil.example",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: form,
      });
      if (spoof.status !== 403) {
        problems.push(`status ${spoof.status} != 403`);
      }
      extraPassed += extra(
        "public: Retry POST Host=evil.example Origin=evil -> 403",
        problems,
      );
    }

    {
      const problems = [];
      const form = new URLSearchParams({ slug: ASSOCIATE_ONLY }).toString();
      const spoof = await rawPost("/temporarily-slow/retry", {
        headers: {
          origin: SITE_ORIGIN,
          host: "evil.example",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: form,
      });
      if (spoof.status !== 303) {
        problems.push(`status ${spoof.status} != 303`);
      }
      assertAbsoluteOnSite(
        spoof.location,
        { pathname: `/suppliers/${ASSOCIATE_ONLY}` },
        problems,
        "Retry 303",
      );
      extraPassed += extra(
        "public: Retry POST Origin=site Host=evil.example stays on site origin",
        problems,
      );
    }

    {
      const problems = [];
      const junk = await fetch(`${APP_URL}/temporarily-slow/retry`, {
        method: "POST",
        redirect: "manual",
        headers: {
          origin: SITE_ORIGIN,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ slug: "//evil.example" }),
        signal: AbortSignal.timeout(120_000),
      });
      if (junk.status !== 303) {
        problems.push(`status ${junk.status} != 303`);
      }
      assertAbsoluteOnSite(
        junk.headers.get("location"),
        { pathname: "/" },
        problems,
        "junk Retry",
      );
      extraPassed += extra(
        "public: Retry POST junk slug -> 303 home, not off-site",
        problems,
      );
    }

    {
      const problems = [];
      overlapProfileOutcomes.length = 0;
      timeoutOverlapHoldMs = 1500;
      const inflight = probe(`/suppliers/${TIMEOUT_OVERLAP}`);
      await new Promise((r) => setTimeout(r, 250));
      overlapRecovered = true;
      const retryRes = await fetch(`${APP_URL}/temporarily-slow/retry`, {
        method: "POST",
        redirect: "manual",
        headers: {
          origin: SITE_ORIGIN,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ slug: TIMEOUT_OVERLAP }),
        signal: AbortSignal.timeout(120_000),
      });
      if (retryRes.status !== 303) {
        problems.push(`Retry POST status ${retryRes.status} != 303`);
      }
      const held = await inflight;
      if (held.status !== 307) {
        problems.push(`held GET status ${held.status} != 307`);
      }
      assertAbsoluteOnSite(
        held.location,
        {
          pathname: "/temporarily-slow",
          search: `?slug=${TIMEOUT_OVERLAP}`,
        },
        problems,
        "held GET",
      );
      assertPrivateNoStore(held.cacheControl, problems, "held GET");
      if (overlapProfileOutcomes[0] !== "57014") {
        problems.push(
          `held PROFILE outcome ${overlapProfileOutcomes[0] ?? "<none>"} != 57014`,
        );
      }
      const recovered = await probe(`/suppliers/${TIMEOUT_OVERLAP}`);
      if (recovered.status !== 200) {
        problems.push(
          `canonical GET after held 57014 status ${recovered.status} != 200`,
        );
      }
      if (!recovered.body.includes("Recovered Overlap Ltd")) {
        problems.push(
          `body missing Recovered Overlap Ltd (${recovered.bytes} bytes)`,
        );
      }
      assertSmaxage300(recovered.cacheControl, problems, "recovered GET");
      timeoutOverlapHoldMs = 0;
      extraPassed += extra(
        "public: Retry overlapping in-flight 57014 still recovers",
        problems,
      );
    }

    {
      const problems = [];
      const retryOverview = () =>
        fetch(`${APP_URL}/temporarily-slow/retry`, {
          method: "POST",
          redirect: "manual",
          headers: {
            origin: SITE_ORIGIN,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ slug: OVERVIEW_TIMEOUT }),
          signal: AbortSignal.timeout(120_000),
        });
      const clearPin = await retryOverview();
      if (clearPin.status !== 303) {
        problems.push(`clear-pin Retry status ${clearPin.status} != 303`);
      }
      overviewRecovered = false;
      overviewHoldMs = 1500;
      overviewProfileOutcomes.length = 0;
      const homepageInflight = probe("/");
      const waitForHeld = Date.now() + 8_000;
      while (
        overviewProfileOutcomes.length === 0 &&
        Date.now() < waitForHeld
      ) {
        await new Promise((r) => setTimeout(r, 50));
      }
      if (overviewProfileOutcomes[0] !== "57014") {
        problems.push(
          `held homepage PROFILE outcome ${overviewProfileOutcomes[0] ?? "<none>"} != 57014`,
        );
      }
      overviewRecovered = true;
      const retryRes = await retryOverview();
      if (retryRes.status !== 303) {
        problems.push(`Retry POST status ${retryRes.status} != 303`);
      }
      const homepage = await homepageInflight;
      if (homepage.status !== 200) {
        problems.push(`homepage status ${homepage.status} != 200`);
      }
      if (homepage.body.includes("Overview Timeout Ltd")) {
        problems.push("homepage showed Overview Timeout Ltd after held 57014");
      }
      if (homepage.body.includes("Recovered Overview Ltd")) {
        problems.push("homepage showed Recovered Overview Ltd from stale catch");
      }
      const factory = await probe(`/suppliers/${OVERVIEW_TIMEOUT}`);
      if (factory.status !== 200) {
        problems.push(
          `factory GET after overview catch ${factory.status} != 200`,
        );
      }
      if (factory.status === 307) {
        problems.push("stale overview catch re-pinned the factory URL");
      }
      if (!factory.body.includes("Recovered Overview Ltd")) {
        problems.push(
          `factory body missing Recovered Overview Ltd (${factory.bytes} bytes)`,
        );
      }
      assertSmaxage300(
        factory.cacheControl,
        problems,
        "factory after overview Retry",
      );
      overviewHoldMs = 0;
      extraPassed += extra(
        "public: homepage overview 57014 overlapping Retry does not re-pin factory",
        problems,
      );
    }

    {
      const problems = [];
      const gone = await fetch(`${APP_URL}/temporarily-slow/revalidate-tag`, {
        method: "POST",
        redirect: "manual",
        headers: {
          origin: SITE_ORIGIN,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ slug: MOTHER }),
        signal: AbortSignal.timeout(120_000),
      });
      if (gone.status !== 404) {
        problems.push(`revalidate-tag status ${gone.status} != 404`);
      }
      extraPassed += extra(
        "public: POST /temporarily-slow/revalidate-tag -> 404",
        problems,
      );
    }

    {
      const problems = [];
      if (productionTreeHas(join(ROOT, "app"), "revalidatePublicProfileTag")) {
        problems.push("app/ production files contain revalidatePublicProfileTag");
      }
      if (productionTreeHas(join(ROOT, "lib"), "revalidatePublicProfileTag")) {
        problems.push("lib/ production files contain revalidatePublicProfileTag");
      }
      extraPassed += extra(
        "public: no revalidatePublicProfileTag in app/ or lib/ production files",
        problems,
      );
    }

    {
      const problems = [];
      const first = await probe(`/suppliers/${MOTHER}`);
      if (first.status !== 200) {
        problems.push(`warmup GET ${first.status} != 200`);
      }
      if (!first.body.includes("Mother Company Ltd")) {
        problems.push("warmup body missing Mother Company Ltd");
      }
      motherCompanyName = "Published After Admin Ltd";
      const stale = await probe(`/suppliers/${MOTHER}`);
      if (!stale.body.includes("Mother Company Ltd")) {
        problems.push("after name mutate, body lost Mother Company Ltd");
      }
      if (stale.body.includes("Published After Admin Ltd")) {
        problems.push("after name mutate, already showed new name");
      }
      const retryRes = await fetch(`${APP_URL}/temporarily-slow/retry`, {
        method: "POST",
        redirect: "manual",
        headers: {
          origin: SITE_ORIGIN,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ slug: MOTHER }),
        signal: AbortSignal.timeout(120_000),
      });
      if (retryRes.status !== 303) {
        problems.push(`Retry POST status ${retryRes.status} != 303`);
      }
      const fresh = await probe(`/suppliers/${MOTHER}`);
      if (fresh.status !== 200) {
        problems.push(`after Retry, GET ${fresh.status} != 200`);
      }
      if (!fresh.body.includes("Published After Admin Ltd")) {
        problems.push(
          `after Retry+clear, body missing Published After Admin Ltd (${fresh.bytes} bytes)`,
        );
      }
      motherCompanyName = "Mother Company Ltd";
      extraPassed += extra(
        "public: mutate stays stale until Retry clears and shows new HTML",
        problems,
      );
    }

    {
      const problems = [];
      for (const method of ["GET", "HEAD"]) {
        const spoof = await rawRequest(method, `/suppliers/${TIMEOUT}`, {
          headers: {
            host: "evil.example",
            "user-agent": "sourcebd-http-guard/1.0",
          },
        });
        if (spoof.status !== 307) {
          problems.push(`${method} status ${spoof.status} != 307`);
        }
        assertAbsoluteOnSite(
          spoof.location,
          { pathname: "/temporarily-slow", search: `?slug=${TIMEOUT}` },
          problems,
          method,
        );
        assertPrivateNoStore(spoof.cacheControl, problems, method);
      }
      extraPassed += extra(
        "public: GET/HEAD timeout Host=evil.example stays on site origin",
        problems,
      );
    }

    {
      const problems = [];
      for (const method of ["GET", "HEAD"]) {
        const spoof = await rawRequest(method, `/suppliers/${TIMEOUT}`, {
          headers: {
            host: "evil.example",
            cookie: buildAuthCookieHeader(),
            "user-agent": "sourcebd-http-guard/1.0",
          },
        });
        if (spoof.status !== 307) {
          problems.push(`${method} status ${spoof.status} != 307`);
        }
        assertAbsoluteOnSite(
          spoof.location,
          { pathname: `/app/suppliers/${TIMEOUT}` },
          problems,
          `I-034 ${method}`,
        );
        assertPrivateNoStore(spoof.cacheControl, problems, `I-034 ${method}`);
      }
      extraPassed += extra(
        "buyer session: I-034 GET/HEAD Host=evil.example stays on site origin",
        problems,
      );
    }

    {
      const problems = [];
      for (const method of ["GET", "HEAD"]) {
        const spoof = await rawRequest(method, "/discover", {
          headers: {
            host: "evil.example",
            cookie: buildAuthCookieHeader(),
            "user-agent": "sourcebd-http-guard/1.0",
          },
        });
        if (spoof.status !== 307) {
          problems.push(`${method} status ${spoof.status} != 307`);
        }
        assertAbsoluteOnSite(
          spoof.location,
          { pathname: "/app/discover" },
          problems,
          `I-034 /discover ${method}`,
        );
        assertPrivateNoStore(
          spoof.cacheControl,
          problems,
          `I-034 /discover ${method}`,
        );
      }
      extraPassed += extra(
        "buyer session: I-034 /discover GET/HEAD Host=evil.example stays on site origin",
        problems,
      );
    }

    {
      const problems = [];
      for (const method of ["GET", "HEAD"]) {
        const res = await fetch(`${APP_URL}/suppliers/${MOTHER}`, {
          method,
          redirect: "manual",
          headers: {
            cookie: buildAuthCookieHeader(),
            "user-agent": "sourcebd-http-guard/1.0",
          },
          signal: AbortSignal.timeout(120_000),
        });
        if (res.status !== 307) {
          problems.push(`${method} status ${res.status} != 307`);
        }
        assertAbsoluteOnSite(
          res.headers.get("location"),
          { pathname: `/app/suppliers/${MOTHER}` },
          problems,
          `I-034 published ${method}`,
        );
        assertPrivateNoStore(
          res.headers.get("cache-control"),
          problems,
          `I-034 published ${method}`,
        );
      }
      extraPassed += extra(
        "buyer session: I-034 GET/HEAD published factory stays on site origin",
        problems,
      );
    }

    {
      const problems = [];
      for (const method of ["GET", "HEAD"]) {
        const spoof = await rawRequest(method, `/suppliers/${MOTHER}`, {
          headers: {
            host: "evil.example",
            cookie: buildAuthCookieHeader(),
            "user-agent": "sourcebd-http-guard/1.0",
          },
        });
        if (spoof.status !== 307) {
          problems.push(`${method} status ${spoof.status} != 307`);
        }
        assertAbsoluteOnSite(
          spoof.location,
          { pathname: `/app/suppliers/${MOTHER}` },
          problems,
          `I-034 published Host=evil ${method}`,
        );
        assertPrivateNoStore(
          spoof.cacheControl,
          problems,
          `I-034 published Host=evil ${method}`,
        );
      }
      extraPassed += extra(
        "buyer session: I-034 published factory Host=evil.example stays on site origin",
        problems,
      );
    }

    {
      const problems = [];
      const spoof = await rawRequest("GET", `/suppliers/${FACILITY}`, {
        headers: {
          host: "evil.example",
          "user-agent": "sourcebd-http-guard/1.0",
        },
      });
      if (spoof.status !== 308) {
        problems.push(`status ${spoof.status} != 308`);
      }
      assertAbsoluteOnSite(
        spoof.location,
        { pathname: `/suppliers/${MOTHER}` },
        problems,
        "facility 308 Host=evil",
      );
      extraPassed += extra(
        "public: facility 308 Host=evil.example stays on site origin",
        problems,
      );
    }

    {
      const problems = [];
      const spoof = await rawRequest("GET", `/suppliers/${TIMEOUT}`, {
        headers: {
          host: "www.evil.example",
          "user-agent": "sourcebd-http-guard/1.0",
        },
      });
      if (spoof.status !== 301) {
        problems.push(`status ${spoof.status} != 301`);
      }
      assertAbsoluteOnSite(
        spoof.location,
        { pathname: `/suppliers/${TIMEOUT}` },
        problems,
        "www 301",
      );
      extraPassed += extra(
        "public: GET Host=www.evil.example 301 stays on site origin",
        problems,
      );
    }

    {
      // Next collapses `//evil.example/phish` to `/evil.example/phish`
      // before middleware (308, relative Location). The www 301 we
      // control is the collapsed path. Protocol-relative constructor
      // escape is covered in lib/site-origin.test.ts.
      const problems = [];
      for (const path of ["//evil.example/phish", "///evil.example", "/evil.example/phish"]) {
        const spoof = await rawRequest("GET", path, {
          headers: {
            host: "www.evil.example",
            "user-agent": "sourcebd-http-guard/1.0",
          },
        });
        const first = firstLocation(spoof.location);
        if (/evil\.example/i.test(first ?? "") && /^https?:\/\//i.test(first ?? "")) {
          let parsed = null;
          try {
            parsed = new URL(first);
          } catch {
            parsed = null;
          }
          if (parsed && /evil\.example/i.test(parsed.host)) {
            problems.push(`${path} Location host is attacker: ${first}`);
          }
        }
        if (first && /^\/\//.test(first)) {
          problems.push(`${path} Location ${first} is protocol-relative`);
        }
        if (path === "/evil.example/phish") {
          if (spoof.status !== 301) {
            problems.push(`${path} status ${spoof.status} != 301`);
          }
          assertAbsoluteOnSite(
            spoof.location,
            { pathname: path },
            problems,
            "www 301 attacker-shaped path",
          );
        }
      }
      extraPassed += extra(
        "public: www 301 protocol-relative path stays on site origin",
        problems,
      );
    }

    {
      const problems = [];
      const anon = await probe(`/suppliers/${TIMEOUT}`);
      if (anon.status !== 307) {
        problems.push(`status ${anon.status} != 307`);
      }
      assertAbsoluteOnSite(
        anon.location,
        { pathname: "/temporarily-slow", search: `?slug=${TIMEOUT}` },
        problems,
        "anon after buyer",
      );
      if ((anon.location ?? "").includes(`/app/suppliers/${TIMEOUT}`)) {
        problems.push("anonymous GET used a cached /app bounce");
      }
      extraPassed += extra(
        "public: anonymous GET after buyer bounce on timeout slug is slow page",
        problems,
      );
    }

    {
      const problems = [];
      staleSuccessPhase = "success";
      staleSuccessHoldMs = 2000;
      const inflight = probe(`/suppliers/${STALE_SUCCESS}`);
      await new Promise((r) => setTimeout(r, 250));
      staleSuccessPhase = "timeout";
      const retryRes = await fetch(`${APP_URL}/temporarily-slow/retry`, {
        method: "POST",
        redirect: "manual",
        headers: {
          origin: SITE_ORIGIN,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ slug: STALE_SUCCESS }),
        signal: AbortSignal.timeout(120_000),
      });
      if (retryRes.status !== 303) {
        problems.push(`Retry POST status ${retryRes.status} != 303`);
      }
      const pinned = await probe(`/suppliers/${STALE_SUCCESS}`);
      if (pinned.status !== 307) {
        problems.push(`pin GET ${pinned.status} != 307`);
      }
      assertAbsoluteOnSite(
        pinned.location,
        { pathname: "/temporarily-slow", search: `?slug=${STALE_SUCCESS}` },
        problems,
        "pin",
      );
      const waiter = await inflight;
      if (waiter.status !== 307) {
        problems.push(`stale waiter status ${waiter.status} != 307`);
      }
      assertAbsoluteOnSite(
        waiter.location,
        { pathname: "/temporarily-slow", search: `?slug=${STALE_SUCCESS}` },
        problems,
        "stale waiter",
      );
      if (!/private,\s*no-store/.test(waiter.cacheControl ?? "")) {
        problems.push(
          `stale waiter Cache-Control ${waiter.cacheControl || "<none>"} missing private, no-store`,
        );
      }
      if (/s-maxage=[1-9]/.test(waiter.cacheControl ?? "")) {
        problems.push(
          `stale waiter Cache-Control ${waiter.cacheControl} has s-maxage`,
        );
      }
      const rpcBefore = rpcCount(PROFILE_RPC);
      const still = await probe(`/suppliers/${STALE_SUCCESS}`);
      if (still.status !== 307) {
        problems.push(`after stale success, GET ${still.status} != 307`);
      }
      assertAbsoluteOnSite(
        still.location,
        { pathname: "/temporarily-slow", search: `?slug=${STALE_SUCCESS}` },
        problems,
        "after stale success",
      );
      const rpcAfter = rpcCount(PROFILE_RPC);
      if (rpcAfter !== rpcBefore) {
        problems.push(
          `after stale success, ${PROFILE_RPC} fired (${rpcBefore} -> ${rpcAfter})`,
        );
      }
      staleSuccessPhase = "success";
      staleSuccessHoldMs = 0;
      extraPassed += extra(
        "public: stale in-flight success does not wipe a newer timeout pin",
        problems,
      );
    }

    timeoutRecovered = false;
    const retryProblems = [];
    const ensurePinned = await probe(`/suppliers/${TIMEOUT}`);
    if (ensurePinned.status !== 307) {
      retryProblems.push(
        `pre-recover GET ${ensurePinned.status} != 307`,
      );
    }
    timeoutRecovered = true;
    const stillPinned = await probe(`/suppliers/${TIMEOUT}`);
    if (stillPinned.status !== 307) {
      retryProblems.push(
        `after stub recover, GET still ${stillPinned.status} (want 307 until Retry)`,
      );
    }
    assertAbsoluteOnSite(
      stillPinned.location,
      { pathname: "/temporarily-slow", search: `?slug=${TIMEOUT}` },
      retryProblems,
      "after stub recover",
    );
    const rpcBeforeWait = rpcCount(PROFILE_RPC);
    await new Promise((r) => setTimeout(r, 9_000));
    const afterWait = await probe(`/suppliers/${TIMEOUT}`);
    if (afterWait.status !== 307) {
      retryProblems.push(
        `after 9s without Retry, GET ${afterWait.status} != 307`,
      );
    }
    assertAbsoluteOnSite(
      afterWait.location,
      { pathname: "/temporarily-slow", search: `?slug=${TIMEOUT}` },
      retryProblems,
      "after 9s without Retry",
    );
    if (rpcCount(PROFILE_RPC) !== rpcBeforeWait) {
      retryProblems.push(
        `after 9s without Retry, ${PROFILE_RPC} fired (${rpcBeforeWait} -> ${rpcCount(PROFILE_RPC)})`,
      );
    }
    assertPrivateNoStore(
      afterWait.cacheControl,
      retryProblems,
      "after 9s without Retry",
    );
    const retryRes = await fetch(`${APP_URL}/temporarily-slow/retry`, {
      method: "POST",
      redirect: "manual",
      headers: {
        origin: SITE_ORIGIN,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ slug: TIMEOUT }),
      signal: AbortSignal.timeout(120_000),
    });
    if (retryRes.status !== 303) {
      retryProblems.push(`Retry POST status ${retryRes.status} != 303`);
    }
    assertAbsoluteOnSite(
      retryRes.headers.get("location"),
      { pathname: `/suppliers/${TIMEOUT}` },
      retryProblems,
      "Retry 303",
    );
    const recovered = await probe(`/suppliers/${TIMEOUT}`);
    if (recovered.status !== 200) {
      retryProblems.push(
        `after Retry, canonical GET status ${recovered.status} != 200`,
      );
    }
    if (!recovered.body.includes("Recovered Timeout Ltd")) {
      retryProblems.push(
        `after Retry, body missing Recovered Timeout Ltd (${recovered.bytes} bytes)`,
      );
    }
    if (!/<title>[^<]*Recovered Timeout Ltd/i.test(recovered.body)) {
      retryProblems.push("after Retry, HTML title missing Recovered Timeout Ltd");
    }
    if (/name="robots"[^>]*noindex/i.test(recovered.body)) {
      retryProblems.push("after Retry, recovered factory page is noindex");
    }
    assertSmaxage300(
      recovered.cacheControl,
      retryProblems,
      "after Retry",
    );
    extraPassed += extra(
      "public: Retry recovers canonical factory page after timeout",
      retryProblems,
    );
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
  console.log(
    `\nAll ${CASES.length + extraPassed} HTTP-boundary cases passed.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
