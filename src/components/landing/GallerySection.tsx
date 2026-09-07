import { Suspense, lazy } from "react";
import { EditableCopy } from "@/components/EditableCopy";

const PhotoStrip = lazy(() =>
  import("@/components/landing/PhotoStrip").then((m) => ({ default: m.PhotoStrip })),
);

export function GallerySection() {
  return (
    <section id="gallery" className="bg-zinc-900/30 py-20 border-y border-white/5 overflow-hidden">
      <div className="px-5 mb-10">
        <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#8b5cf6]">
          Output gallery
        </span>
        <h2 className="mt-3 text-4xl font-semibold leading-tight">
          <EditableCopy copyKey="landing_gallery_heading" fallback="Real artists. Real outputs. Zero stock." />
        </h2>
        <p className="mt-3 text-sm text-zinc-400">
          <EditableCopy copyKey="landing_gallery_sub" fallback="A curated feed of recent generations across covers, promo, and motion." />
        </p>
      </div>
      <Suspense fallback={null}>
        <PhotoStrip
          rows={[
            {
              direction: "left",
              duration: 38,
              className: "mb-3",
              items: [
                { src: "/josh-ref-1.png", alt: "NBA Josh — artist promo", tag: <EditableCopy copyKey="landing_marquee_r1_1_tag" fallback="Promo" />, createTo: "/studio", prompt: "" },
                { src: "/landing-client-2.png", alt: "Editorial shoot", tag: <EditableCopy copyKey="landing_marquee_r1_2_tag" fallback="Editorial" />, createTo: "/studio", prompt: "" },
                { src: "/landing-client-4.png", alt: "Backstage promo", tag: <EditableCopy copyKey="landing_marquee_r1_3_tag" fallback="Promo" />, createTo: "/studio", prompt: "" },
                { src: "/landing-photo-3.jpeg", alt: "Album artwork", tag: <EditableCopy copyKey="landing_marquee_r1_4_tag" fallback="Cover art" />, createTo: "/studio", prompt: "" },
                { src: "/spotlight/ski-selfie.jpeg", alt: "Ski day reference", tag: <EditableCopy copyKey="landing_marquee_r1_5_tag" fallback="Ski day" />, createTo: "/studio", prompt: "" },
              ],
            },
            {
              direction: "right",
              duration: 30,
              items: [
                { src: "/landing-client-5.png", alt: "Concert energy", tag: <EditableCopy copyKey="landing_marquee_r2_1_tag" fallback="Concert" />, createTo: "/colors" },
                { src: "/josh-scene-still.jpeg", alt: "NBA Josh — scene still", tag: <EditableCopy copyKey="landing_marquee_r2_2_tag" fallback="Cinema" />, createTo: "/music-video" },
                { src: "/landing-client-7.png", alt: "Editorial glam", tag: <EditableCopy copyKey="landing_marquee_r2_3_tag" fallback="Glam" />, createTo: "/studio", prompt: "" },
                { src: "/landing-photo-5.jpeg", alt: "Cinematic scene", tag: <EditableCopy copyKey="landing_marquee_r2_4_tag" fallback="Cinema" />, createTo: "/music-video" },
                { src: "/landing-photo-6.png", alt: "Color grade", tag: <EditableCopy copyKey="landing_marquee_r2_5_tag" fallback="Color" />, createTo: "/colors" },
              ],
            },
          ]}
        />
      </Suspense>
    </section>
  );
}
