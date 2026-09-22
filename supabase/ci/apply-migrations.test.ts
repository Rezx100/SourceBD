// `apply-migrations.sh` replays all 109 migrations and `create or replace`s
// auth.uid, auth.role and auth.jwt. It takes its target from ambient PG* env,
// and `.claude/hooks/guard.py` blocks `psql -c` but not `psql -f` — so the only
// thing between the throwaway CI container and production was which PGHOST
// happened to be exported. It refuses a non-local target now; this runs it and
// checks that it does.
//
// The refusal exits 9 on purpose: psql itself uses 0-3, a missing PGDATABASE
// exits 1 and a missing psql exits 127, so asserting on the code distinguishes "it refused" from "it
// failed for some other reason". Deleting the check does not make this pass.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";

const SCRIPT = path.join(process.cwd(), "supabase/ci/apply-migrations.sh");

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

function run(env: Record<string, string>): { code: number; stderr: string } {
  try {
    execFileSync("bash", [SCRIPT], {
      env: { ...process.env, PATH: process.env.PATH ?? "", PGDATABASE: "sourcebd_ci", ...env },
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
  ]) {
    it(`refuses PGHOST=${host}`, () => {
      const { code, stderr } = run({ PGHOST: host });
      assert.equal(code, 9, `expected the refusal exit 9, got ${code}: ${stderr}`);
      assert.match(stderr, /refusing to run against/);
    });
  }

  it("refuses a connection URL in the environment, whichever variable holds it", () => {
    for (const key of ["DATABASE_URL", "SUPABASE_DB_URL", "PGURL"]) {
      const { code, stderr } = run({ PGHOST: "localhost", [key]: "postgres://u:p@db.example.com/postgres" });
      assert.equal(code, 9, `${key} did not stop the replay (exit ${code}): ${stderr}`);
      assert.match(stderr, /connection URL/);
    }
  });

  it("does not refuse the local targets CI and a developer actually use", () => {
    // These get past the guard and then fail on psql or on the database not
    // existing — anything but 9. The point is that the guard is not so broad
    // it breaks the job it protects.
    for (const host of ["localhost", "127.0.0.1", "postgres", "/var/run/postgresql"]) {
      const { code } = run({ PGHOST: host, PGPORT: "1" });
      assert.notEqual(code, 9, `PGHOST=${host} is a local target and must not be refused`);
    }
  });
});
