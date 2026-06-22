/**
 * Colors Studio exports — download palette as JSON, CSS, or image.
 */

export type ExportFormat = "json" | "css" | "image" | "ase";

export interface ColorPalette {
  name: string;
  colors: Array<{ hex: string; label: string; rgb: string }>;
}

/**
 * Export palette as JSON
 */
export function exportPaletteAsJSON(palette: ColorPalette): string {
  return JSON.stringify(palette, null, 2);
}

/**
 * Export palette as CSS custom properties
 */
export function exportPaletteAsCSS(palette: ColorPalette): string {
  const lines = [":root {"];
  palette.colors.forEach((c, i) => {
    lines.push(`  --color-${palette.name.toLowerCase()}-${i + 1}: ${c.hex};`);
  });
  lines.push("}");
  return lines.join("\n");
}

/**
 * Export palette as Tailwind config
 */
export function exportPaletteAsTailwind(palette: ColorPalette): string {
  const colors: Record<string, string> = {};
  palette.colors.forEach((c, i) => {
    colors[`${palette.name.toLowerCase()}-${i + 1}`] = c.hex;
  });
  return `export const colors = ${JSON.stringify(colors, null, 2)};`;
}

/**
 * Export palette as PNG image (requires canvas/image generation)
 */
export function exportPaletteAsImage(palette: ColorPalette): string {
  // In production: use canvas or similar to generate a color swatch image
  // For now: return a data URL placeholder
  return `data:image/png;base64,...`; // Placeholder
}

/**
 * Download helper — trigger browser download
 */
export function downloadPalette(
  format: ExportFormat,
  palette: ColorPalette
): void {
  let content = "";
  let filename = `${palette.name.toLowerCase()}-palette`;
  let mimeType = "text/plain";

  if (format === "json") {
    content = exportPaletteAsJSON(palette);
    filename += ".json";
    mimeType = "application/json";
  } else if (format === "css") {
    content = exportPaletteAsCSS(palette);
    filename += ".css";
    mimeType = "text/css";
  } else if (format === "image") {
    content = exportPaletteAsImage(palette);
    filename += ".png";
    mimeType = "image/png";
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
