import { zipSync, strToU8 } from "fflate";
import { chainOrder, type Board } from "./board-store";

async function toBytes(url: string): Promise<{ bytes: Uint8Array; ext: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const type = res.headers.get("content-type") ?? "";
    const ext = type.includes("jpeg") ? "jpg" : type.includes("webp") ? "webp" : "png";
    return { bytes: buf, ext };
  } catch {
    return null;
  }
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export async function exportBoardZip(board: Board) {
  const order = chainOrder(board);
  const files: Record<string, Uint8Array> = {};

  const lines: string[] = [
    `# ${board.title}`,
    "",
    board.treatment,
    "",
    `Style preset: ${board.stylePreset}`,
    `Total runtime: ${order.reduce((a, s) => a + Number(s.duration || 0), 0).toFixed(1)}s`,
    "",
  ];

  for (let i = 0; i < order.length; i++) {
    const s = order[i];
    let framePath = "";
    if (s.imageUrl) {
      const asset = await toBytes(s.imageUrl);
      if (asset) {
        framePath = `frames/${pad(i + 1)}-${s.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${asset.ext}`;
        files[framePath] = asset.bytes;
      }
    }
    lines.push(
      `## ${pad(i + 1)} · ${s.title}`,
      `- Scene: ${s.scene}`,
      `- Duration: ${s.duration}s`,
      `- Shot type: ${s.shotType || "—"}`,
      `- Frame / camera: ${s.frame || "—"}`,
      `- Wardrobe: ${s.wardrobe || "—"}`,
      `- Mood: ${s.mood || "—"}`,
      `- Director note: ${s.note || "—"}`,
      `- Prompt: ${s.prompt || "—"}`,
      s.kind === "video"
        ? `- Video prompt (${s.videoModel ?? "seedance-2.5"}): ${s.videoPrompt || "—"}`
        : "",
      s.videoUrl ? `- Rendered video: ${s.videoUrl}` : "",
      framePath ? `- Frame file: ${framePath}` : `- Frame file: (not generated)`,
      "",
    );
  }

  if (board.characters.length) {
    lines.push("## Character sheet", "");
    for (const c of board.characters) {
      let sheetPath = "";
      if (c.imageUrl) {
        const asset = await toBytes(c.imageUrl);
        if (asset) {
          sheetPath = `characters/${c.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${asset.ext}`;
          files[sheetPath] = asset.bytes;
        }
      }
      lines.push(
        `### ${c.name}`,
        `- Description: ${c.description || "—"}`,
        `- Wardrobe: ${c.wardrobe || "—"}`,
        `- Signature props: ${c.props || "—"}`,
        `- Sheet prompt: ${c.prompt || "—"}`,
        sheetPath ? `- Sheet file: ${sheetPath}` : `- Sheet file: (not generated)`,
        "",
      );
    }
  }

  files["board.json"] = strToU8(
    JSON.stringify({ ...board, chain: order.map((s) => s.id) }, null, 2),
  );
  files["storyboard.md"] = strToU8(lines.join("\n"));
  files["shots.csv"] = strToU8(
    ["order,title,kind,scene,duration_seconds,shot_type,mood,prompt,video_model,video_prompt,video_url"]
      .concat(
        order.map((s, i) =>
          [
            i + 1,
            s.title,
            s.kind ?? "shot",
            s.scene,
            s.duration,
            s.shotType,
            s.mood,
            s.prompt,
            s.videoModel ?? "",
            s.videoPrompt ?? "",
            s.videoUrl ?? "",
          ]
            .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
            .join(","),
        ),
      )
      .join("\n"),
  );

  files["prompts.txt"] = strToU8(
    order
      .map(
        (s, i) =>
          `${pad(i + 1)} ${s.title}\nimage: ${s.prompt || "—"}\nvideo(${s.videoModel ?? "seedance-2.5"}): ${s.videoPrompt || "—"}\n`,
      )
      .join("\n"),
  );

  const zipped = zipSync(files, { level: 6 });
  const blob = new Blob([zipped as unknown as BlobPart], { type: "application/zip" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `${board.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "storyboard"}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 2000);
}
