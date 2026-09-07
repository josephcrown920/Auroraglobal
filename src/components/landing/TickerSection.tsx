const TICKER_ITEMS = [
  "Go viral in 30 seconds",
  "$50K look · zero crew",
  "30s phone clip → cinematic reel",
  "10 hours saved every week",
  "1,000+ artists scaled",
  "No crew · No studio",
  "Phone recording → music video",
  "Director's chair · your phone",
];

export function TickerSection() {
  return (
    <div className="overflow-hidden border-b border-white/5 bg-zinc-900/40 py-4">
      <div className="flex w-max animate-ticker gap-12 whitespace-nowrap px-6 text-xs font-bold tracking-[0.3em] text-zinc-500 uppercase">
        {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((label, i) => (
          <span key={i} className="flex items-center gap-12">
            <span>{label}</span>
            <span className="text-[#8b5cf6]">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
