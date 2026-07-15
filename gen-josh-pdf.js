const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument({ 
  size: 'A4', 
  margins: { top: 50, bottom: 50, left: 50, right: 50 },
  info: { Title: 'NBA Josh — Looping Officers Production Plan', Author: 'Aurora Studio' }
});

const out = fs.createWriteStream('/home/runner/workspace/public/nba-josh-looping-officers-plan.pdf');
doc.pipe(out);

// ─── Colors ─────────────────────────────────────────────────────────────────
const PURPLE = '#7C3AED';
const GOLD   = '#F59E0B';
const RED    = '#EF4444';
const DARK   = '#1E1B4B';
const TEXT   = '#111827';
const MUTED  = '#6B7280';
const WHITE  = '#FFFFFF';
const LIGHT  = '#F5F3FF';

// ─── Helpers ────────────────────────────────────────────────────────────────
function pageWidth() { return doc.page.width - 100; }

function header(text, sub) {
  // Full-bleed purple bar
  doc.rect(0, doc.y, doc.page.width, sub ? 90 : 70).fill(DARK);
  const barY = doc.y - (sub ? 90 : 70);
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(26)
     .text(text, 50, barY + 16, { width: pageWidth() });
  if (sub) {
    doc.fillColor('#A5B4FC').font('Helvetica').fontSize(12)
       .text(sub, 50, barY + 50, { width: pageWidth() });
  }
  doc.y = barY + (sub ? 90 : 70) + 20;
  doc.fillColor(TEXT);
}

function sectionTitle(text) {
  doc.moveDown(0.4);
  doc.rect(50, doc.y, pageWidth(), 28).fill(PURPLE);
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(12)
     .text(text.toUpperCase(), 58, doc.y - 21, { width: pageWidth() - 16 });
  doc.y += 10;
  doc.fillColor(TEXT);
}

function pill(text, x, y, color) {
  const w = doc.widthOfString(text, { fontSize: 9 }) + 16;
  doc.rect(x, y - 2, w, 16).fill(color + '22').stroke(color);
  doc.fillColor(color).font('Helvetica-Bold').fontSize(9)
     .text(text, x + 8, y, { lineBreak: false });
  return w + 6;
}

function bullet(text, indent=0) {
  doc.fillColor(PURPLE).font('Helvetica-Bold').fontSize(11)
     .text('•', 50 + indent, doc.y, { continued: true, width: 15 });
  doc.fillColor(TEXT).font('Helvetica').fontSize(10)
     .text(' ' + text, { width: pageWidth() - indent - 10 });
}

function boldLine(label, value, color) {
  doc.font('Helvetica-Bold').fontSize(10).fillColor(color || DARK)
     .text(label + ' ', { continued: true });
  doc.font('Helvetica').fillColor(TEXT).text(value);
}

function warningBox(text) {
  doc.rect(50, doc.y, pageWidth(), 30).fill('#FEF2F2').stroke('#FCA5A5');
  doc.fillColor(RED).font('Helvetica-Bold').fontSize(10)
     .text('⚠  ' + text, 60, doc.y - 24, { width: pageWidth() - 20 });
  doc.y += 8;
}

function infoBox(label, content) {
  const startY = doc.y;
  doc.rect(50, startY, pageWidth(), 1).fill('#E5E7EB'); // top rule
  doc.y = startY + 6;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(PURPLE)
     .text(label.toUpperCase(), 58, doc.y, { width: pageWidth() - 16 });
  doc.y += 2;
  doc.font('Helvetica').fontSize(10).fillColor(TEXT)
     .text(content, 58, doc.y + 2, { width: pageWidth() - 16 });
  doc.y += 8;
}

function outfitCard(id, label, setting, key, status, note) {
  const startY = doc.y;
  const cardH = note ? 72 : 60;
  if (startY + cardH > doc.page.height - 60) { doc.addPage(); }

  const isReady = status === 'BENCHMARK';
  doc.rect(50, doc.y, pageWidth(), cardH)
     .fill(isReady ? LIGHT : '#F9FAFB').stroke(isReady ? PURPLE : '#E5E7EB');

  // ID badge
  doc.rect(50, doc.y, 36, cardH).fill(isReady ? PURPLE : DARK);
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(id.length > 2 ? 9 : 14)
     .text(id, 50, doc.y + (cardH/2) - 9, { width: 36, align: 'center' });

  // Content
  const cx = 96;
  const cy = doc.y + 10;
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(11).text(label, cx, cy, { width: pageWidth() - 56 });
  doc.fillColor(MUTED).font('Helvetica').fontSize(9).text('Setting: ' + setting, cx, cy + 16, { width: pageWidth() - 56 });
  doc.fillColor(TEXT).font('Helvetica').fontSize(9).text(key, cx, cy + 28, { width: pageWidth() - 56 });
  if (note) {
    doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(9).text('★ ' + note, cx, cy + 44, { width: pageWidth() - 56 });
  }

  // Status badge
  const bColor = isReady ? GOLD : (status === 'DONE' ? '#22C55E' : MUTED);
  doc.rect(doc.page.width - 110, doc.y + 10, 58, 16).fill(bColor + '22').stroke(bColor);
  doc.fillColor(bColor).font('Helvetica-Bold').fontSize(8)
     .text(status, doc.page.width - 110, doc.y + 14, { width: 58, align: 'center' });

  doc.y += cardH + 6;
  doc.fillColor(TEXT);
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 1 — COVER
// ═══════════════════════════════════════════════════════════════════════════
doc.rect(0, 0, doc.page.width, doc.page.height).fill(DARK);

doc.fillColor('#A5B4FC').font('Helvetica').fontSize(12).text(
  'OUT THE MUD RECORDS', 50, 60, { width: pageWidth(), align: 'center', characterSpacing: 4 }
);

doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(42).text(
  'NBA JOSH', 50, 100, { width: pageWidth(), align: 'center' }
);

doc.fillColor(PURPLE).font('Helvetica-Bold').fontSize(24).text(
  'LOOPING OFFICERS', 50, 155, { width: pageWidth(), align: 'center' }
);

doc.fillColor('#A5B4FC').font('Helvetica').fontSize(14).text(
  'Surreal Urban Music Video — Production Plan', 50, 195, { width: pageWidth(), align: 'center' }
);

// Divider
doc.rect(150, 230, pageWidth() - 200, 2).fill(PURPLE);

// Stats grid
const stats = [
  { label: 'FORMAT', value: 'Standalone clips' },
  { label: 'AUDIO', value: '24-second hook' },
  { label: 'OUTFITS', value: '8 + Benz scene' },
  { label: 'PROVIDER', value: 'Seedance Lite / Wan 2.5' },
];
stats.forEach((s, i) => {
  const sx = 50 + (i % 2) * (pageWidth() / 2);
  const sy = 250 + Math.floor(i / 2) * 60;
  doc.fillColor(PURPLE).font('Helvetica-Bold').fontSize(9)
     .text(s.label, sx, sy, { characterSpacing: 2 });
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(16)
     .text(s.value, sx, sy + 14);
});

// Concept quote
doc.rect(50, 385, pageWidth(), 80).fill('#312E81');
doc.fillColor('#C7D2FE').font('Helvetica').fontSize(13).text(
  '"Josh stands unbothered on a wet urban street.\nOfficers charge at full aggression — frozen on an invisible treadmill.\nHe turns. Smirks. Walks away."',
  66, 400, { width: pageWidth() - 32, lineGap: 4 }
);

// Key rules callout
doc.rect(50, 480, pageWidth(), 24).fill(RED + 'CC');
doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(11).text(
  '⚠  NO generated clips without user "go" — confirm provider + outfit before every generation',
  58, 487, { width: pageWidth() - 16 }
);

doc.fillColor('#6366F1').font('Helvetica').fontSize(11).text(
  'Generated by Aurora Studio  ·  July 2026', 50, doc.page.height - 60,
  { width: pageWidth(), align: 'center' }
);

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 2 — CHARACTER SPEC
// ═══════════════════════════════════════════════════════════════════════════
doc.addPage();
header('CHARACTER SPEC', 'Read this before every single generation — these are the ground rules');

sectionTitle('Physical Build');
bullet('6\'3" TALL LEAN athletic build. Long-limbed. Slender.');
bullet('NOT muscular. NOT thick. NOT bloated. Basketball-player proportions — think slim and tall.');
bullet('Long fully red dreadlocks past shoulders.');
bullet('Clean face — smooth skin, no blemishes, no extra marks.');
doc.moveDown(0.4);

warningBox('ZERO tattoos on face, neck, chest, or legs. None. Ever. These are all AI hallucinations.');
doc.moveDown(0.4);

sectionTitle('REAL Tattoos — Arms Only');
infoBox('RIGHT SHOULDER', '"NBA" lettering with stars + "JOSH" in gothic lettering');
infoBox('LEFT SHOULDER', 'Portrait tattoo of a young Black male face — low-cut Afro, punk energy (Josh\'s own face)');
infoBox('BOTH FOREARMS', 'Full sleeve tattoos — clouds, roses, stars, geometric patterns. Both arms.');
doc.moveDown(0.3);

sectionTitle('Jewellery — Present on EVERY Outfit');
infoBox('PENDANT', 'Custom diamond "NBA JOSH 444" — large chunky iced-out silver/diamond letters on heavy diamond Cuban link chain');
infoBox('WATCH', 'Iced-out AP (Audemars Piguet) diamond watch — full diamond coverage, spiked bezel — on left wrist');
doc.moveDown(0.3);

sectionTitle('Scene Prop — Every Scene');
infoBox('MICROPHONE', 'Vintage silver retro hanging microphone — dangles from above, always visible in frame');
doc.moveDown(0.3);

sectionTitle('Energy & Performance');
bullet('Completely unbothered. Calm. Superpower aura.');
bullet('Does NOT look scared or tense — total confidence.');
bullet('Near end of clip: slowly turns, gives calm smirk toward camera, then walks away.');
doc.moveDown(0.3);

sectionTitle('Officers');
bullet('4–6 officers in full police uniform.');
bullet('Running at ABSOLUTE MAXIMUM aggression — screaming faces, full sprint posture.');
bullet('Frozen on invisible treadmill — all running energy, zero forward movement.');
bullet('At end of clip: officers collapse exhausted and empty-handed.');
doc.moveDown(0.3);

sectionTitle('Reference Image');
infoBox('SUPABASE PATH', 'studio/josh-refs/josh-blue-portrait.webp  (bucket: studio)');
infoBox('USAGE', 'Upload as identity/face reference to Kling / Seedance / Wan for every single generation. Get fresh signed URL each session.');

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 3 — AI DRIFT CORRECTIONS
// ═══════════════════════════════════════════════════════════════════════════
doc.addPage();
header('AI DRIFT CORRECTIONS', 'Every common failure mode + the exact fix to add to the prompt');

const corrections = [
  {
    issue: 'Extra tattoos on face / neck',
    cause: 'Model hallucinates tattoos on any Black male character',
    fix: 'Add to negative prompt: "no face tattoos, no neck tattoos, clean face, no neck markings, no chest tattoos"',
    severity: 'HIGH',
  },
  {
    issue: 'Too muscular / thick / bloated',
    cause: 'Default male body type in most models skews athletic-stocky',
    fix: 'Add: "slender lean tall basketball player proportions, long limbs, narrow chest, long neck, NOT bodybuilder, NOT thick"',
    severity: 'HIGH',
  },
  {
    issue: 'Likeness / face drift',
    cause: 'Identity reference loses hold over longer prompts',
    fix: 'Always upload the blue-lit portrait as reference image. Shorter prompts drift less — trim if needed. Generate 3 variations, pick best.',
    severity: 'HIGH',
  },
  {
    issue: 'Extra letter / branding on outfit',
    cause: 'Model reads "NBA JOSH pendant" and stamps letters on clothing',
    fix: 'Describe each piece of clothing explicitly without any text labels. Note: pendant chain OK, shirt letters NOT OK.',
    severity: 'MED',
  },
  {
    issue: 'Wrong glasses style',
    cause: 'Vague "sunglasses" description resolves to generic frames',
    fix: 'Specify EXACTLY:\n  Red snake-frame sculptural: outfits A, B, C, D\n  Wavy textured sculptural (white/iridescent): E, G, Benz\n  Black single-lens narrow visor: alternate option',
    severity: 'MED',
  },
  {
    issue: 'Officers too far back / not visible',
    cause: 'Depth-of-field blurs them to nothing',
    fix: 'Add: "officers in full uniform clearly visible in mid-ground, sharp enough to read faces, charging hard"',
    severity: 'LOW',
  },
  {
    issue: 'Officers ACTUALLY reaching Josh',
    cause: 'Model resolves "running toward" as contact',
    fix: 'Add: "officers are frozen mid-stride, stuck in place, not advancing, stuck on invisible treadmill, zero forward progress"',
    severity: 'MED',
  },
];

corrections.forEach(c => {
  if (doc.y > doc.page.height - 100) doc.addPage();
  const sevColor = c.severity === 'HIGH' ? RED : c.severity === 'MED' ? GOLD : '#22C55E';
  const startY = doc.y;
  doc.rect(50, startY, pageWidth(), 1).fill('#E5E7EB');
  doc.y = startY + 8;

  // Severity badge
  doc.rect(50, doc.y, 42, 16).fill(sevColor + '22').stroke(sevColor);
  doc.fillColor(sevColor).font('Helvetica-Bold').fontSize(8)
     .text(c.severity, 50, doc.y + 4, { width: 42, align: 'center' });

  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11)
     .text(c.issue, 100, doc.y - 12, { width: pageWidth() - 50 });
  doc.y += 6;

  doc.fillColor(MUTED).font('Helvetica').fontSize(9)
     .text('Why: ' + c.cause, 58, doc.y, { width: pageWidth() - 16 });
  doc.y += 2;
  doc.fillColor(PURPLE).font('Helvetica-Bold').fontSize(9).text('Fix: ', 58, doc.y, { continued: true });
  doc.fillColor(TEXT).font('Helvetica').fontSize(9).text(c.fix, { width: pageWidth() - 72 });
  doc.y += 10;
});

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 4 — OUTFIT LIBRARY A–D
// ═══════════════════════════════════════════════════════════════════════════
doc.addPage();
header('OUTFIT LIBRARY', 'Each outfit = separate standalone post · same 24-second hook audio');

doc.fillColor(MUTED).font('Helvetica').fontSize(10)
   .text('Every outfit includes: Diamond NBA JOSH 444 pendant + Cuban link + Iced AP watch + Vintage hanging mic', 50, doc.y, { width: pageWidth() });
doc.moveDown(0.6);

outfitCard('A', 'Dark Burgundy Sport Jersey', 'Dark wet night, urban street', 
  'Dark burgundy sleeveless sport jersey (no letters/labels on clothing) + red or iridescent snake-frame sculptural sunglasses. Dark moody overhead streetlight.',
  'PENDING');

outfitCard('B', 'White Psychedelic Mushroom-Eye Tee', 'Golden hour, suburban street, palm trees',
  'White graphic tee with colourful psychedelic mushroom-eye print + black leather pants + red Jordan 4s or red Air Force 1s + red crystal-studded belt + red snake-frame sunglasses.',
  'BENCHMARK', 'IMG_3735 is nearest to correct — use as quality standard. Fixes needed: tattoo bleed + height proportions.');

outfitCard('C', 'NEVER JXST Racing Jersey', 'Dark night OR golden hour (two versions)',
  'NEVER JXST red/black long-sleeve racing jersey (white side panels, circular logo, no extra letters) + black distressed jeans + purple crystal-studded belt + white Nike Shox or white AF1s + red snake-frame sunglasses.',
  'PENDING');

outfitCard('D', 'Crazy Visions Cyber-Punk', 'Golden hour or moody dusk',
  'Crazy Visions orange/black beanie + dark vintage wash black graphic tee (psychedelic mushroom-eye print) + red distressed torn jeans + fur/shearling boots + purple iridescent crystal-studded belt.',
  'PENDING');

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 5 — OUTFIT LIBRARY E–H + BENZ SCENE
// ═══════════════════════════════════════════════════════════════════════════
doc.addPage();
header('OUTFIT LIBRARY (continued)', 'New outfits from reference sheets + special Benz scene');

outfitCard('E', 'Red Puffer + Camo', 'Urban street, any time of day',
  'Glossy red puffer jacket (shiny quilted finish) + wide-leg camo cargo pants + blue paisley basketball sneakers + textured sculptural sunglasses (wavy white frame, colourful multi-pane lenses) + diamond NBA JOSH 444 pendant + iced AP watch.',
  'PENDING');

outfitCard('F', 'Crazy Visions Clean White', 'Any setting',
  'Crazy Visions red/black beanie + white crewneck oversized tee (plain, no print) + camo cargo or black pants + custom dopamine-theme Nike AF1s (white base, teal laces, painted design) + red iridescent crystal-studded belt.',
  'PENDING');

outfitCard('G', 'Shearling + Racing Edge', 'Bold daytime or dusk',
  'Distressed brown/tan shearling fur bomber jacket (worn, vintage feel) over NEVER JXST red/black racing jersey underneath + red leather pants + custom painted Nike AF1 Mid (white/teal, painted dopamine design) + sculptural red iridescent sunglasses.',
  'PENDING');

outfitCard('H', 'Minecraft Creeper Street', 'Urban daytime — unexpected, playful',
  'Minecraft creeper lime green graphic tee (black creeper face print) + wide-leg camo cargo pants + blue paisley basketball sneakers. Unexpected contrast with officer aggression. Keep diamond pendant + AP watch.',
  'PENDING');

outfitCard('🚗', 'Red AMG Benz — Special Scene', 'Dusk or night, urban city street',
  'BORROW from reference (IMG_2971): deep metallic red AMG Mercedes-Benz GT 4-door, door open, interior purple/pink ambient light, AMG grille. Josh leans against car. Outfit: white streetwear jacket over graphic tee + embroidered white cargo shorts + purple Nike VaporMax. Officers frozen mid-charge in background. MUST replace character face with Josh\'s likeness — slim 6\'3\" build, red dreads, same jewellery.',
  'PENDING');

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 6 — SUNGLASSES + ACCESSORIES REFERENCE
// ═══════════════════════════════════════════════════════════════════════════
doc.addPage();
header('ACCESSORIES REFERENCE', 'Exact specs for jewellery, glasses, and props');

sectionTitle('Sunglasses — by Outfit');

const glasses = [
  { style: 'Red snake-frame sculptural', outfits: 'A, B, C, D', desc: 'Sculptural wraparound frames, red tint or iridescent lens, unusual organic snake-like shape. NOT standard rectangular.' },
  { style: 'Wavy textured sculptural', outfits: 'E, G, Benz scene', desc: 'White or pearl frame with an unusual wavy/bumpy texture. Multi-pane colourful lenses (orange, green panels). Very avant-garde shape.' },
  { style: 'Black single-lens narrow visor', outfits: 'Alternate / any', desc: 'One-piece narrow horizontal visor, matte black frame, orange/red mirror lens. Futuristic, minimal — like a racing goggle.' },
];

glasses.forEach(g => {
  if (doc.y > doc.page.height - 80) doc.addPage();
  infoBox(g.style + '  [Outfits: ' + g.outfits + ']', g.desc);
  doc.moveDown(0.2);
});

doc.moveDown(0.4);
sectionTitle('Jewellery — Real Reference Items');
infoBox('NBA JOSH 444 Pendant', 
  'Large chunky iced-out pendant. Letters "NBA" arc at top, "JOSH" bold below, "444" smaller underneath. Full diamond/crystal coverage. Silver colourway. Worn on heavy diamond Cuban link chain (thick, no gaps, fully iced).');
infoBox('AP Diamond Watch',
  'Audemars Piguet fully iced out. Octagonal case shape. Full diamond on bracelet, case, and dial. Spiked spike bezel. Blue/sapphire crystal dial with diamond indices. Left wrist.');

doc.moveDown(0.4);
sectionTitle('Additional Clothing Pieces (Future Outfits)');
infoBox('Black Skeleton Quilted Vest (IMG_1459)',
  'Black quilted vest with cut-out panels forming a skeleton/rib pattern — very unique structural piece. Can layer over tees. Good for a darker editorial look.');
infoBox('Camo Tactical Plate Carrier (IMG_1611)',
  'Multicam/OCP camo plate carrier vest with velcro panels. Utility/military aesthetic. Can pair with camo cargo pants for full tactical editorial.');

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 7 — GENERATION WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════
doc.addPage();
header('GENERATION WORKFLOW', 'Step-by-step for every clip — ALWAYS confirm before generating');

sectionTitle('Provider Options & Pricing (per 10-second clip)');

const providers = [
  { name: 'Seedance Lite', price: '~$0.10', rec: true, note: 'Cheapest. Good motion. Start here for tests.' },
  { name: 'Seedance Pro', price: '~$1.30', note: 'Sharper identity retention. Step up if Lite drifts.' },
  { name: 'Wan 2.5 i2v', price: '~$0.30–0.50', note: 'Strong cinematic motion. Good alternative.' },
  { name: 'Kling v2.1', price: '~$2–4', note: 'High quality but expensive. Use sparingly.' },
  { name: 'xAI / Seedream', price: 'N/A', note: 'Image generation only — no i2v capability in current setup.' },
];

providers.forEach(p => {
  if (doc.y > doc.page.height - 60) doc.addPage();
  const startY = doc.y;
  const bg = p.rec ? LIGHT : '#F9FAFB';
  const border = p.rec ? PURPLE : '#E5E7EB';
  doc.rect(50, startY, pageWidth(), 40).fill(bg).stroke(border);
  doc.fillColor(p.rec ? PURPLE : DARK).font('Helvetica-Bold').fontSize(12)
     .text(p.name + (p.rec ? ' ★ RECOMMENDED' : ''), 62, startY + 8, { width: 260 });
  doc.fillColor(p.rec ? PURPLE : MUTED).font('Helvetica-Bold').fontSize(16)
     .text(p.price, doc.page.width - 130, startY + 10, { width: 80, align: 'right' });
  doc.fillColor(MUTED).font('Helvetica').fontSize(9)
     .text(p.note, 62, startY + 24, { width: pageWidth() - 100 });
  doc.y = startY + 46;
});

doc.moveDown(0.5);
sectionTitle('Generation Steps — Follow Every Time');

const steps = [
  'CONFIRM with Josh which outfit and provider before starting. No exceptions.',
  'Get a fresh signed URL for the reference image from Supabase storage (studio/josh-refs/josh-blue-portrait.webp). URLs expire after 1 hour.',
  'Write the generation prompt using the base template below. Swap in the outfit block from the outfit library.',
  'Add corrective negative prompt lines for face tattoos, muscle build, and any outfit-specific issues.',
  'POST to the provider API. Write JSON to a temp file and use curl --data @file.json (avoids heredoc quoting issues).',
  'Generate 3 variations per outfit. Pick the one with the strongest likeness — not the best composition.',
  'If likeness drifts or extra tattoos appear: regenerate with shorter prompt + the negative corrections.',
  'Once a good result is confirmed, save the URL and mark that outfit as DONE in the tracker.',
];

steps.forEach((s, i) => {
  if (doc.y > doc.page.height - 50) doc.addPage();
  const startY = doc.y;
  doc.rect(50, startY, 28, 28).fill(PURPLE);
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(12)
     .text(String(i + 1), 50, startY + 7, { width: 28, align: 'center' });
  doc.fillColor(TEXT).font('Helvetica').fontSize(10)
     .text(s, 86, startY + 8, { width: pageWidth() - 36 });
  doc.y = startY + 34;
});

doc.moveDown(0.4);
sectionTitle('Base Prompt Template');
const promptBox = doc.y;
doc.rect(50, promptBox, pageWidth(), 120).fill('#F0FDF4').stroke('#86EFAC');
doc.fillColor('#166534').font('Courier').fontSize(8).text(
  'Cinematic music video. Tall lean Black male rapper, 6\'3" slender long-limbed build (NOT muscular),\n' +
  'long fully red dreadlocks past shoulders, [GLASSES] sunglasses, large diamond Cuban link chain\n' +
  'with custom "NBA JOSH 444" diamond pendant, iced-out AP diamond watch on left wrist.\n' +
  'Tattoo right shoulder: "NBA" with stars + "JOSH" gothic lettering.\n' +
  'Tattoo left shoulder: portrait of young Black male face.\n' +
  'Full forearm sleeve tattoos both arms. NO tattoos face neck chest.\n' +
  'Wearing: [OUTFIT BLOCK]. Stands full-body on [SETTING] wet urban street.\n' +
  '4–6 officers in uniform charging maximum aggression but FROZEN IN PLACE (invisible treadmill).\n' +
  'Vintage silver hanging microphone above. Unbothered calm energy. Static locked-off camera.\n' +
  'Near end: slowly turns, calm smirk, walks away. Officers collapse.\n' +
  'Cinematic music video. 16:9. High contrast dramatic lighting. Shallow depth of field.',
  62, promptBox + 8, { width: pageWidth() - 24, lineGap: 1 }
);
doc.y = promptBox + 128;

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 8 — POST-PRODUCTION
// ═══════════════════════════════════════════════════════════════════════════
doc.addPage();
header('POST-PRODUCTION', 'CapCut workflow for every standalone clip');

sectionTitle('Per-Clip Editing Steps');
const postSteps = [
  { step: 'Sync audio', detail: 'Lay the 24-second hook underneath. Align so Josh\'s movement hits the beat drop. The same audio goes under EVERY clip — the outfit change is what keeps it fresh.' },
  { step: 'Colour grade', detail: 'Golden hour clips: warm orange lift, teal/cyan shadows. Night clips: deep blue/teal grade, crushed blacks, cool highlights.' },
  { step: 'Motion blur on officers', detail: 'Video Effects → Motion Blur (medium intensity). This sells the treadmill illusion — they look like they\'re running hard while going nowhere.' },
  { step: 'Vignette', detail: 'Effects → Vignette at 25–35%. Darkens edges, pulls the eye to Josh.' },
  { step: 'Speed ramp (optional)', detail: 'Slow the moment Josh turns and smirks to 40% speed for 0.5 seconds. Then cut to normal. Punch.' },
  { step: 'Export — Vertical (TikTok / Reels)', detail: '1080 × 1920 px, 60fps, H.264. Main posting format.' },
  { step: 'Export — Horizontal (YouTube)', detail: '1920 × 1080 px, 60fps, H.264.' },
];

postSteps.forEach(p => {
  if (doc.y > doc.page.height - 70) doc.addPage();
  const startY = doc.y;
  doc.rect(50, startY, pageWidth(), 1).fill('#E5E7EB');
  doc.y = startY + 8;
  doc.fillColor(PURPLE).font('Helvetica-Bold').fontSize(10).text(p.step, 58, doc.y, { width: 160 });
  doc.fillColor(TEXT).font('Helvetica').fontSize(10).text(p.detail, 58 + 165, doc.y - 13, { width: pageWidth() - 175 });
  doc.y += 16;
});

doc.moveDown(0.5);
sectionTitle('Caption Formula — Each Post');
const capY = doc.y;
doc.rect(50, capY, pageWidth(), 50).fill(LIGHT).stroke(PURPLE);
doc.fillColor(PURPLE).font('Helvetica-Bold').fontSize(13)
   .text('"[Outfit vibe] 🔥 They ran full speed. Didn\'t move an inch."', 62, capY + 10, { width: pageWidth() - 24 });
doc.fillColor(MUTED).font('Helvetica').fontSize(10)
   .text('#NBAJosh  #LoopingOfficers  #OutTheMud  #ViralMoment', 62, capY + 30, { width: pageWidth() - 24 });
doc.y = capY + 58;

doc.moveDown(0.5);
sectionTitle('Posting Strategy');
bullet('Each outfit clip posts on a DIFFERENT day — not all at once.');
bullet('Lead with Outfit B (white tee, golden hour) — most cinematic of the generated stills so far.');
bullet('Follow with the night version (Outfit C, NEVER JXST jersey) 2–3 days later.');
bullet('Save the Benz scene for last — biggest visual statement, maximum views.');
bullet('Caption each with the outfit vibe + the hook line about not moving an inch.');

doc.moveDown(0.5);
sectionTitle('Production Status — As of July 2026');
const statusItems = [
  { label: '✅  Character spec locked', done: true },
  { label: '✅  Outfit library A–H + Benz scene defined', done: true },
  { label: '✅  Reference image uploaded to Supabase', done: true },
  { label: '✅  Guided workflow seed updated', done: true },
  { label: '✅  Video Agent rebuilt with project dashboard', done: true },
  { label: '⏳  Video clips generated', done: false },
  { label: '⏳  Outfit B approved and posted', done: false },
];

statusItems.forEach(s => {
  doc.fillColor(s.done ? '#22C55E' : GOLD).font('Helvetica-Bold').fontSize(11)
     .text(s.label, 58, doc.y, { width: pageWidth() - 16 });
  doc.y += 2;
});

// Footer on last page
doc.fillColor(MUTED).font('Helvetica').fontSize(9)
   .text('NBA Josh · Looping Officers · Aurora Studio · July 2026 · auroraperformancestudio.com', 
     50, doc.page.height - 45, { width: pageWidth(), align: 'center' });

doc.end();
out.on('finish', () => console.log('PDF done'));
out.on('error', e => console.error('PDF error:', e.message));
