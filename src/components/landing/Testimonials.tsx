import { Star } from "lucide-react";

const REVIEWS = [
  {
    name: "Josh A.",
    handle: "@joshmadethis",
    location: "Lagos 🇳🇬",
    device: "iPhone 16 Pro",
    stars: 5,
    text: "Aurora replaced a $4k photoshoot. Shot a full EP cover series on a Tuesday night — no crew, no studio.",
  },
  {
    name: "Kayla M.",
    handle: "@kaylabeats",
    location: "Atlanta, GA",
    device: "Galaxy S25 Ultra",
    stars: 5,
    text: "Posted 3 videos from one selfie. Two of them hit 500K. I haven't paid for a studio since.",
  },
  {
    name: "Dre V.",
    handle: "@dre.vibz",
    location: "London 🇬🇧",
    device: "iPhone 15 Pro Max",
    stars: 5,
    text: "TikTok30 gave me a month of content from one hook. My engagement is up 3×. No editing required.",
  },
  {
    name: "Aisha T.",
    handle: "@aishamusic_",
    location: "Toronto 🇨🇦",
    device: "Pixel 9 Pro",
    stars: 5,
    text: "Colors Studio is insane. Pick a color, upload your selfie, and you're inside a real cyclorama set in seconds.",
  },
  {
    name: "Marcus B.",
    handle: "@marcuslive",
    location: "Houston, TX",
    device: "iPhone 16 Pro Max",
    stars: 5,
    text: "Lip-sync to my drill track took 45 seconds. The output looked like something from a Netflix short.",
  },
  {
    name: "Zara O.",
    handle: "@zaraoshop",
    location: "Dubai 🇦🇪",
    device: "Samsung Galaxy S25",
    stars: 5,
    text: "Used the UGC Ad tool to launch my product. ROI hit 4× the first week. No agency, no brief.",
  },
  {
    name: "Elias R.",
    handle: "@eliasrecords",
    location: "Lagos 🇳🇬",
    device: "iPhone 15",
    stars: 5,
    text: "From selfie to music video under a minute. Dropped it the same night the beat was mixed.",
  },
  {
    name: "Nadia S.",
    handle: "@nadia.creates",
    location: "New York, NY",
    device: "iPhone 16",
    stars: 5,
    text: "Perform Anywhere is another level. I filmed in my living room — Aurora put me on a concert stage.",
  },
  {
    name: "Theo K.",
    handle: "@theoklive",
    location: "Accra 🇬🇭",
    device: "Galaxy S24 Ultra",
    stars: 5,
    text: "Multi-angle reshoot from one photo. Six camera angles, same outfit, same identity. Absolute fire.",
  },
  {
    name: "Priya N.",
    handle: "@priyaonsound",
    location: "Mumbai 🇮🇳",
    device: "iPhone 16 Pro",
    stars: 5,
    text: "I dropped a UGC ad for my merch line at midnight. Sold out by morning. Aurora is dangerous.",
  },
];

const DOUBLED = [...REVIEWS, ...REVIEWS];

export function Testimonials() {
  return (
    <section className="relative z-10 py-14 overflow-hidden border-y border-white/[0.06]">
      {/* Header */}
      <div className="text-center mb-8 px-6">
        <div className="inline-flex items-center gap-1.5 mb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="size-3.5 fill-amber-300 text-amber-300" />
          ))}
          <span className="text-white/45 text-xs ml-1.5">4.9 · 2,400+ creators · 40+ countries</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          Creators love Aurora
        </h2>
      </div>

      {/* Marquee track */}
      <div
        className="flex gap-4 w-max"
        style={{ animation: "testimonials-scroll 40s linear infinite" }}
      >
        {DOUBLED.map((r, idx) => (
          <ReviewCard key={idx} review={r} />
        ))}
      </div>

      <style>{`
        @keyframes testimonials-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}

function ReviewCard({ review }: { review: typeof REVIEWS[number] }) {
  return (
    <div className="w-72 shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] p-5 flex flex-col gap-3">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: review.stars }).map((_, i) => (
          <Star key={i} className="size-3 fill-amber-300 text-amber-300" />
        ))}
      </div>
      <p className="text-sm text-white/85 leading-relaxed flex-1">"{review.text}"</p>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white leading-none">{review.name}</p>
          <p className="text-[11px] text-white/45 mt-0.5">{review.handle} · {review.location}</p>
        </div>
        <span className="text-[10px] text-white/30 shrink-0">{review.device}</span>
      </div>
    </div>
  );
}
