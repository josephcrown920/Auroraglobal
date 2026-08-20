/* Generates reproducible, store-ready listing graphics from Aurora's real feature set. */
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "store-assets");
const featureGraphic = path.join(root, "assets/images/feature-graphic.png");

const IOS = { width: 1290, height: 2796 };
const ANDROID = { width: 1440, height: 2560 };

const esc = (value) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function scene({ width, height, eyebrow, headline, subhead, screen, accent = "#a855f7" }) {
  const scale = width / 1290;
  const deviceW = Math.round(width * 0.78);
  const deviceH = Math.round(height * 0.59);
  const deviceX = Math.round((width - deviceW) / 2);
  const deviceY = Math.round(height * 0.35);
  const titleSize = Math.round(72 * scale);
  const bodySize = Math.round(30 * scale);

  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="background" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#090613"/>
        <stop offset="0.52" stop-color="#170d31"/>
        <stop offset="1" stop-color="#090613"/>
      </linearGradient>
      <radialGradient id="halo" cx="50%" cy="18%" r="55%">
        <stop offset="0" stop-color="${accent}" stop-opacity="0.42"/>
        <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
      </radialGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="34" stdDeviation="34" flood-color="#000000" flood-opacity="0.62"/>
      </filter>
      <clipPath id="screenClip"><rect x="${deviceX + 18}" y="${deviceY + 18}" width="${deviceW - 36}" height="${deviceH - 36}" rx="${Math.round(56 * scale)}"/></clipPath>
    </defs>
    <rect width="100%" height="100%" fill="url(#background)"/>
    <rect width="100%" height="100%" fill="url(#halo)"/>
    <circle cx="${Math.round(width * 0.86)}" cy="${Math.round(height * 0.86)}" r="${Math.round(width * 0.34)}" fill="${accent}" opacity="0.09"/>
    <text x="${width / 2}" y="${Math.round(height * 0.09)}" text-anchor="middle" fill="${accent}" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(22 * scale)}" font-weight="700" letter-spacing="${Math.round(5 * scale)}">${esc(eyebrow.toUpperCase())}</text>
    <text x="${width / 2}" y="${Math.round(height * 0.15)}" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${titleSize}" font-weight="800">${esc(headline)}</text>
    <text x="${width / 2}" y="${Math.round(height * 0.19)}" text-anchor="middle" fill="#c6b6dc" font-family="Arial, Helvetica, sans-serif" font-size="${bodySize}" font-weight="400">${esc(subhead)}</text>
    <rect x="${deviceX}" y="${deviceY}" width="${deviceW}" height="${deviceH}" rx="${Math.round(74 * scale)}" fill="#05040a" stroke="#6d5a8a" stroke-width="${Math.max(2, Math.round(2 * scale))}" filter="url(#shadow)"/>
    <rect x="${deviceX + Math.round(deviceW * 0.38)}" y="${deviceY + 14}" width="${Math.round(deviceW * 0.24)}" height="${Math.round(28 * scale)}" rx="${Math.round(14 * scale)}" fill="#05040a"/>
    <g clip-path="url(#screenClip)">${screen({ x: deviceX + 18, y: deviceY + 18, width: deviceW - 36, height: deviceH - 36, accent, scale })}</g>
    <text x="${width / 2}" y="${Math.round(height * 0.95)}" text-anchor="middle" fill="#8f7aa9" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(20 * scale)}" font-weight="700" letter-spacing="${Math.round(3 * scale)}">AURORA STUDIO</text>
  </svg>`;
}

function studioScreen({ x, y, width, height, accent, scale }) {
  const cards = [
    ["Performance Shot", "#6638b8"],
    ["Music Video Still", "#281558"],
    ["Colors Studio", "#07586e"],
    ["Editorial Look", "#155a44"],
  ];
  const pad = Math.round(26 * scale);
  const colGap = Math.round(14 * scale);
  const cardW = Math.round((width - pad * 2 - colGap) / 2);
  const cardH = Math.round(cardW * 1.22);
  const headerY = y + Math.round(44 * scale);
  const gridY = y + Math.round(178 * scale);
  const rows = cards.map(([label, color], i) => {
    const cx = x + pad + (i % 2) * (cardW + colGap);
    const cy = gridY + Math.floor(i / 2) * (cardH + colGap);
    return `
      <rect x="${cx}" y="${cy}" width="${cardW}" height="${cardH}" rx="${Math.round(22 * scale)}" fill="${color}"/>
      <circle cx="${cx + cardW * 0.72}" cy="${cy + cardH * 0.28}" r="${cardW * 0.35}" fill="${accent}" opacity="0.3"/>
      <rect x="${cx + Math.round(14 * scale)}" y="${cy + Math.round(cardH * 0.65)}" width="${Math.round(cardW * 0.55)}" height="${Math.round(8 * scale)}" rx="4" fill="#ffffff" opacity="0.8"/>
      <text x="${cx + Math.round(14 * scale)}" y="${cy + Math.round(cardH * 0.84)}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(19 * scale)}" font-weight="700">${esc(label)}</text>`;
  }).join("");
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#0d0a17"/>
    <text x="${x + pad}" y="${headerY}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(29 * scale)}" font-weight="800">Aurora</text>
    <rect x="${x + width - Math.round(142 * scale)}" y="${y + Math.round(24 * scale)}" width="${Math.round(112 * scale)}" height="${Math.round(44 * scale)}" rx="${Math.round(22 * scale)}" fill="#242034" stroke="#4f4168"/>
    <text x="${x + width - Math.round(86 * scale)}" y="${y + Math.round(53 * scale)}" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(16 * scale)}" font-weight="700">25 Aura</text>
    <text x="${x + pad}" y="${y + Math.round(116 * scale)}" fill="#c8b7df" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(19 * scale)}">Pick a direction. Make it yours.</text>
    ${rows}
    <rect x="${x + pad}" y="${y + height - Math.round(150 * scale)}" width="${width - pad * 2}" height="${Math.round(92 * scale)}" rx="${Math.round(32 * scale)}" fill="#211635" stroke="#7750c6"/>
    <text x="${x + Math.round(width * 0.14)}" y="${y + height - Math.round(94 * scale)}" fill="#aa89ff" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(19 * scale)}" font-weight="700">✦</text>
    <text x="${x + Math.round(width * 0.23)}" y="${y + height - Math.round(94 * scale)}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(18 * scale)}">Describe your vision…</text>`;
}

function performScreen({ x, y, width, height, accent, scale }) {
  const pad = Math.round(28 * scale);
  const panelY = y + Math.round(165 * scale);
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#0d0a17"/>
    <text x="${x + pad}" y="${y + Math.round(52 * scale)}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(28 * scale)}" font-weight="800">Perform Anywhere</text>
    <text x="${x + pad}" y="${y + Math.round(86 * scale)}" fill="#c8b7df" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(17 * scale)}">Film on your phone — Aurora swaps the scene</text>
    <rect x="${x + pad}" y="${y + Math.round(112 * scale)}" width="${width - pad * 2}" height="${Math.round(44 * scale)}" rx="${Math.round(12 * scale)}" fill="#231b35"/>
    <rect x="${x + pad + 4}" y="${y + Math.round(116 * scale)}" width="${Math.round((width - pad * 2) / 2 - 8)}" height="${Math.round(36 * scale)}" rx="${Math.round(10 * scale)}" fill="${accent}"/>
    <text x="${x + Math.round(width * 0.28)}" y="${y + Math.round(142 * scale)}" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(15 * scale)}" font-weight="700">Reskin my clip</text>
    <text x="${x + Math.round(width * 0.72)}" y="${y + Math.round(142 * scale)}" text-anchor="middle" fill="#c8b7df" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(15 * scale)}" font-weight="700">From a photo</text>
    <text x="${x + pad}" y="${panelY - Math.round(16 * scale)}" fill="#c8b7df" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(15 * scale)}">YOUR PERFORMANCE CLIP</text>
    <rect x="${x + pad}" y="${panelY}" width="${width - pad * 2}" height="${Math.round(168 * scale)}" rx="${Math.round(20 * scale)}" fill="#181321" stroke="#4f4168"/>
    <circle cx="${x + Math.round(width / 2)}" cy="${panelY + Math.round(70 * scale)}" r="${Math.round(30 * scale)}" fill="${accent}" opacity="0.82"/>
    <path d="M ${x + Math.round(width / 2 - 6 * scale)} ${panelY + Math.round(55 * scale)} L ${x + Math.round(width / 2 - 6 * scale)} ${panelY + Math.round(85 * scale)} L ${x + Math.round(width / 2 + 18 * scale)} ${panelY + Math.round(70 * scale)} Z" fill="#ffffff"/>
    <text x="${x + Math.round(width / 2)}" y="${panelY + Math.round(125 * scale)}" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(18 * scale)}" font-weight="700">Film yourself performing</text>
    <text x="${x + Math.round(width / 2)}" y="${panelY + Math.round(148 * scale)}" text-anchor="middle" fill="#b7a4cb" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(14 * scale)}">Up to 30 seconds</text>
    <text x="${x + pad}" y="${panelY + Math.round(220 * scale)}" fill="#c8b7df" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(15 * scale)}">NEW SCENE</text>
    ${["Studio", "Street", "Stage", "Minimal"].map((label, index) => {
      const boxW = Math.round((width - pad * 2 - 18 * scale) / 2);
      const bx = x + pad + (index % 2) * (boxW + Math.round(18 * scale));
      const by = panelY + Math.round(240 * scale) + Math.floor(index / 2) * Math.round(80 * scale);
      const active = index === 0;
      return `<rect x="${bx}" y="${by}" width="${boxW}" height="${Math.round(62 * scale)}" rx="${Math.round(15 * scale)}" fill="${active ? accent : "#181321"}" stroke="${active ? accent : "#4f4168"}"/>
        <text x="${bx + boxW / 2}" y="${by + Math.round(39 * scale)}" text-anchor="middle" fill="${active ? "#ffffff" : "#d7cae7"}" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(16 * scale)}" font-weight="700">${label}</text>`;
    }).join("")}
    <rect x="${x + pad}" y="${y + height - Math.round(138 * scale)}" width="${width - pad * 2}" height="${Math.round(62 * scale)}" rx="${Math.round(20 * scale)}" fill="${accent}"/>
    <text x="${x + width / 2}" y="${y + height - Math.round(99 * scale)}" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(18 * scale)}" font-weight="800">Create a preview</text>`;
}

function galleryScreen({ x, y, width, height, accent, scale }) {
  const pad = Math.round(28 * scale);
  const cardGap = Math.round(14 * scale);
  const cardW = Math.round((width - pad * 2 - cardGap) / 2);
  const cardH = Math.round(cardW * 1.26);
  const colors = ["#6b3bc4", "#063f62", "#5c153b", "#12633e", "#3c2570", "#6e4218"];
  const cards = colors.map((color, i) => {
    const cx = x + pad + (i % 2) * (cardW + cardGap);
    const cy = y + Math.round(130 * scale) + Math.floor(i / 2) * (cardH + cardGap);
    return `<rect x="${cx}" y="${cy}" width="${cardW}" height="${cardH}" rx="${Math.round(20 * scale)}" fill="${color}"/>
      <circle cx="${cx + cardW * 0.34}" cy="${cy + cardH * 0.36}" r="${cardW * 0.22}" fill="#ffffff" opacity="0.2"/>
      <rect x="${cx + Math.round(12 * scale)}" y="${cy + cardH - Math.round(38 * scale)}" width="${Math.round(66 * scale)}" height="${Math.round(24 * scale)}" rx="${Math.round(8 * scale)}" fill="#0d0a17" opacity="0.75"/>
      <text x="${cx + Math.round(45 * scale)}" y="${cy + cardH - Math.round(21 * scale)}" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(12 * scale)}">image</text>`;
  }).join("");
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#0d0a17"/>
    <text x="${x + pad}" y="${y + Math.round(58 * scale)}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(30 * scale)}" font-weight="800">Gallery</text>
    <text x="${x + pad}" y="${y + Math.round(88 * scale)}" fill="#c8b7df" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(17 * scale)}">Your ideas, ready to revisit and share</text>
    ${cards}
    <rect x="${x + pad}" y="${y + height - Math.round(124 * scale)}" width="${width - pad * 2}" height="${Math.round(58 * scale)}" rx="${Math.round(18 * scale)}" fill="#1c162a" stroke="#4f4168"/>
    <text x="${x + width / 2}" y="${y + height - Math.round(87 * scale)}" text-anchor="middle" fill="${accent}" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(17 * scale)}" font-weight="700">Tap any piece to share it</text>`;
}

function canvasScreen({ x, y, width, height, accent, scale }) {
  const pad = Math.round(28 * scale);
  const nodes = [
    [0.18, 0.23, "#6541bd", "Reference"],
    [0.66, 0.39, "#064d70", "Scene"],
    [0.27, 0.63, "#6c244c", "Motion"],
    [0.70, 0.74, "#185d43", "Render"],
  ];
  const boardY = y + Math.round(130 * scale);
  const boardH = Math.round(height * 0.68);
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#0d0a17"/>
    <text x="${x + pad}" y="${y + Math.round(58 * scale)}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(29 * scale)}" font-weight="800">Infinity Canvas</text>
    <text x="${x + pad}" y="${y + Math.round(89 * scale)}" fill="#c8b7df" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(17 * scale)}">Build the exact shot you see in your head</text>
    <rect x="${x + pad}" y="${boardY}" width="${width - pad * 2}" height="${boardH}" rx="${Math.round(24 * scale)}" fill="#120e1c" stroke="#4f4168"/>
    <path d="M ${x + width * 0.30} ${boardY + boardH * 0.32} C ${x + width * 0.48} ${boardY + boardH * 0.27}, ${x + width * 0.52} ${boardY + boardH * 0.45}, ${x + width * 0.67} ${boardY + boardH * 0.44}" stroke="#7750c6" stroke-width="${Math.round(4 * scale)}" fill="none"/>
    <path d="M ${x + width * 0.30} ${boardY + boardH * 0.64} C ${x + width * 0.52} ${boardY + boardH * 0.66}, ${x + width * 0.53} ${boardY + boardH * 0.76}, ${x + width * 0.70} ${boardY + boardH * 0.78}" stroke="#7750c6" stroke-width="${Math.round(4 * scale)}" fill="none"/>
    ${nodes.map(([nx, ny, color, label]) => {
      const bw = Math.round(126 * scale); const bh = Math.round(92 * scale);
      const bx = x + width * nx - bw / 2; const by = boardY + boardH * ny - bh / 2;
      return `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${Math.round(16 * scale)}" fill="${color}" stroke="#b291ff" stroke-width="2"/>
        <circle cx="${bx + Math.round(24 * scale)}" cy="${by + Math.round(28 * scale)}" r="${Math.round(9 * scale)}" fill="${accent}"/>
        <text x="${bx + Math.round(16 * scale)}" y="${by + Math.round(66 * scale)}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(15 * scale)}" font-weight="700">${label}</text>`;
    }).join("")}
    <rect x="${x + pad}" y="${y + height - Math.round(122 * scale)}" width="${width - pad * 2}" height="${Math.round(58 * scale)}" rx="${Math.round(18 * scale)}" fill="${accent}"/>
    <text x="${x + width / 2}" y="${y + height - Math.round(85 * scale)}" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(17 * scale)}" font-weight="800">Direct every detail</text>`;
}

const slides = [
  {
    filename: "01-create-your-shot",
    eyebrow: "Your pocket creative studio",
    headline: "Make the shot yours.",
    subhead: "Direct a cinematic image in minutes, not days.",
    accent: "#a855f7",
    screen: studioScreen,
  },
  {
    filename: "02-perform-anywhere",
    eyebrow: "Perform anywhere",
    headline: "Keep your performance. Change the world.",
    subhead: "Swap the scene around your clip without losing your energy.",
    accent: "#8b5cf6",
    screen: performScreen,
  },
  {
    filename: "03-your-gallery",
    eyebrow: "Everything you create",
    headline: "Your visual world, together.",
    subhead: "Revisit, refine, and share every piece from one gallery.",
    accent: "#c084fc",
    screen: galleryScreen,
  },
  {
    filename: "04-direct-every-detail",
    eyebrow: "Go beyond a prompt",
    headline: "Direct every detail.",
    subhead: "Shape references, scenes, motion, and final renders your way.",
    accent: "#a855f7",
    screen: canvasScreen,
  },
];

async function writeGallery(platform, size) {
  const dir = path.join(out, platform);
  fs.mkdirSync(dir, { recursive: true });
  for (const slide of slides) {
    const svg = scene({ ...size, ...slide });
    await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(dir, `${slide.filename}.png`));
  }
}

async function main() {
  await writeGallery("ios", IOS);
  await writeGallery("android", ANDROID);
  await sharp(featureGraphic)
    .resize(1024, 500, { fit: "cover", position: "centre" })
    .flatten({ background: "#10091d" })
    .png({ compressionLevel: 9 })
    .toFile(path.join(out, "android", "feature-graphic.png"));
  console.log(`Store assets written to ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});