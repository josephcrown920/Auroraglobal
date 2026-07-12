const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");

let metroProcess = null;
const projectRoot = path.resolve(__dirname, "..");

const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");

function exitWithError(message) {
  console.error(message);
  if (metroProcess) metroProcess.kill();
  process.exit(1);
}

function setupSignalHandlers() {
  const cleanup = () => {
    if (metroProcess) {
      console.log("Cleaning up Metro process...");
      metroProcess.kill();
    }
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("SIGHUP", cleanup);
}

function stripProtocol(domain) {
  let urlString = domain.trim();
  if (!/^https?:\/\//i.test(urlString)) urlString = `https://${urlString}`;
  return new URL(urlString).host;
}

function getDeploymentDomain() {
  if (process.env.REPLIT_INTERNAL_APP_DOMAIN) return stripProtocol(process.env.REPLIT_INTERNAL_APP_DOMAIN);
  if (process.env.REPLIT_DEV_DOMAIN) return stripProtocol(process.env.REPLIT_DEV_DOMAIN);
  if (process.env.EXPO_PUBLIC_DOMAIN) return stripProtocol(process.env.EXPO_PUBLIC_DOMAIN);
  console.error("ERROR: No deployment domain found. Set REPLIT_INTERNAL_APP_DOMAIN, REPLIT_DEV_DOMAIN, or EXPO_PUBLIC_DOMAIN");
  process.exit(1);
}

function prepareDirectories(timestamp) {
  console.log("Preparing build directories...");
  const staticBuild = path.join(projectRoot, "static-build");
  if (fs.existsSync(staticBuild)) fs.rmSync(staticBuild, { recursive: true });
  const dirs = [
    path.join(staticBuild, timestamp, "_expo", "static", "js", "ios"),
    path.join(staticBuild, timestamp, "_expo", "static", "js", "android"),
    path.join(staticBuild, "ios"),
    path.join(staticBuild, "android"),
  ];
  for (const dir of dirs) fs.mkdirSync(dir, { recursive: true });
  console.log("Build:", timestamp);
}

function clearMetroCache() {
  console.log("Clearing Metro cache...");
  const cacheDirs = [
    path.join(projectRoot, ".metro-cache"),
    path.join(projectRoot, "node_modules/.cache/metro"),
  ];
  for (const dir of cacheDirs) {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log("Cache cleared");
}

async function checkMetroHealth() {
  try {
    const response = await fetch("http://localhost:8081/status", { signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function startMetro(expoPublicDomain, expoPublicReplId) {
  const isRunning = await checkMetroHealth();
  if (isRunning) { console.log("Metro already running"); return; }

  console.log("Starting Metro...");
  const env = {
    ...process.env,
    EXPO_PUBLIC_DOMAIN: expoPublicDomain,
    ...(expoPublicReplId ? { EXPO_PUBLIC_REPL_ID: expoPublicReplId } : {}),
  };

  const expoPath = path.join(projectRoot, "node_modules", ".bin", "expo");
  metroProcess = spawn(expoPath, ["start", "--no-dev", "--minify", "--localhost"], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
    cwd: projectRoot,
    env,
  });

  if (metroProcess.stdout) metroProcess.stdout.on("data", (d) => { const s = d.toString().trim(); if (s) console.log(`[Metro] ${s}`); });
  if (metroProcess.stderr) metroProcess.stderr.on("data", (d) => { const s = d.toString().trim(); if (s) console.error(`[Metro Error] ${s}`); });

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await checkMetroHealth()) { console.log("Metro ready"); return; }
  }
  console.error("Metro timeout"); process.exit(1);
}

async function downloadFile(url, outputPath) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const file = fs.createWriteStream(outputPath);
    await pipeline(Readable.fromWeb(response.body), file);
    if (fs.statSync(outputPath).size === 0) { fs.unlinkSync(outputPath); throw new Error("Downloaded file is empty"); }
  } catch (error) {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    if (error.name === "AbortError") throw new Error(`Download timeout: ${url}`);
    throw error;
  } finally { clearTimeout(timeoutId); }
}

async function downloadBundle(platform, timestamp) {
  const entryPath = path.resolve(projectRoot, "node_modules", "expo-router", "entry");
  const bundlePath = entryPath.replace(projectRoot + "/", "");
  const url = new URL(`http://localhost:8081/${bundlePath}.bundle`);
  url.searchParams.set("platform", platform);
  url.searchParams.set("dev", "false");
  url.searchParams.set("hot", "false");
  url.searchParams.set("lazy", "false");
  url.searchParams.set("minify", "true");
  const output = path.join("static-build", timestamp, "_expo", "static", "js", platform, "bundle.js");
  console.log(`Fetching ${platform} bundle...`);
  await downloadFile(url.toString(), output);
  console.log(`${platform} bundle ready`);
}

async function downloadManifest(platform) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300_000);
  try {
    const response = await fetch("http://localhost:8081/manifest", { headers: { "expo-platform": platform }, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest = await response.json();
    console.log(`${platform} manifest ready`);
    return manifest;
  } catch (error) {
    if (error.name === "AbortError") throw new Error(`Manifest timeout for ${platform}`);
    throw error;
  } finally { clearTimeout(timeoutId); }
}

async function downloadBundlesAndManifests(timestamp) {
  await downloadBundle("ios", timestamp);
  await downloadBundle("android", timestamp);
  const [iosManifest, androidManifest] = await Promise.all([downloadManifest("ios"), downloadManifest("android")]);
  return { ios: iosManifest, android: androidManifest };
}

function extractAssets(timestamp) {
  const staticBuild = path.join(projectRoot, "static-build");
  const bundles = {
    ios: fs.readFileSync(path.join(staticBuild, timestamp, "_expo", "static", "js", "ios", "bundle.js"), "utf-8"),
    android: fs.readFileSync(path.join(staticBuild, timestamp, "_expo", "static", "js", "android", "bundle.js"), "utf-8"),
  };
  const assetsMap = new Map();
  const assetPattern = /httpServerLocation:"([^"]+)"[^}]*hash:"([^"]+)"[^}]*name:"([^"]+)"[^}]*type:"([^"]+)"/g;
  const extractFromBundle = (bundle, platform) => {
    for (const match of bundle.matchAll(assetPattern)) {
      const tempUrl = new URL(`http://localhost:8081${match[1]}`);
      const unstablePath = tempUrl.searchParams.get("unstable_path");
      if (!unstablePath) throw new Error(`Asset missing unstable_path: ${match[1]}`);
      const decodedPath = decodeURIComponent(unstablePath);
      const filename = match[3] + "." + match[4];
      const key = path.posix.join(decodedPath, filename);
      if (!assetsMap.has(key)) assetsMap.set(key, { url: path.posix.join("/", decodedPath, filename), originalPath: match[1], filename, relativePath: decodedPath, hash: match[2], platforms: new Set() });
      assetsMap.get(key).platforms.add(platform);
    }
  };
  extractFromBundle(bundles.ios, "ios");
  extractFromBundle(bundles.android, "android");
  return Array.from(assetsMap.values());
}

async function downloadAssets(assets, timestamp) {
  if (assets.length === 0) return 0;
  let successCount = 0;
  const failures = [];
  await Promise.all(assets.map(async (asset) => {
    const tempUrl = new URL(`http://localhost:8081${asset.originalPath}`);
    const unstablePath = tempUrl.searchParams.get("unstable_path");
    if (!unstablePath) throw new Error(`Asset missing unstable_path: ${asset.originalPath}`);
    const decodedPath = decodeURIComponent(unstablePath);
    const outputDir = path.join(projectRoot, "static-build", timestamp, "_expo", "static", "js", asset.relativePath);
    fs.mkdirSync(outputDir, { recursive: true });
    const output = path.join(outputDir, asset.filename);
    try {
      const candidates = [path.join(projectRoot, decodedPath, asset.filename)];
      const found = candidates.find((p) => fs.existsSync(p));
      if (!found) throw new Error(`Asset not found: ${asset.filename}`);
      fs.copyFileSync(found, output);
      successCount++;
    } catch (error) { failures.push({ filename: asset.filename, error: error.message }); }
  }));
  if (failures.length > 0) exitWithError(`Failed to copy ${failures.length} asset(s):\n` + failures.map((f) => `  - ${f.filename}: ${f.error}`).join("\n"));
  console.log(`Copied ${successCount} assets`);
  return successCount;
}

function updateBundleUrls(timestamp, baseUrl) {
  ["ios", "android"].forEach((platform) => {
    const bundlePath = path.join(projectRoot, "static-build", timestamp, "_expo", "static", "js", platform, "bundle.js");
    let bundle = fs.readFileSync(bundlePath, "utf-8");
    bundle = bundle.replace(/httpServerLocation:"(\/[^"]+)"/g, (_match, capturedPath) => {
      const tempUrl = new URL(`http://localhost:8081${capturedPath}`);
      const unstablePath = tempUrl.searchParams.get("unstable_path");
      if (!unstablePath) throw new Error(`Asset missing unstable_path in bundle: ${capturedPath}`);
      const decodedPath = decodeURIComponent(unstablePath);
      return `httpServerLocation:"${baseUrl}${basePath}/${timestamp}/_expo/static/js/${decodedPath}"`;
    });
    fs.writeFileSync(bundlePath, bundle);
  });
  console.log("Updated bundle URLs");
}

function updateManifests(manifests, timestamp, baseUrl, assetsByHash) {
  const updateForPlatform = (platform, manifest) => {
    if (!manifest.launchAsset || !manifest.extra) exitWithError(`Malformed manifest for ${platform}`);
    manifest.launchAsset.url = `${baseUrl}${basePath}/${timestamp}/_expo/static/js/${platform}/bundle.js`;
    manifest.launchAsset.key = `bundle-${timestamp}`;
    manifest.createdAt = new Date(Number(timestamp.split("-")[0])).toISOString();
    manifest.extra.expoClient.hostUri = baseUrl.replace("https://", "") + "/" + platform;
    manifest.extra.expoGo.debuggerHost = baseUrl.replace("https://", "") + "/" + platform;
    manifest.extra.expoGo.packagerOpts.dev = false;
    if (manifest.assets?.length > 0) {
      manifest.assets.forEach((asset) => {
        if (!asset.url || !asset.hash) return;
        const assetInfo = assetsByHash.get(asset.hash);
        if (!assetInfo) return;
        asset.url = `${baseUrl}${basePath}/${timestamp}/_expo/static/js/${assetInfo.relativePath}/${assetInfo.filename}`;
      });
    }
    fs.writeFileSync(path.join(projectRoot, "static-build", platform, "manifest.json"), JSON.stringify(manifest, null, 2));
  };
  updateForPlatform("ios", manifests.ios);
  updateForPlatform("android", manifests.android);
  console.log("Manifests updated");
}

async function main() {
  console.log("Building static Expo Go deployment...");
  setupSignalHandlers();
  const domain = getDeploymentDomain();
  const expoPublicReplId = process.env.REPL_ID || process.env.EXPO_PUBLIC_REPL_ID;
  const baseUrl = `https://${domain}`;
  const timestamp = `${Date.now()}-${process.pid}`;
  prepareDirectories(timestamp);
  clearMetroCache();
  await startMetro(domain, expoPublicReplId);
  const manifests = await downloadBundlesAndManifests(timestamp);
  console.log("Processing assets...");
  const assets = extractAssets(timestamp);
  console.log("Found", assets.length, "unique asset(s)");
  const assetsByHash = new Map();
  for (const asset of assets) assetsByHash.set(asset.hash, { relativePath: asset.relativePath, filename: asset.filename });
  const assetCount = await downloadAssets(assets, timestamp);
  if (assetCount > 0) updateBundleUrls(timestamp, baseUrl);
  updateManifests(manifests, timestamp, baseUrl, assetsByHash);
  console.log("Build complete! Deploy to:", baseUrl);
  if (metroProcess) metroProcess.kill();
  process.exit(0);
}

main().catch((error) => {
  console.error("Build failed:", error.message);
  if (metroProcess) metroProcess.kill();
  process.exit(1);
});
