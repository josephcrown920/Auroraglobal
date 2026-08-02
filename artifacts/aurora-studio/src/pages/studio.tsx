import { useState } from "react";
import { useGeneratePhoto, useGetMe } from "@workspace/api-client-react";
import { Sparkles, Image as ImageIcon, Upload, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useSetActiveGeneration } from "@/contexts/generationWatcher";
import { CreditCostIndicator } from "@/components/CreditCostIndicator";

const PHOTO_COST = 10;

export default function ColorsStudioPage() {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "16:9" | "9:16" | "3:4">("3:4");
  const [style, setStyle] = useState<"cinematic" | "editorial" | "concert">("editorial");
  const generate = useGeneratePhoto();
  const [, setLocation] = useLocation();
  const setActiveGeneration = useSetActiveGeneration();
  const { data: user } = useGetMe();
  const insufficientCredits = user?.credits !== undefined && user.credits < PHOTO_COST;

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error("Please enter a direction for the shoot.");
      return;
    }
    
    generate.mutate(
      { data: { prompt, aspectRatio, style: style } },
      {
        onSuccess: (data) => {
          setActiveGeneration({ id: data.id, creditsUsed: PHOTO_COST });
          toast.success("Generation started! Check your gallery in a minute.");
          setPrompt("");
          setLocation("/dashboard");
        },
        onError: () => {
          toast.error("Failed to start generation. Check your credit balance.");
        }
      }
    );
  };

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff" }}>
      {/* ── Hero image header ── */}
      <div style={{ position: "relative", height: 220, overflow: "hidden" }}>
        <img
          src="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1400&q=90&fit=crop"
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.22 }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 0%, #080808 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 100% at 0% 50%, #FF6BCD12 0%, transparent 60%)" }} />
        <div style={{ position: "absolute", bottom: 28, left: 40 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.3em", color: "#FF6BCD", marginBottom: 10 }}>
            01 — PERFORMANCE PHOTO GENERATION
          </div>
          <div style={{ fontSize: "clamp(38px, 5vw, 60px)", fontWeight: 900, letterSpacing: "-0.04em", textTransform: "uppercase", lineHeight: 0.9 }}>
            COLORS
          </div>
        </div>
      </div>

      {/* ── Form content ── */}
      <div style={{ padding: "0 40px 48px" }}>
    <div className="flex flex-col lg:flex-row gap-8 pb-12">
      {/* Left Panel: Controls */}
      <div className="w-full lg:w-[400px] flex-shrink-0 flex flex-col gap-6 pr-2">
        <header>
          <p className="text-sm text-[#999999] mt-2 leading-relaxed">
            Direct your shoot. Define lighting, texture, and mood.
          </p>
        </header>

        <div className="space-y-6 flex-1">
          {/* Prompt */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-white">Director's Notes</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Medium shot, editorial fashion styling, vivid crimson studio lighting, 35mm grain, deep shadow..."
              className="w-full h-32 aurora-input resize-none font-mono text-sm"
            />
          </div>

          {/* Ratio */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-white">Aspect Ratio</label>
            <div className="grid grid-cols-4 gap-2">
              {(["1:1", "3:4", "16:9", "9:16"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setAspectRatio(r)}
                  className={`py-2 rounded-lg text-xs font-mono transition-all border ${
                    aspectRatio === r 
                      ? 'bg-white text-[#1A1A1A] border-white' 
                      : 'bg-[#2A2A2A] text-[#999999] border-[#333333] hover:border-[#555555]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-white">Style Preset</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "editorial", label: "Editorial" },
                { id: "cinematic", label: "Cinematic" },
                { id: "concert", label: "Concert" },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id as any)}
                  className={`py-2 rounded-lg text-xs font-medium transition-all border ${
                    style === s.id 
                      ? 'bg-[#2A2A2A] text-brand border-brand' 
                      : 'bg-[#1A1A1A] text-[#999999] border-[#333333] hover:border-[#555555]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reference Image Upload (Stub) */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-white flex justify-between">
              Reference Image <span className="text-[#666666] normal-case font-normal text-[10px]">Optional</span>
            </label>
            <button className="w-full py-4 border-2 border-dashed border-[#333333] rounded-xl flex flex-col items-center justify-center gap-2 hover:border-[#555555] hover:bg-[#2A2A2A]/50 transition-all text-[#999999]">
              <Upload size={16} />
              <span className="text-xs">Click to upload moodboard</span>
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-[#333333] space-y-3">
          <CreditCostIndicator
            cost={PHOTO_COST}
            balance={user?.credits}
            accentColor="#007AFF"
          />
          {insufficientCredits ? (
            <div className="w-full py-4 rounded-xl border border-[#FF453A]/40 bg-[#FF453A]/10 flex items-center justify-center gap-2 text-sm font-bold text-[#FF453A] uppercase tracking-widest">
              Not enough credits — top up
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generate.isPending}
              className="w-full aurora-btn-primary flex items-center justify-center gap-2 py-4 text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(0,122,255,0.3)] hover:shadow-[0_0_30px_rgba(0,122,255,0.5)]"
            >
              {generate.isPending ? (
                <><Loader2 className="animate-spin" size={16} /> Rendering...</>
              ) : (
                <><Sparkles size={16} /> Render Shot</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Right Panel: Preview Space */}
      <div className="flex-1 bg-[#111111] rounded-2xl border border-[#1a1a1a] overflow-hidden flex flex-col items-center justify-center relative" style={{ minHeight: 320 }}>
        <img
          src="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80&fit=crop"
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.06 }}
        />
        <div className="text-center max-w-sm px-6 relative z-10">
          <div className="w-16 h-16 rounded-full bg-[#1A1A1A] border border-[#333333] flex items-center justify-center mx-auto mb-6">
            <ImageIcon className="text-[#666666]" size={24} />
          </div>
          <h3 className="text-xl font-display font-semibold text-white mb-2">Stage empty</h3>
          <p className="text-sm text-[#666666]">Configure your direction and render to see your shot here.</p>
        </div>
      </div>
    </div>
      </div>
    </div>
  );
}
