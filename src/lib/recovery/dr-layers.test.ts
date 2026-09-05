/**
 * Build-protection onion — automated recovery drill + layer checks
 * (docs/BACKUP_AND_DR.md). These tests exercise the REAL scripts
 * (scripts/build-snapshot.mjs, scripts/health-gate.mjs, scripts/start-prod.sh
 * via scripts/dr-recovery-drill.sh, scripts/git-backup-refs.sh) in sandboxed
 * scratch dirs — no mocks are substituted for the guard under test.
 */
import { describe, expect, test } from "bun:test";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../../.."); // src/lib/recovery -> workspace root
// Scripts must run under REAL node — resolve via replit-node.sh everywhere.
const NODE = ["scripts/replit-node.sh"];

const mkscratch = () => fs.mkdtempSync(path.join(os.tmpdir(), "aurora-dr-test-"));
const sh = (cmd: string, args: string[], env: Record<string, string> = {}) =>
  spawnSync(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, encoding: "utf8", timeout: 240_000 });

describe("build protection onion", () => {
  test(
    "recovery drill: broken build auto-restores the last-known-good snapshot",
    () => {
      const r = sh("bash", ["scripts/dr-recovery-drill.sh"]);
      expect(r.stdout).toContain("DRILL PASS");
      expect(r.status).toBe(0);
    },
    240_000,
  );

  test("deployer contract: scripts/build.js exists and delegates via replit-node.sh", () => {
    // The autoscale deployer invokes `node scripts/build.js` from a cached
    // server-side command — that contract must never change.
    const src = fs.readFileSync(path.join(ROOT, "scripts", "build.js"), "utf8");
    expect(src).toContain("replit-node.sh");
    expect(src).toContain("vite.js");
  });

  test(
    "backup refs: dated refs point at the Main tip and rotate with retention",
    () => {
      const repo = mkscratch();
      try {
        expect(sh("git", ["init", "-qb", "Main", repo]).status).toBe(0);
        sh("git", ["-C", repo, "config", "user.email", "t@t"]);
        sh("git", ["-C", repo, "config", "user.name", "t"]);
        fs.writeFileSync(path.join(repo, "f"), "x");
        sh("git", ["-C", repo, "add", "f"]);
        expect(sh("git", ["-C", repo, "commit", "-qm", "init"]).status).toBe(0);
        const tip = sh("git", ["-C", repo, "rev-parse", "Main"]).stdout.trim();

        const env = { AURORA_BACKUP_REFS_FORCE: "1", AURORA_BACKUP_REFS_REPO: repo };
        for (let d = 1; d <= 16; d++) {
          const date = `2026-08-${String(d).padStart(2, "0")}`;
          expect(sh("bash", ["scripts/git-backup-refs.sh"], { ...env, AURORA_BACKUP_DATE: date }).status).toBe(0);
        }
        expect(sh("bash", ["scripts/git-backup-refs.sh"], { ...env, AURORA_BACKUP_DATE: "2026-09-01" }).status).toBe(0);

        const daily = sh("git", ["-C", repo, "for-each-ref", "--format=%(refname:short)", "refs/heads/backup/2*"])
          .stdout.trim()
          .split("\n");
        expect(daily.length).toBe(14); // 17 created, oldest 3 rotated out
        expect(daily[0]).toBe("backup/2026-08-04");
        expect(daily[daily.length - 1]).toBe("backup/2026-09-01");
        const monthly = sh("git", ["-C", repo, "for-each-ref", "--format=%(refname:short)", "refs/heads/backup/monthly/*"])
          .stdout.trim()
          .split("\n");
        expect(monthly).toEqual(["backup/monthly/2026-08", "backup/monthly/2026-09"]);
        // Every backup ref resolves to the exact Main tip it captured.
        expect(sh("git", ["-C", repo, "rev-parse", "refs/heads/backup/2026-09-01"]).stdout.trim()).toBe(tip);
      } finally {
        fs.rmSync(repo, { recursive: true, force: true });
      }
    },
    120_000,
  );

  test("backup refs: refuses outside the main workspace, rejects malformed dates", () => {
    const skipped = sh("bash", ["scripts/git-backup-refs.sh"], { REPL_ID: "not-the-main-repl", AURORA_BACKUP_REFS_FORCE: "" });
    expect(skipped.status).toBe(0);
    expect(skipped.stdout).toContain("skipping");

    const repo = mkscratch();
    try {
      sh("git", ["init", "-qb", "Main", repo]);
      const bad = sh("bash", ["scripts/git-backup-refs.sh"], {
        AURORA_BACKUP_REFS_FORCE: "1",
        AURORA_BACKUP_REFS_REPO: repo,
        AURORA_BACKUP_DATE: "../../etc",
      });
      expect(bad.status).toBe(1);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test(
    "snapshots: current pointer moves, rotation stays bounded, last-known-good is never pruned",
    () => {
      const dir = mkscratch();
      try {
        const out = path.join(dir, "out");
        fs.mkdirSync(path.join(out, "server"), { recursive: true });
        fs.mkdirSync(path.join(out, "public"), { recursive: true });
        fs.writeFileSync(path.join(out, "server", "index.mjs"), "process.exit(0);\n");
        const snaps = path.join(dir, "snaps");
        const env = { AURORA_BUILD_OUTPUT: out, AURORA_SNAPSHOT_DIR: snaps, AURORA_SNAPSHOT_RETAIN: "2" };
        const snap = () => sh("bash", [...NODE, "scripts/build-snapshot.mjs"], env);
        const promote = () => sh("bash", [...NODE, "scripts/build-snapshot.mjs", "--promote"], env);

        expect(snap().status).toBe(0);
        const first = fs.readlinkSync(path.join(snaps, "current"));
        expect(first.startsWith("snapshots/")).toBe(true); // relative target → tree is relocatable
        expect(fs.existsSync(path.join(snaps, first, "BUILD_INFO.json"))).toBe(true);
        expect(promote().status).toBe(0);
        expect(fs.readlinkSync(path.join(snaps, "last-known-good"))).toBe(first);

        for (let i = 0; i < 3; i++) expect(snap().status).toBe(0);
        const names = fs.readdirSync(path.join(snaps, "snapshots"));
        expect(names.length).toBeLessThanOrEqual(3); // retain 2 + protected LKG
        expect(names).toContain(path.basename(first)); // LKG snapshot survived rotation
        expect(fs.readlinkSync(path.join(snaps, "last-known-good"))).toBe(first);

        // --promote must refuse when `current` points at a broken build.
        fs.rmSync(path.join(snaps, fs.readlinkSync(path.join(snaps, "current")), "server", "index.mjs"));
        expect(promote().status).toBe(1);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
    120_000,
  );

  test("health gate fails fast on a missing server entry", () => {
    const missing = path.join(mkscratch(), "nope");
    const r = sh("bash", [...NODE, "scripts/health-gate.mjs", "--build-dir", missing, "--timeout-s", "2"]);
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toContain("does not exist");
  }, 60_000);

  test(
    "health gate SIGKILLs a TERM-resistant server and leaks no listener",
    async () => {
      const dir = mkscratch();
      try {
        const buildDir = path.join(dir, "build");
        fs.mkdirSync(path.join(buildDir, "server"), { recursive: true });
        fs.writeFileSync(
          path.join(buildDir, "server", "index.mjs"),
          'import http from "node:http";\n' +
            'process.on("SIGTERM", () => {}); // stubborn: ignore polite shutdown\n' +
            'http.createServer((req, res) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true })); }).listen(Number(process.env.PORT), "127.0.0.1");\n',
        );
        const r = sh("bash", [...NODE, "scripts/health-gate.mjs", "--build-dir", buildDir, "--timeout-s", "30"]);
        expect(r.status).toBe(0);
        const m = /healthy on :(\d+)/.exec(String(r.stdout));
        expect(m).toBeTruthy();
        // No listener may survive the gate — the stubborn child must be SIGKILLed.
        await expect(
          fetch(`http://127.0.0.1:${Number(m![1])}/api/health`, { signal: AbortSignal.timeout(2000) }),
        ).rejects.toThrow();
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
    120_000,
  );

  test(
    "health gate allocates its own probe port when the legacy default is squatted",
    () => {
      const dir = mkscratch();
      const buildDir = path.join(dir, "build");
      fs.mkdirSync(path.join(buildDir, "server"), { recursive: true });
      fs.writeFileSync(
        path.join(buildDir, "server", "index.mjs"),
        'import http from "node:http"; http.createServer((q, s) => { s.writeHead(200, { "content-type": "application/json" }); s.end(JSON.stringify({ ok: true })); }).listen(Number(process.env.PORT), "127.0.0.1");\n',
      );
      // Squat the legacy fixed probe port (4319) with an unrelated healthy server.
      const squatter = spawn(
        "bash",
        [
          ...NODE,
          "-e",
          'import("node:http").then((h) => h.createServer((q, s) => { s.writeHead(200, { "content-type": "application/json" }); s.end(JSON.stringify({ ok: true })); }).listen(4319, "127.0.0.1"))',
        ],
        { cwd: ROOT, env: process.env, stdio: "ignore" },
      );
      try {
        const up = spawnSync(
          "bash",
          ["-c", "for i in $(seq 1 20); do curl -sf -o /dev/null http://127.0.0.1:4319/api/health && exit 0; sleep 0.25; done; exit 1"],
          { timeout: 15_000 },
        );
        expect(up.status).toBe(0);
        const r = sh("bash", [...NODE, "scripts/health-gate.mjs", "--build-dir", buildDir, "--timeout-s", "30"]);
        expect(r.status).toBe(0);
        // It probed its OWN freshly allocated port, never the squatter's.
        expect(String(r.stdout)).not.toContain(":4319");
      } finally {
        try {
          squatter.kill("SIGKILL");
        } catch {
          // already gone — nothing to clean up
        }
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
    120_000,
  );

  test(
    "health gate rejects a foreign healthy listener when the candidate never binds",
    () => {
      const dir = mkscratch();
      const buildDir = path.join(dir, "build");
      fs.mkdirSync(path.join(buildDir, "server"), { recursive: true });
      // Candidate regression fixture: launcher stays alive but never listens.
      fs.writeFileSync(path.join(buildDir, "server", "index.mjs"), "setInterval(() => {}, 1000);\n");
      // An unrelated {ok:true} server holds the selected probe port.
      const squatter = spawn(
        "bash",
        [
          ...NODE,
          "-e",
          'import("node:http").then((h) => h.createServer((q, s) => { s.writeHead(200, { "content-type": "application/json" }); s.end(JSON.stringify({ ok: true })); }).listen(4323, "127.0.0.1"))',
        ],
        { cwd: ROOT, env: process.env, stdio: "ignore" },
      );
      try {
        const up = spawnSync(
          "bash",
          ["-c", "for i in $(seq 1 20); do curl -sf -o /dev/null http://127.0.0.1:4323/api/health && exit 0; sleep 0.25; done; exit 1"],
          { timeout: 15_000 },
        );
        expect(up.status).toBe(0);
        const r = sh("bash", [...NODE, "scripts/health-gate.mjs", "--build-dir", buildDir, "--port", "4323", "--timeout-s", "8"]);
        // The squatter's healthy answer must NOT validate the deaf candidate.
        expect(r.status).toBe(1);
        expect(r.stderr + r.stdout).toContain("not owned by the candidate");
      } finally {
        try {
          squatter.kill("SIGKILL");
        } catch {
          // already gone — nothing to clean up
        }
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
    120_000,
  );
});
