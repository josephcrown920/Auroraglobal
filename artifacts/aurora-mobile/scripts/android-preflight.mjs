#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname, "..");
const appPath = path.join(root, "app.json");
const easPath = path.join(root, "eas.json");
const lockPath = path.join(root, "package-lock.json");

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const fail = (message) => {
  console.error(`android-preflight: FAIL — ${message}`);
  process.exitCode = 1;
};

const app = readJson(appPath).expo;
const eas = readJson(easPath);

if (app.android?.package !== "com.auroraperformancestudio.app") {
  fail(`unexpected Android package: ${app.android?.package ?? "missing"}`);
}

if (!Number.isInteger(app.android?.versionCode) || app.android.versionCode < 4) {
  fail(`Android versionCode must be an integer >= 4; got ${app.android?.versionCode ?? "missing"}`);
}

if (eas.build?.production?.distribution !== "store") {
  fail("EAS production profile must use store distribution");
}

if (eas.build?.production?.android?.buildType !== "app-bundle") {
  fail("EAS production Android build must produce an app-bundle");
}

for (const permission of app.android?.permissions ?? []) {
  if (permission.includes("WRITE_EXTERNAL_STORAGE") || permission.includes("READ_EXTERNAL_STORAGE")) {
    fail(`legacy external-storage permission is not allowed: ${permission}`);
  }
}

if (!fs.existsSync(lockPath)) {
  fail("artifacts/aurora-mobile/package-lock.json is missing");
} else {
  const lock = fs.readFileSync(lockPath, "utf8");
  if (/package-firewall\.replit\.(internal|local)/.test(lock)) {
    fail("Replit package-firewall URL remains in package-lock.json; run scripts/eas-preflight.sh first");
  }
}

if (!process.exitCode) {
  console.log(`android-preflight: OK — package=${app.android.package}, versionCode=${app.android.versionCode}, production=AAB`);
}
