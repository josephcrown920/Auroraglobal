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
  vast: 'Manage Aurora-owned Vast.ai GPU workers (owner only)',
  estimate: 'Preview the server-confirmed Aura cost without generating',
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
  console.log('  --dry-run                  Preview the price instead of generating');
  console.log('\nEstimate options:');
  console.log('  aurora estimate --kind KIND [--resolution 720p] [--seconds 5] [--model MODEL]');
  console.log('                  [--audio-url URL] [--video-url URL] [--motion PRESET]');
  console.log('                  [--features image,video,motion] [--confirm-preview-id UUID]');
  console.log('\nVast GPU lifecycle (owner only, $0.35/hr ceiling, 1-hour auto-destroy):');
  console.log('  aurora vast search [--min-vram 16]      List rentable offers under the ceiling');
  console.log('  aurora vast up --offer ID               Rent an offer (asks for confirmation)');
  console.log('  aurora vast adopt --instance ID         Adopt an already-rented instance');
  console.log('  aurora vast status                      Managed instances + worker registration');
  console.log('  aurora vast stop --instance ID          Stop a managed instance');
  console.log('  aurora vast destroy --instance ID       Destroy a managed instance');
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

function valueFor(flag) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function estimateParams(kind) {
  const params = new URLSearchParams({ kind });
  const resolution = valueFor('--resolution');
  const duration = valueFor('--seconds') || valueFor('--duration');
  const model = valueFor('--model');
  const audioUrl = valueFor('--audio-url');
  const videoUrl = valueFor('--video-url');
  const cameraMovement = valueFor('--motion');
  const features = valueFor('--features');
  const confirmPreviewId = valueFor('--confirm-preview-id');
  if (resolution) params.set('resolution', resolution);
  if (duration) params.set('duration', duration);
  if (model) params.set('model', model);
  if (audioUrl) params.set('audioUrl', audioUrl);
  if (videoUrl) params.set('videoUrl', videoUrl);
  if (cameraMovement) params.set('cameraMovement', cameraMovement);
  if (features) params.set('features', features);
  if (confirmPreviewId) params.set('confirmPreviewId', confirmPreviewId);
  return params;
}

async function printEstimate(kind) {
  const apiKey = getApiKey();
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  const res = await fetch(`${API_BASE}/api/estimate?${estimateParams(kind)}`, { headers });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { error: text }; }
  if (!res.ok) throw new Error(`${res.status} ${json.error || 'estimate failed'}`);
  console.log(`\n  Live estimate: ${json.credits} Aura`);
  if (json.resolution || json.durationSeconds) {
    console.log(`  Render settings: ${[json.resolution, json.durationSeconds && `${json.durationSeconds}s`].filter(Boolean).join(' · ')}`);
  }
  if (json.features?.length) console.log(`  Billable features: ${json.features.join(', ')}`);
  if (json.blocked?.message) console.log(`  Note: ${json.blocked.message}`);
  if (json.preview) {
    console.log('  This is the required preview pass. Use --confirm-preview-id after it succeeds to estimate full quality.');
  }
  console.log('  No generation started. No Aura was reserved.\n');
}

if (cmd === 'estimate') {
  const kind = valueFor('--kind');
  if (!kind) {
    console.error('✗ --kind is required (image, video, lipsync, upscale, text, audio, or motion)');
    process.exit(1);
  }
  try {
    await printEstimate(kind);
    process.exit(0);
  } catch (e) {
    console.error('✗ Estimate failed:', e.message);
    process.exit(1);
  }
}

if (cmd === 'vast') {
  const apiKey = getApiKey();
  if (!apiKey) { console.error('✗ Not logged in. Run: aurora login'); process.exit(1); }
  const sub = args[1];

  async function vastCall(payload) {
    const res = await fetch(`${API_BASE}/api/public/cli/vast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = { error: text.slice(0, 200) }; }
    if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  }

  function fmtInstance(r) {
    const dl = r.destroy_deadline ? new Date(r.destroy_deadline) : null;
    const mins = dl ? Math.max(0, Math.round((dl.getTime() - Date.now()) / 60000)) : null;
    const lines = [
      `  Vast #${r.vast_instance_id}  ${r.label}${r.adopted ? '  (adopted)' : ''}`,
      `    state: ${r.state}${r.live?.actual_status ? `  (vast: ${r.live.actual_status})` : ''}   $${Number(r.hourly_usd).toFixed(3)}/hr   gpu: ${r.gpu_name ?? '—'}`,
      `    endpoint: ${r.endpoint_url ?? 'not yet known'}`,
      `    auto-destroy: ${dl ? dl.toISOString() : '—'}${mins !== null ? ` (${mins} min left)` : ''}`,
      `    worker: ${r.worker ? `${r.worker.name} — ${r.worker.status}` : 'not registered yet'}`,
    ];
    if (r.failure_reason) lines.push(`    note: ${r.failure_reason}`);
    return lines.join('\n');
  }

  async function confirmPrompt(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((r) => rl.question(question, r));
    rl.close();
    return answer.trim().toLowerCase() === 'yes';
  }

  try {
    if (sub === 'search') {
      const minVram = valueFor('--min-vram');
      const { proposals } = await vastCall({ action: 'search', ...(minVram ? { minGpuRamGb: Number(minVram) } : {}) });
      if (!proposals.length) {
        console.log('\n  No rentable offers under the $0.35/hr ceiling right now. Try again later.\n');
        process.exit(0);
      }
      console.log(`\n  Offers under the $${proposals[0].maxHourlyUsd}/hr ceiling (auto-destroyed after ${proposals[0].maxRuntimeMinutes} min):\n`);
      for (const p of proposals) {
        const o = p.offer;
        console.log(`  offer ${String(o.id).padEnd(10)} ${o.gpu_name.padEnd(18)} $${o.dph_total.toFixed(3)}/hr  ${o.gpu_ram_gb}GB VRAM  ${o.geolocation ?? ''}${o.verified ? '  verified' : ''}`);
        console.log(`    rent it: aurora vast up --offer ${o.id} --price ${o.dph_total.toFixed(4)} --token ${p.confirmToken}`);
      }
      console.log(`\n  Tokens expire ${proposals[0].confirmExpiresAt}. Renting starts real billing on your Vast account.\n`);
      process.exit(0);
    }

    if (sub === 'up') {
      const offer = valueFor('--offer'); const price = valueFor('--price'); const token = valueFor('--token');
      if (!offer || !price || !token) {
        console.error('✗ Usage: aurora vast up --offer ID --price USD_PER_HR --token CONFIRM_TOKEN  (from `aurora vast search`)');
        process.exit(1);
      }
      console.log(`\n  You are about to RENT Vast offer ${offer} at $${price}/hr (real money).`);
      console.log('  Aurora will auto-destroy it after 1 hour.');
      if (!(await confirmPrompt('  Type "yes" to confirm: '))) {
        console.log('  Cancelled — nothing was rented.\n');
        process.exit(0);
      }
      const tasks = valueFor('--tasks'); const name = valueFor('--name');
      const { instance } = await vastCall({
        action: 'provision', offerId: Number(offer), hourlyUsd: Number(price), confirmToken: token,
        ...(tasks ? { tasks } : {}), ...(name ? { name } : {}),
      });
      console.log(`\n✓ Rented Vast instance #${instance.vast_instance_id}. The worker bootstrap is starting;`);
      console.log('  it will self-register with Aurora (first time = pending approval in Admin → Workers).');
      console.log(`  Auto-destroy at ${instance.destroy_deadline}. Track it: aurora vast status\n`);
      process.exit(0);
    }

    if (sub === 'adopt') {
      const id = valueFor('--instance');
      if (!id) { console.error('✗ Usage: aurora vast adopt --instance VAST_INSTANCE_ID'); process.exit(1); }
      const { instance } = await vastCall({ action: 'adopt', vastInstanceId: Number(id) });
      console.log(`\n✓ Adopted Vast instance #${instance.vast_instance_id} — Aurora now monitors it and will`);
      console.log(`  auto-destroy it at ${instance.destroy_deadline}.\n`);
      process.exit(0);
    }

    if (sub === 'status') {
      const { instances } = await vastCall({ action: 'status' });
      if (!instances.length) { console.log('\n  No Aurora-managed Vast instances.\n'); process.exit(0); }
      console.log('');
      for (const r of instances) console.log(fmtInstance(r) + '\n');
      process.exit(0);
    }

    if (sub === 'stop' || sub === 'destroy') {
      const id = valueFor('--instance');
      if (!id) { console.error(`✗ Usage: aurora vast ${sub} --instance VAST_INSTANCE_ID`); process.exit(1); }
      if (sub === 'destroy') {
        if (!(await confirmPrompt(`  Destroy managed instance ${id}? This ends the rental. Type "yes": `))) {
          console.log('  Cancelled.\n'); process.exit(0);
        }
      }
      const { instance } = await vastCall({ action: sub, instance: String(id) });
      console.log(`\n✓ Instance #${instance.vast_instance_id} is now ${instance.state}.\n`);
      process.exit(0);
    }

    console.error('✗ Unknown vast subcommand. Run `aurora help` for usage.');
    process.exit(1);
  } catch (e) {
    console.error('✗ Vast command failed:', e.message);
    process.exit(1);
  }
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
  if (args.includes('--dry-run')) {
    try {
      await printEstimate('image');
      process.exit(0);
    } catch (e) {
      console.error('✗ Estimate failed:', e.message);
      process.exit(1);
    }
  }
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
