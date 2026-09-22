// `apply-migrations.sh` replays all 109 migrations and `create or replace`s
// auth.uid, auth.role and auth.jwt. It takes its target from ambient PG* env,
// and `.claude/hooks/guard.py` blocks `psql -c` but not `psql -f` — so the
// environment is the whole distance between the throwaway CI container and
// production.
//
// This file has been wrong twice, in the two ways a guard on a shell script
// goes wrong.
//
// First it only ever ASKED the script to refuse. It asserted exit codes and
// stderr on hosts it expected to be rejected, and for the hosts it expected to
// be accepted it asserted `code !== 9` — which exit 0 satisfies. The script had
// `guard_status=$?` inside `if ! psql …; then`, where `$?` is the status of the
// negation and therefore always 0, so every connection failure ended the run
// with exit 0, nothing applied and nothing asserted, and the CI job whose whole
// purpose is to execute 0104 reported a green check. Four reviewers found it
// independently and this file blessed it.
//
// Second, the only check that does not trust a host NAME — the SQL block asking
// the server where it is and whether `suppliers` is already populated — was
// guarded by grepping the script's source for `inet_server_addr()`. That
// literal lives inside a string variable, so deleting the block that RUNS it
// left the grep green. The repo's recurring trap (a comment containing the
// literal being matched) in a new costume: a dead string instead of a comment.
//
// So the script is now driven end to end against a `psql` stub that records
// every invocation and its stdin. What is asserted is what the script DID, not
// what its source says.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

const SCRIPT = path.join(process.cwd(), "supabase/ci/apply-migrations.sh");

/** The refusal's own exit code. Nothing else in the script returns it. */
const REFUSED = 9;

/**
 * CI is ubuntu; a developer on Windows may not have bash on PATH. Skipping is
 * honest — the guard still runs everywhere the script itself can run, which is
 * everywhere it could do harm — but it does mean a skip line is the only signal
 * on such a machine, so the skip reason says so.
 */
const HAS_BASH = (() => {
  try {
    execFileSync("bash", ["-c", "exit 0"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const DIR = HAS_BASH ? mkdtempSync(path.join(tmpdir(), "sourcebd-psql-stub-")) : "";
const LOG = path.join(DIR, "calls.log");

if (HAS_BASH) {
  // A psql that records what it was asked to do. STUB_MODE picks the outcome.
  const stub = [
    "#!/usr/bin/env bash",
    'printf "ARGS %s\\n" "$*" >> "$STUB_LOG"',
    // `-f -` means the SQL arrives on stdin; anything else names a file.
    'if [ "${*: -1}" = "-" ]; then',
    '  printf "STDIN %s\\n" "$(cat | tr "\\n" " ")" >> "$STUB_LOG"',
    "fi",
    'case "${STUB_MODE:-ok}" in',
    "  fail)",
    '    echo "psql: error: connection to server at \\"localhost\\" failed: Connection refused" >&2',
    "    exit 2",
    "    ;;",
    "  refuse)",
    '    echo "psql:<stdin>:1: ERROR:  REPLAY-REFUSED: public.suppliers already holds 10922 rows" >&2',
    "    exit 1",
    "    ;;",
    "esac",
    "exit 0",
    "",
  ].join("\n");
  writeFileSync(path.join(DIR, "psql"), stub, { mode: 0o755 });
  chmodSync(path.join(DIR, "psql"), 0o755);
}

after(() => {
  if (DIR) rmSync(DIR, { recursive: true, force: true });
});

function run(env: Record<string, string>, opts: { withStub?: boolean } = {}): { code: number; stderr: string; calls: string } {
  if (opts.withStub !== false && existsSync(LOG)) rmSync(LOG);
  const base: Record<string, string> = { PATH: process.env.PATH ?? "", PGDATABASE: "sourcebd_ci" };
  if (opts.withStub !== false) {
    base.PATH = `${DIR}${path.delimiter}${process.env.PATH ?? ""}`;
    base.STUB_LOG = LOG;
  }
  let code = 0;
  let stderr = "";
  try {
    execFileSync("bash", [SCRIPT], {
      env: { ...base, ...env },
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
  } catch (e) {
    const err = e as { status?: number | null; stderr?: string };
    code = err.status ?? -1;
    stderr = err.stderr ?? "";
  }
  const calls = existsSync(LOG) ? readFileSync(LOG, "utf8") : "";
  return { code, stderr, calls };
}

describe("the migration replay actually replays, and says so when it does not", { skip: HAS_BASH ? false : "bash is not on PATH" }, () => {
  it("a clean run asks the server where it is, then bootstraps, then applies every migration, then asserts", () => {
    const { code, stderr, calls } = run({ PGHOST: "localhost" });
    assert.equal(code, 0, `a clean run failed (${code}): ${stderr}`);

    const lines = calls.split(/\r?\n/).filter(Boolean);
    const stdin = lines.filter((l) => l.startsWith("STDIN "));
    // 1. The check that does not trust a name ran, as SQL, before anything
    //    else. Deleting the block that pipes it leaves this with nothing to
    //    find — which grepping the script's source could not tell, because the
    //    literals live in a string that stays defined when the block goes.
    assert.equal(stdin.length, 1, "the server-side guard was not piped to psql");
    assert.match(stdin[0]!, /inet_server_addr\(\)/, "the replay no longer asks the server where it is");
    assert.match(stdin[0]!, /public\.suppliers/, "the replay no longer checks the target is empty");
    assert.match(stdin[0]!, /REPLAY-REFUSED:/, "the guard raises nothing a caller can recognise");
    assert.match(stdin[0]!, /search_path/, "the guard block does not pin its search_path");

    const args = lines.filter((l) => l.startsWith("ARGS "));
    // 2. Every call goes to the host the name checks vetted, explicitly.
    for (const a of args) {
      assert.match(a, /-h localhost\b/, `a psql call did not name the vetted host: ${a}`);
    }
    // 3. Order: guard, bootstrap, migrations, assertions.
    assert.match(args[0] ?? "", /-f -$/, "the guard was not the first thing psql was asked to run");
    assert.match(args[1] ?? "", /00-supabase-bootstrap\.sql/, "the bootstrap did not run second");
    assert.match(args[args.length - 1] ?? "", /assert-0104\.sql/, "the behaviour assertions did not run last");

    // 4. Every migration on disk was applied, and the newest numbered one last.
    const applied = args.filter((a) => a.includes("supabase/migrations/") || a.includes("supabase\\migrations\\"));
    assert.ok(applied.length >= 100, `only ${applied.length} migrations were applied`);
    // Basename first. Matching `(\d{4})_` anywhere in the path picked "5452"
    // out of `20260810065452_rsc_workers_batch_discover.sql` — the very
    // date-named file whose ordering this rule exists to get right.
    const base = (a: string) => a.trim().split(/[\/]/).pop() ?? "";
    const numbered = applied.map(base).filter((f) => /^\d{4}_.*\.sql$/.test(f));
    assert.ok(numbered.length > 0, "no NNNN_ migration was applied at all");
    const newest = [...numbered].sort().at(-1)!;
    assert.equal(base(applied.at(-1)!), newest, `the newest numbered migration (${newest}) was not applied last`);
  });

  it("a psql that cannot connect fails the run, and applies nothing", () => {
    // This is the one that was green. `guard_status=$?` inside `if ! …` is the
    // status of the negation, so psql's 2 became 0 and the job passed having
    // replayed nothing.
    const { code, stderr, calls } = run({ PGHOST: "localhost", STUB_MODE: "fail" });
    assert.notEqual(code, 0, "a failed connection reported success");
    assert.notEqual(code, REFUSED, "a failed connection is not a refusal");
    assert.equal(code, 2, `expected psql's own exit code, got ${code}: ${stderr}`);
    assert.doesNotMatch(calls, /00-supabase-bootstrap\.sql/, "the bootstrap ran after the guard failed");
    assert.doesNotMatch(calls, /supabase.migrations/, "migrations were applied after the guard failed");
  });

  it("a server that refuses the replay exits 9 and applies nothing", () => {
    const { code, calls } = run({ PGHOST: "localhost", STUB_MODE: "refuse" });
    assert.equal(code, REFUSED, `a REPLAY-REFUSED raise did not exit ${REFUSED}, it exited ${code}`);
    assert.doesNotMatch(calls, /00-supabase-bootstrap\.sql/, "the bootstrap ran against a database the server refused");
  });

  for (const host of [
    "db.abcdefghijklmnop.supabase.co",
    "109.104.153.228",
    "localhost.evil.example",
    "127.0.0.1.nip.io",
    "127.evil.example",
    // Container-name globs are names too. `supabase_db_*` had the identical
    // hole the `127.*` arm was hardened for in the same commit.
    "supabase_db_x.evil.example",
    "supabase_db_db.abcdefghijklmnop.supabase.co",
    "postgres.evil.example",
    "db.evil.example",
  ]) {
    it(`refuses PGHOST=${host}`, () => {
      const { code, stderr, calls } = run({ PGHOST: host });
      assert.equal(code, REFUSED, `expected the refusal exit ${REFUSED}, got ${code}: ${stderr}`);
      assert.match(stderr, /refusing/);
      assert.equal(calls, "", "psql was invoked against a host the script says it refused");
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
      // libpq dials PGHOSTADDR and uses PGHOST only for auth and SNI, so
      // `PGHOST=localhost PGHOSTADDR=<prod ip>` walked past a check that read
      // PGHOST. PGSERVICE and PGSERVICEFILE supply a host of their own.
      const { code, stderr, calls } = run({ PGHOST: "localhost", [redirect]: "109.104.153.228" });
      assert.equal(code, REFUSED, `${redirect} did not stop the replay (exit ${code}): ${stderr}`);
      assert.match(stderr, new RegExp(`refusing to run with ${redirect} set`));
      assert.equal(calls, "", "psql was invoked despite the redirect refusal");
    });
  }

  it("refuses a PGDATABASE that is a connection string rather than a name", () => {
    for (const db of ["postgres://u:p@db.evil.example/postgres", "host=db.evil.example dbname=postgres", "/tmp/somewhere"]) {
      const { code } = run({ PGHOST: "localhost", PGDATABASE: db });
      assert.equal(code, REFUSED, `PGDATABASE=${db} was accepted as a database name`);
    }
  });

  it("does not refuse the local targets CI and a developer actually use", () => {
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
      // `STUB_MODE=fail` so this stops at the first psql call instead of
      // replaying 110 migrations per host — the question here is only whether
      // the name checks let it through, and exit 2 is psql's, not a refusal.
      const { code, stderr, calls } = run({ PGHOST: host, STUB_MODE: "fail" });
      assert.equal(code, 2, `PGHOST=${host} is a local target and must not be refused: ${code} ${stderr}`);
      assert.doesNotMatch(stderr, /refusing/, `PGHOST=${host} printed a refusal: ${stderr}`);
      assert.match(calls, /ARGS -h /, `PGHOST=${host} never reached psql`);
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
        STUB_MODE: "fail",
        [key]: "postgres://u:p@db.abcdefghijklmnop.supabase.co/postgres",
      });
      assert.equal(code, 2, `${key} decided the outcome, so the guard is reading the wrong variable`);
      assert.doesNotMatch(stderr, /refusing/, `${key} produced a refusal: ${stderr}`);
    }
  });

});
