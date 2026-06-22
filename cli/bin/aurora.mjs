#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));

const API_BASE = process.env.AURORA_API_BASE || 'https://aurora-sparkle-charm.lovable.app';
const CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.aurora');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); } catch { return {}; }
}
function writeConfig(obj) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(obj, null, 2), { mode: 0o600 });
}
function getApiKey() {
  const idx = process.argv.indexOf('--api-key');
  if (idx !== -1) return process.argv[idx + 1];
  if (process.env.AURORA_API_KEY) return process.env.AURORA_API_KEY;
  return readConfig().apiKey || null;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const commands = {
  login: 'Save API key to ~/.aurora/config.json',
  generate: 'Generate an image from a prompt',
  whoami: 'Show active account',
  logout: 'Forget stored API key',
  version: 'Print CLI version',
  help: 'Show this help message',
};

const args = process.argv.slice(2);
const cmd = args[0];

if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
  console.log(`Aurora CLI v${pkg.version}\n`);
  console.log('Usage: aurora <command> [options]\n');
  console.log('Commands:');
  Object.entries(commands).forEach(([name, desc]) => {
    console.log(`  ${name.padEnd(15)} ${desc}`);
  });
  console.log('\nOptions:');
  console.log('  --api-key KEY              Override AURORA_API_KEY env var');
  console.log('  --prompt TEXT              Prompt for `generate`');
  console.log('  --out FILE                 Output file for `generate` (default shot.png)');
  console.log('\nEnv: AURORA_API_KEY, AURORA_API_BASE');
  process.exit(0);
}

if (cmd === 'version' || cmd === '-v' || cmd === '--version') {
  console.log(pkg.version);
  process.exit(0);
}

if (cmd === 'login') {
  try {
    const start = await fetch(`${API_BASE}/api/public/cli/device/start`, { method: 'POST' });
    if (!start.ok) {
      console.error(`✗ Could not start device login (${start.status})`);
      process.exit(1);
    }
    const { device_code, user_code, verification_url_complete, interval = 3, expires_in = 900 } = await start.json();
    console.log('\n  Open this URL in your browser to authorize the CLI:\n');
    console.log(`    ${verification_url_complete}`);
    console.log(`\n  Your code: ${user_code}\n`);
    console.log('  Waiting for authorization…');

    const deadline = Date.now() + expires_in * 1000;
    while (Date.now() < deadline) {
      await sleep(interval * 1000);
      const poll = await fetch(`${API_BASE}/api/public/cli/device/poll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_code }),
      });
      if (poll.status === 200) {
        const { api_key } = await poll.json();
        writeConfig({ apiKey: api_key, apiBase: API_BASE });
        console.log(`\n✓ Logged in. Key saved to ${CONFIG_PATH}\n`);
        process.exit(0);
      }
      if (poll.status === 410) {
        console.error('\n✗ Code expired. Run `aurora login` again.');
        process.exit(1);
      }
      if (poll.status !== 202) {
        const text = await poll.text();
        console.error(`\n✗ Login error: ${poll.status} ${text}`);
        process.exit(1);
      }
    }
    console.error('\n✗ Login timed out.');
    process.exit(1);
  } catch (e) {
    console.error('✗ Login failed:', e.message);
    process.exit(1);
  }
}

if (cmd === 'logout') {
  try { fs.unlinkSync(CONFIG_PATH); } catch {}
  console.log('✓ Forgot stored API key.');
  process.exit(0);
}

if (cmd === 'whoami') {
  const apiKey = getApiKey();
  if (!apiKey) { console.log('Not logged in. Run: aurora login'); process.exit(1); }
  console.log(`Authenticated with key ${apiKey.slice(0, 10)}…`);
  process.exit(0);
}

if (cmd === 'generate') {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('✗ Not logged in. Run: aurora login');
    process.exit(1);
  }
  const promptIdx = args.indexOf('--prompt');
  if (promptIdx === -1) {
    console.error('✗ --prompt is required');
    process.exit(1);
  }
  const prompt = args[promptIdx + 1];
  const outIdx = args.indexOf('--out');
  const out = outIdx !== -1 ? args[outIdx + 1] : 'shot.png';
  console.log(`\n  Generating: "${prompt}"`);
  try {
    const res = await fetch(`${API_BASE}/api/public/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ kind: 'image', prompt }),
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { error: text }; }
    if (!res.ok || !json.ok) {
      console.error(`✗ ${res.status} ${json.error || 'failed'}`);
      process.exit(1);
    }
    console.log(`  Provider: ${json.provider}  Latency: ${json.latencyMs}ms`);
    console.log(`  Downloading…`);
    const img = await fetch(json.url);
    if (!img.ok) {
      console.error(`✗ Download failed (${img.status})`);
      process.exit(1);
    }
    const buf = Buffer.from(await img.arrayBuffer());
    fs.writeFileSync(out, buf);
    console.log(`✓ Saved to ${out}\n`);
    process.exit(0);
  } catch (e) {
    console.error('✗ Generate failed:', e.message);
    process.exit(1);
  }
}

console.error(`Unknown command: ${cmd}`);
process.exit(1);
