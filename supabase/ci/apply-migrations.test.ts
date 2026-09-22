// `apply-migrations.sh` replays all 109 migrations and `create or replace`s
// auth.uid, auth.role and auth.jwt. It takes its target from ambient PG* env,
// and `.claude/hooks/guard.py` blocks `psql -c` but not `psql -f` — so the
// environment is the whole distance between the throwaway CI container and
// production.
//
// The first version of both the guard and this file checked PGHOST alone.
// Three independent reviewers broke it within an hour, all the same way: libpq
// reads PGHOSTADDR, PGSERVICE and PGSERVICEFILE too, and PGHOST accepts a
// comma-separated list. Every one of those bypasses has a case here.
//
// The refusal exits 9 on purpose: psql uses 0-3, a missing PGDATABASE exits 1
// and a missing psql exits 127, so the code distinguishes "it refused" from
// "it failed for some other reason". That mattered twice over — the refusal
// originally recognised itself by the script's filename in stderr, which bash
// also prints for "psql: command not found", so a machine with no psql
// reported a refusal for every host including the local ones.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const SCRIPT = path.join(process.cwd(), "supabase/ci/apply-migrations.sh");

/** The refusal's own exit code. Nothing else in the script returns it. */
const REFUSED = 9;

/**
 * CI is ubuntu; a developer on Windows may not have bash on PATH. Skipping is
 * honest — the guard still runs everywhere the script itself can run, which is
 * everywhere it could do harm.
 */
const HAS_BASH = (() => {
  try {
    execFileSync("bash", ["-c", "exit 0"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

/**
 * A deliberately empty environment for the child, plus only what the case under
 * test sets.
 *
 * `{ ...process.env }` is what the first version did, and it made `pnpm test`
 * go red on the founder's own machine: `CLAUDE.md`'s verification gate asks him
 * to export `SUPABASE_DB_URL`, the script refused on it, and the "does not
 * refuse a local target" case failed for an environment reason. CI exports no
 * such variable, so it failed only where it would be read as a false alarm. The
 * script no longer looks at those URLs at all — libpq does not read them — but
 * the child environment stays hermetic so no ambient PG* variable can decide a
 * case either way.
 */
function run(env: Record<string, string>): { code: number; stderr: string } {
  try {
    execFileSync("bash", [SCRIPT], {
      env: { PATH: process.env.PATH ?? "", PGDATABASE: "sourcebd_ci", ...env },
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
    return { code: 0, stderr: "" };
  } catch (e) {
    const err = e as { status?: number | null; stderr?: string };
    return { code: err.status ?? -1, stderr: err.stderr ?? "" };
  }
}

describe("the migration replay refuses a target it cannot see is local", { skip: HAS_BASH ? false : "bash is not on PATH" }, () => {
  for (const host of [
    "db.abcdefghijklmnop.supabase.co",
    "109.104.153.228",
    "localhost.evil.example",
    "127.0.0.1.nip.io",
    "127.evil.example",
  ]) {
    it(`refuses PGHOST=${host}`, () => {
      const { code, stderr } = run({ PGHOST: host });
      assert.equal(code, REFUSED, `expected the refusal exit ${REFUSED}, got ${code}: ${stderr}`);
      assert.match(stderr, /refusing/);
    });
  }

  it("refuses PGHOST when it names more than one target", () => {
    // libpq tries each entry in turn, so one local-looking entry says nothing
    // about where the connection ends up. `/tmp,db.prod…` satisfied a check
    // written for a socket path.
    for (const host of ["/tmp,db.abcdefghijklmnop.supabase.co", "localhost,109.104.153.228"]) {
      const { code, stderr } = run({ PGHOST: host });
      assert.equal(code, REFUSED, `PGHOST=${host} was not refused (exit ${code}): ${stderr}`);
      assert.match(stderr, /more than one target/);
    }
  });

  for (const redirect of ["PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE", "PGTARGETSESSIONATTRS"]) {
    it(`refuses a local PGHOST while ${redirect} can redirect it`, () => {
      // The bypass: libpq dials PGHOSTADDR and uses PGHOST only for auth and
      // SNI, so `PGHOST=localhost PGHOSTADDR=<prod ip>` walked past a check
      // that read PGHOST. PGSERVICE and PGSERVICEFILE supply a host of their
      // own the same way.
      const { code, stderr } = run({ PGHOST: "localhost", [redirect]: "109.104.153.228" });
      assert.equal(code, REFUSED, `${redirect} did not stop the replay (exit ${code}): ${stderr}`);
      assert.match(stderr, new RegExp(`refusing to run with ${redirect} set`));
    });
  }

  it("does not refuse the local targets CI and a developer actually use", () => {
    // These have to get PAST the name checks. With no psql the script exits
    // 127 before it connects; with psql and an unreachable port it exits on
    // the connection. Either way the refusal must not be what stops it, and
    // nothing on stderr may say "refusing" — asserting only `code !== 9` was
    // too weak to tell those apart.
    for (const host of [
      "localhost",
      "127.0.0.1",
      "127.0.0.2",
      "0.0.0.0",
      "::1",
      "postgres",
      "db",
      "host.docker.internal",
      "supabase_db_sourcebd",
      "/var/run/postgresql",
    ]) {
      const { code, stderr } = run({ PGHOST: host, PGPORT: "1" });
      assert.notEqual(code, REFUSED, `PGHOST=${host} is a local target and must not be refused`);
      assert.doesNotMatch(stderr, /refusing/, `PGHOST=${host} printed a refusal: ${stderr}`);
    }
  });

  it("a connection URL in the environment is not what decides the target", () => {
    // libpq does not read DATABASE_URL, SUPABASE_DB_URL or PGURL, so refusing
    // on them blocked something inert — and refused a variable this repo's own
    // verification gate asks the founder to export, which is exactly what
    // teaches somebody to move their target into a variable nothing checks.
    for (const key of ["DATABASE_URL", "SUPABASE_DB_URL", "PGURL"]) {
      const { code, stderr } = run({
        PGHOST: "localhost",
        PGPORT: "1",
        [key]: "postgres://u:p@db.abcdefghijklmnop.supabase.co/postgres",
      });
      assert.notEqual(code, REFUSED, `${key} decided the outcome, so the guard is reading the wrong variable`);
      assert.doesNotMatch(stderr, /refusing/, `${key} produced a refusal: ${stderr}`);
    }
  });

  it("the server-side refusal is recognised by a token nothing else prints", () => {
    // The last line of defence runs inside Postgres and cannot be exercised
    // without one, so pin the two things about it that are visible from here.
    // Comments are stripped first: an explanatory comment containing the
    // literal being matched has silently held two guards in this change green
    // already.
    const code = readFileSync(SCRIPT, "utf8").replace(/^\s*#.*$/gm, "");
    assert.match(code, /REPLAY-REFUSED:/, "the server-side guard no longer raises a distinctive token");
    assert.doesNotMatch(
      code,
      /apply-migrations\.sh:"?\*?\)\s*exit 9/,
      "the refusal is matched on the script's own name again, which bash also prints when psql is missing",
    );
    assert.match(code, /inet_server_addr\(\)/, "the replay no longer asks the server where it is");
    assert.match(code, /public\.suppliers/, "the replay no longer checks that the target is empty");
  });
});
