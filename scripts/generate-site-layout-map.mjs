import { chromium } from "playwright";
import { mkdir, writeFile, copyFile } from "node:fs/promises";

const outputPath = "public/Aurora-Site-Layout-Map.pdf";
const artifactOutputPath = "artifacts/web/public/Aurora-Site-Layout-Map.pdf";

const pages = [
  ["Public discovery", [
    ["/", "Landing", "Aurora introduction, featured tools, pricing entry, and creator onboarding."],
    ["/tools", "Tools", "Directory of Aurora’s creator tools."],
    ["/pricing", "Pricing", "Aura pricing, subscriptions, and purchase options."],
    ["/auth", "Sign in", "Secure account entry; returns users to the requested internal page."],
  ]],
  ["Creator workspace", [
    ["/home", "Home", "Personalized creator home and launch point."],
    ["/studio", "Studio", "Main signed-in creation workspace."],
    ["/motion", "Motion Control", "Perform Anywhere destination and performance builder."],
    ["/perform", "Perform Anywhere", "Compatibility alias that redirects to Motion Control."],
    ["/video-agent", "Aurora Video Agent", "Video planning and production workspace, listed under Content."],
    ["/avatar", "Talking Avatar Studio", "Photo avatar and script-to-video tools."],
  ]],
  ["Management & separate products", [
    ["/admin", "Admin Overview", "Operator controls and content-management entry point."],
    ["/admin/site-map", "Site Map", "Route inventory with links to the live routes and download of this map."],
    ["/admin/site-images", "Site Images", "Landing image controls."],
    ["/admin/site-copy", "Site Copy", "Landing copy controls."],
    ["/aurora-adult/", "Adult Center", "Separate 18+ product with an independent access gate."],
  ]],
];

const rows = pages.map(([group, items]) => `
  <section>
    <h2>${group}</h2>
    <div class="grid">
      ${items.map(([path, title, description]) => `
        <article>
          <code>${path}</code>
          <h3>${title}</h3>
          <p>${description}</p>
        </article>
      `).join("")}
    </div>
  </section>
`).join("");

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #EDE9FE; background: #080616; font-family: Arial, Helvetica, sans-serif; }
  .page { min-height: 100vh; padding: 2px; }
  .eyebrow { color: #C4B5FD; font-size: 10px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
  h1 { margin: 7px 0 6px; font-size: 29px; letter-spacing: -.05em; }
  .subtitle { max-width: 610px; color: #B5ADCB; font-size: 12px; line-height: 1.5; }
  .rule { height: 1px; margin: 17px 0 13px; background: linear-gradient(90deg, #8B5CF6, transparent); }
  section { margin: 0 0 15px; break-inside: avoid; }
  h2 { margin: 0 0 7px; color: #DDD6FE; font-size: 13px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
  article { min-height: 70px; padding: 10px; border: 1px solid #30254F; border-radius: 9px; background: #100C23; }
  code { color: #C4B5FD; font-size: 10px; }
  h3 { margin: 5px 0 4px; color: #F5F3FF; font-size: 12px; }
  p { margin: 0; color: #AAA1C2; font-size: 10px; line-height: 1.35; }
  footer { margin-top: 6px; color: #776D92; font-size: 9px; }
</style></head><body><main class="page">
  <div class="eyebrow">Aurora Performance Studio · management reference</div>
  <h1>Site layout map</h1>
  <p class="subtitle">A concise reference for the active creator experience, its management screens, and the intentional redirects that keep links consistent.</p>
  <div class="rule"></div>
  ${rows}
  <footer>Current map · Perform Anywhere resolves to Motion Control. Aurora Video Agent is available in the Content navigation.</footer>
</main></body></html>`;

await mkdir("public", { recursive: true });
await mkdir("artifacts/web/public", { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
  });
} finally {
  await browser.close();
}
await copyFile(outputPath, artifactOutputPath);
await writeFile("public/Aurora-Site-Layout-Map.html", html);
console.log(`Generated ${outputPath} and ${artifactOutputPath}`);