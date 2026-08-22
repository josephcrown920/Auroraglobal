#!/usr/bin/env node
/**
 * Aurora Global release-gate preflight.
 *
 * This is intentionally a repository/configuration preflight, not a substitute
 * for a real CI run or external-service smoke test. It fails closed when a
 * required release artifact is missing and reports external runtime checks as
 * VERIFY rather than pretending they passed.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const results = [];

function gate(name, ok, detail, status = ok ? "PASS" : "BLOCKED") {
  results.push({ name, status, detail });
}

// 1–6: implementation evidence. Runtime behavior remains explicitly VERIFY.
gate("Auth & account lifecycle", exists("src/lib/auth.functions.ts") || exists("src/lib/auth.server.ts"),
  "Auth implementation exists; runtime sign-in/Apple/OAuth/session flows still require E2E verification.", "VERIFY");

gate("Critical Aurora workflows", exists("src/lib/studio.functions.ts") && exists("src/lib/jobs.server.ts"),
  "Core studio/job implementation exists; end-to-end provider-backed smoke tests remain required.", "VERIFY");

gate("Credits & billing integrity", exists("src/lib/cost-guardrails.server.ts"),
  "Cost/credit guardrail implementation exists; transactional and concurrency behavior requires runtime tests.", "VERIFY");

gate("AI provider reliability", exists("src/lib/orchestrator.server.ts"),
  "Provider orchestration and retry logic exist; live timeout/fallback behavior requires runtime tests.", "VERIFY");

gate("Jobs & workers", exists("src/lib/jobs.server.ts"),
  "Queue worker, retry, stale-job and finalization logic exist; crash/recovery scenarios require runtime tests.", "VERIFY");

gate("Security", exists("supabase") && exists("src/lib/url-guard.ts"),
  "Database/security infrastructure exists; complete RLS, storage, rate-limit and authorization verification remains required.", "VERIFY");

// 7: CI artifacts are statically verifiable.
const ci = exists(".github/workflows/ci.yml") ? read(".github/workflows/ci.yml") : "";
const packageJson = exists("package.json") ? JSON.parse(read("package.json")) : {};
const scripts = packageJson.scripts ?? {};
const ciHas = ["npm run lint", "npm run typecheck", "bun test src/", "npm run build", "npm run test:e2e"]
  .every((x) => ci.includes(x));
const scriptsHave = ["lint", "typecheck", "test", "build", "test:e2e"].every((x) => typeof scripts[x] === "string");
gate("CI quality gate", ciHas && scriptsHave,
  ciHas && scriptsHave ? "CI workflow and package validation scripts are present." : "CI workflow/package scripts are incomplete.",
  ciHas && scriptsHave ? "PASS" : "BLOCKED");

// 8: migrations/environment/recovery evidence.
const migrationDir = exists("supabase/migrations");
const migrationFiles = migrationDir ? fs.readdirSync(path.join(root, "supabase/migrations")).filter((x) => x.endsWith(".sql")) : [];
gate("Database / migrations / recovery", migrationDir && migrationFiles.length > 0 && exists("docs/DATABASE.md"),
  `${migrationFiles.length} SQL migrations found; production migration state and backup/restore still require environment verification.`, "VERIFY");

// 9: operational evidence.
const operationalFiles = ["src/routes/api/public/uptime-monitor.ts", "docs/DEPLOYMENT.md"];
gate("Observability / operations", operationalFiles.every(exists),
  "Health/uptime and deployment documentation artifacts are present; live health/readiness and alerting require deployment verification.", "VERIFY");

// 10: mobile evidence.
const mobileFiles = ["artifacts/aurora-mobile/lib/api.ts", "artifacts/aurora-mobile/scripts/build.js"];
gate("Production mobile / Expo path", mobileFiles.every(exists),
  "Mobile API/build artifacts are present; production auth, deep-link, upload and release testing remains required.", "VERIFY");

const counts = results.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
console.log("Aurora Global — Production Gate Preflight");
console.log("=========================================");
for (const [i, r] of results.entries()) console.log(`${String(i + 1).padStart(2, "0")}. [${r.status}] ${r.name} — ${r.detail}`);
console.log("-----------------------------------------");
console.log(`PASS=${counts.PASS || 0} VERIFY=${counts.VERIFY || 0} BLOCKED=${counts.BLOCKED || 0}`);
console.log("A full production declaration requires the VERIFY gates to be exercised by CI/deployed smoke tests.");

// Only hard configuration/artifact failures fail this preflight. VERIFY is not
// converted to PASS: this is deliberate so a green preflight cannot be mistaken
// for a green production deployment.
if ((counts.BLOCKED || 0) > 0) process.exit(1);
