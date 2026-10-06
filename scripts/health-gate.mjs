#!/usr/bin/env node
// Boot a built server on a scratch port and probe its health endpoint.
// Shared by the post-build health gate (scripts/build.js) and the start-time
// boot probe (scripts/start-prod.sh). Exits 0 only when the server answers
// HTTP 200 with the expected health body; exits 1 on a missing entry, an
// early crash, or a timeout — a build that cannot boot must never be trusted.
//
// Safety properties:
//   - Probe port is FRESHLY ALLOCATED (bind :0) unless explicitly overridden
//     for the recovery drill. A fixed default port could be owned by an
//     unrelated local process answering the health path, which would let the
//     gate "validate" the wrong server.
//   - Attribution: the response body must parse as our health shape
//     ({ok:true,...}) AND the LISTEN socket answering on the probe port must
//     be owned by a process in the candidate's own process group (verified
//     via /proc/net/tcp + /proc/<pid>/fd). A foreign healthy listener — e.g.
//     one that won the release-to-spawn race while the candidate stays alive
//     but never binds — fails the gate instead of being "validated".
//     AURORA_PROBE_PORT/--port is a drill/test-only override.
//   - Shutdown is awaited: SIGTERM the child's process group, escalate to
//     SIGKILL after 2s, and only exit once the child is gone (hard cap 4s).
//     A TERM-resistant server must never leak into later probes/drills.
//
// Usage: health-gate.mjs [--build-dir DIR] [--port N] [--timeout-s N] [--health-path PATH]
// Env defaults: AURORA_BUILD_OUTPUT | .build-snapshots/current,
//               AURORA_PROBE_PORT | (freshly allocated), AURORA_PROBE_TIMEOUT_S | 60,
//               AURORA_HEALTH_PATH | /api/health
import { spawn } from "child_process";
import fs from "fs";
import net from "net";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};

const buildDir = path.resolve(root, arg("build-dir", process.env.AURORA_BUILD_OUTPUT ?? ".build-snapshots/current"));
const timeoutMs = Number(arg("timeout-s", process.env.AURORA_PROBE_TIMEOUT_S ?? "60")) * 1000;
const healthPath = arg("health-path", process.env.AURORA_HEALTH_PATH ?? "/api/health");
const explicitPort = arg("port", process.env.AURORA_PROBE_PORT ?? "");

const pickPort = () =>
  explicitPort
    ? Promise.resolve(Number(explicitPort))
    : new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.once("error", reject);
        srv.listen(0, "127.0.0.1", () => {
          const p = srv.address().port;
          srv.close(() => resolve(p));
        });
      });
const port = await pickPort();

const entry = path.join(buildDir, "server", "index.mjs");
if (!fs.existsSync(entry)) {
  console.error(`[health-gate] FAIL: ${entry} does not exist — build output is missing or incomplete.`);
  process.exit(1);
}

const logFile = path.join(os.tmpdir(), `aurora-health-gate-${process.pid}.log`);
let logFd = fs.openSync(logFile, "w");
const logTail = () => {
  try {
    fs.closeSync(logFd);
  } catch {}
  try {
    return fs.readFileSync(logFile, "utf8").trim().split("\n").slice(-12).join("\n");
  } catch {
    return "(no server output captured)";
  }
};

// detached: the server gets its own process group so we can kill the whole
// tree reliably on both success and failure paths.
const child = spawn("bash", [path.join(root, "scripts/replit-node.sh"), entry], {
  cwd: root,
  env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" },
  stdio: ["ignore", logFd, logFd],
  detached: true,
});

let settled = false;
let childExited = false;
let exitCode = 1;

const shutdown = async () => {
  if (!childExited) {
    const exited = new Promise((res) => child.once("exit", res));
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      childExited = true;
    }
    if (!childExited) {
      const escalate = setTimeout(() => {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {}
      }, 2000);
      await Promise.race([exited, new Promise((res) => setTimeout(res, 4000))]);
      clearTimeout(escalate);
    }
  }
  try {
    fs.closeSync(logFd);
  } catch {}
  process.exit(exitCode);
};

const settle = (code, lines, logger) => {
  if (settled) return;
  settled = true;
  clearInterval(poll);
  exitCode = code;
  for (const line of lines) logger(line);
  void shutdown();
};

const childAlive = () => {
  if (childExited) return false;
  try {
    process.kill(child.pid, 0);
    return true;
  } catch {
    return false;
  }
};

// ── Listener ownership (Linux /proc) ─────────────────────────────────────────
// Which PIDs own a LISTEN socket on `port`? Match the port's socket inodes in
// /proc/net/tcp{,6} against every process's /proc/<pid>/fd symlinks.
const listenerPids = (p) => {
  const inodes = new Set();
  const hex = p.toString(16).toUpperCase().padStart(4, "0");
  for (const f of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    let data;
    try {
      data = fs.readFileSync(f, "utf8");
    } catch {
      continue;
    }
    for (const line of data.split("\n").slice(1)) {
      const cols = line.trim().split(/\s+/);
      if (cols.length < 10) continue;
      if (cols[3] === "0A" && cols[1]?.endsWith(`:${hex}`)) inodes.add(cols[9]); // 0A = LISTEN
    }
  }
  const owners = new Set();
  if (inodes.size === 0) return owners;
  for (const pid of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(pid)) continue;
    let fds;
    try {
      fds = fs.readdirSync(`/proc/${pid}/fd`);
    } catch {
      continue;
    }
    for (const fd of fds) {
      let target;
      try {
        target = fs.readlinkSync(`/proc/${pid}/fd/${fd}`);
      } catch {
        continue;
      }
      const m = /^socket:\[(\d+)\]$/.exec(target);
      if (m && inodes.has(m[1])) {
        owners.add(Number(pid));
        break;
      }
    }
  }
  return owners;
};

// Process-group id of a pid, from /proc/<pid>/stat (field after comm+state+ppid).
const pgidOf = (pid) => {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const rest = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    return Number(rest[2]); // [state, ppid, pgrp, ...]
  } catch {
    return null;
  }
};

// The candidate is spawned `detached`, so its pgid is its own pid; every
// grandchild (replit-node.sh -> node) shares that group.
const ownedByCandidate = (p) => {
  const owners = listenerPids(p);
  if (owners.size === 0) return { owned: false, owners, indeterminate: true };
  const owned = [...owners].some((pid) => pgidOf(pid) === child.pid);
  return { owned, owners, indeterminate: false };
};

const deadline = Date.now() + timeoutMs;
const poll = setInterval(async () => {
  if (settled) return;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${healthPath}`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const body = await res.text();
      let isHealthShape = false;
      try {
        isHealthShape = JSON.parse(body)?.ok === true;
      } catch {}
      if (isHealthShape && !childAlive()) {
        settle(
          1,
          [`[health-gate] FAIL: health answered on :${port} but our child process is gone — refusing to trust another listener.`],
          console.error,
        );
        return;
      }
      if (isHealthShape) {
        // Attribution: the LISTEN socket answering us must belong to the
        // candidate's own process group — never to a foreign listener that
        // happened to hold this port (e.g. after the release-to-spawn race).
        const check = ownedByCandidate(port);
        if (check.indeterminate) {
          // Socket vanished between answer and check (or /proc unreadable) —
          // treat as not-yet-up and let the deadline decide.
        } else if (check.owned) {
          settle(0, [`[health-gate] ${buildDir} healthy on :${port}${healthPath} — HTTP ${res.status} ${body.slice(0, 120)}`], console.log);
          return;
        } else {
          settle(
            1,
            [
              `[health-gate] FAIL: :${port} answers healthy but the listener is not owned by the candidate process (foreign listener pids: ${[...check.owners].join(", ")}) — refusing to trust it.`,
            ],
            console.error,
          );
          return;
        }
      }
    }
  } catch {
    // not up yet
  }
  if (Date.now() > deadline) {
    settle(
      1,
      [
        `[health-gate] FAIL: ${buildDir} — no healthy response within ${timeoutMs / 1000}s on :${port}`,
        `[health-gate] last server log lines:\n${logTail()}`,
      ],
      console.error,
    );
  }
}, 1000);

child.on("exit", (code) => {
  childExited = true;
  settle(
    1,
    [
      `[health-gate] FAIL: ${buildDir} — server process exited early (code ${code ?? "signal"}) before becoming healthy.`,
      `[health-gate] last server log lines:\n${logTail()}`,
    ],
    console.error,
  );
});
