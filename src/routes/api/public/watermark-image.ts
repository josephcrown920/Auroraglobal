import { createFileRoute } from "@tanstack/react-router";
import sharp from "sharp";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/watermark-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return new Response("Missing id", { status: 400 });

        const { data: gen, error } = await supabaseAdmin
          .from("generations")
          .select("id, result_image_url, is_watermarked, user_id")
          .eq("id", id)
          .maybeSingle() as { data: { id: string; result_image_url: string | null; is_watermarked: boolean; user_id: string } | null; error: unknown };

        if (error || !gen) return new Response("Not found", { status: 404 });
        if (!gen.result_image_url) return new Response("No image", { status: 404 });

        if (!(gen as any).is_watermarked) {
          return Response.redirect(gen.result_image_url, 302);
        }

        let imgBuffer: Buffer;
        try {
          const imgRes = await fetch(gen.result_image_url, {
            headers: { "User-Agent": "Aurora/1.0" },
            signal: AbortSignal.timeout(15_000),
          });
          if (!imgRes.ok) return new Response("Upstream fetch failed", { status: 502 });
          imgBuffer = Buffer.from(await imgRes.arrayBuffer());
        } catch {
          return new Response("Image fetch failed", { status: 502 });
        }

        let watermarked: Buffer;
        try {
          const meta = await sharp(imgBuffer).metadata();
          const w = meta.width ?? 512;
          const h = meta.height ?? 512;
          const fontSize = Math.max(18, Math.round(Math.min(w, h) * 0.065));
          const letterSpacing = Math.round(fontSize * 0.45);

          const svgWatermark = Buffer.from(
            `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
              <text
                x="50%" y="50%"
                font-family="Arial, Helvetica, sans-serif"
                font-size="${fontSize}"
                font-weight="bold"
                fill="rgba(255,255,255,0.42)"
                stroke="rgba(0,0,0,0.18)"
                stroke-width="1"
                text-anchor="middle"
                dominant-baseline="middle"
                letter-spacing="${letterSpacing}"
                transform="rotate(-28, ${w / 2}, ${h / 2})"
              >AURORA</text>
            </svg>`
          );

          watermarked = await sharp(imgBuffer)
            .composite([{ input: svgWatermark, blend: "over" }])
            .jpeg({ quality: 88, progressive: true })
            .toBuffer();
        } catch {
          return new Response("Watermark processing failed", { status: 500 });
        }

        return new Response(watermarked, {
          status: 200,
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            "X-Watermarked": "1",
          },
        });
      },
    },
  },
});
