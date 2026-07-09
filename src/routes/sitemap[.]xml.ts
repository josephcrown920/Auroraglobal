import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://aurorastudiostar.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/canvas", changefreq: "weekly", priority: "0.9" },
  { path: "/colors", changefreq: "weekly", priority: "0.8" },
  { path: "/ugc", changefreq: "weekly", priority: "0.8" },
  { path: "/music-video", changefreq: "weekly", priority: "0.8" },
  { path: "/lipsync", changefreq: "weekly", priority: "0.8" },
  { path: "/motion", changefreq: "weekly", priority: "0.8" },
  { path: "/spin", changefreq: "weekly", priority: "0.8" },
  { path: "/tiktok", changefreq: "weekly", priority: "0.8" },
  { path: "/photo-edit", changefreq: "weekly", priority: "0.8" },
  { path: "/orchestrate", changefreq: "weekly", priority: "0.8" },
  { path: "/agent", changefreq: "weekly", priority: "0.7" },
  { path: "/speech", changefreq: "weekly", priority: "0.7" },
  { path: "/edit", changefreq: "weekly", priority: "0.7" },
  { path: "/reshoot", changefreq: "weekly", priority: "0.7" },
  { path: "/split-reality", changefreq: "weekly", priority: "0.7" },
  { path: "/content-machine", changefreq: "weekly", priority: "0.7" },
  { path: "/kids", changefreq: "weekly", priority: "0.7" },
  { path: "/workflows", changefreq: "weekly", priority: "0.7" },
  { path: "/gallery", changefreq: "daily", priority: "0.7" },
  { path: "/templates", changefreq: "weekly", priority: "0.6" },
  { path: "/marketplace", changefreq: "weekly", priority: "0.6" },
  { path: "/growth", changefreq: "weekly", priority: "0.6" },
  { path: "/guides", changefreq: "weekly", priority: "0.6" },
  { path: "/roadmap", changefreq: "monthly", priority: "0.5" },
  { path: "/gifts", changefreq: "monthly", priority: "0.5" },
  { path: "/affiliate", changefreq: "monthly", priority: "0.5" },
  { path: "/contact", changefreq: "monthly", priority: "0.4" },
  { path: "/connect", changefreq: "monthly", priority: "0.4" },
  { path: "/legal/terms", changefreq: "yearly", priority: "0.3" },
  { path: "/legal/privacy", changefreq: "yearly", priority: "0.3" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = ENTRIES.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
