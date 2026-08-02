import { useState } from "react";
import { useGenerateUgc, useGetMe } from "@workspace/api-client-react";
import { Smartphone, Sparkles, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useSetActiveGeneration } from "@/contexts/generationWatcher";
import { CreditCostIndicator } from "@/components/CreditCostIndicator";

const UGC_COST = 85;

export default function UgcFactoryPage() {
  const [prompt, setPrompt] = useState("");
  const [avatarStyle, setAvatarStyle] = useState<"lifestyle" | "studio" | "unboxing">("lifestyle");
  const generate = useGenerateUgc();
  const [, setLocation] = useLocation();
  const setActiveGeneration = useSetActiveGeneration();
  const { data: user } = useGetMe();
  const insufficientCredits = user?.credits !== undefined && user.credits < UGC_COST;

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error("Please provide the script or product description.");
      return;
    }
    
    generate.mutate(
      { data: { prompt, productDescription: prompt, avatarStyle } },
      {
        onSuccess: (data) => {
          setActiveGeneration({ id: data.id, creditsUsed: UGC_COST });
          toast.success("UGC Generation queued!");
          setLocation("/dashboard");
        },
        onError: () => {
          toast.error("Failed to queue generation.");
        }
      }
    );
  };

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff" }}>
      {/* ── Hero image header ── */}
      <div style={{ position: "relative", height: 220, overflow: "hidden" }}>
        <img
          src="https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=1400&q=90&fit=crop"
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.22 }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 0%, #080808 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 100% at 0% 50%, #A78BFF12 0%, transparent 60%)" }} />
        <div style={{ position: "absolute", bottom: 28, left: 40 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.3em", color: "#A78BFF", marginBottom: 10 }}>
            02 — UGC CAMPAIGN ENGINE
          </div>
          <div style={{ fontSize: "clamp(38px, 5vw, 60px)", fontWeight: 900, letterSpacing: "-0.04em", textTransform: "uppercase", lineHeight: 0.9 }}>
            TIKTOK30
          </div>
        </div>
      </div>

      {/* ── Form content ── */}
      <div style={{ padding: "0 40px 48px" }}>
    <div className="flex flex-col lg:flex-row gap-8 pb-12">
      <div className="w-full lg:w-[400px] flex-shrink-0 flex flex-col gap-6 pr-2">
        <header>
          <p className="text-sm text-[#999999] mt-2 leading-relaxed">
            Generate talking-head vertical content from a script.
          </p>
        </header>

        <div className="space-y-6 flex-1">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-white">Script / Description</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Hey guys, I just tried the new Aurora Studio and it completely changed how we do cover art..."
              className="w-full h-40 aurora-input resize-none font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-white">Avatar Persona</label>
            <div className="grid grid-cols-1 gap-2">
              {[
                { id: "lifestyle", label: "Casual / Bedroom" },
                { id: "studio", label: "Creator / Studio Light" },
                { id: "unboxing", label: "Professional / Office" },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setAvatarStyle(s.id as any)}
                  className={`py-3 px-4 rounded-lg text-sm text-left transition-all border ${
                    avatarStyle === s.id 
                      ? 'bg-[#2A2A2A] text-white border-[#FF3B30]' 
                      : 'bg-[#1A1A1A] text-[#999999] border-[#333333] hover:border-[#555555]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-[#333333] space-y-3">
          <CreditCostIndicator
            cost={UGC_COST}
            balance={user?.credits}
            accentColor="#FF3B30"
          />
          {insufficientCredits ? (
            <div className="w-full py-4 rounded-xl border border-[#FF453A]/40 bg-[#FF453A]/10 flex items-center justify-center gap-2 text-sm font-bold text-[#FF453A] uppercase tracking-widest">
              Not enough credits — top up
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generate.isPending}
              className="w-full aurora-btn-primary flex items-center justify-center gap-2 py-4 text-sm uppercase tracking-widest bg-[#FF3B30] hover:bg-[#D70015] border-none"
            >
              {generate.isPending ? (
                <><Loader2 className="animate-spin" size={16} /> Queuing...</>
              ) : (
                <><Smartphone size={16} /> Render 30s Clip</>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 bg-[#111111] rounded-2xl border border-[#1a1a1a] overflow-hidden flex flex-col items-center justify-center relative" style={{ minHeight: 320 }}>
        <img
          src="https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=80&fit=crop"
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.07 }}
        />
        <div className="text-center max-w-sm px-6 relative z-10">
          <div className="w-16 h-32 rounded-lg border-2 border-[#333333] border-dashed flex items-center justify-center mx-auto mb-6">
            <User className="text-[#666666]" size={24} />
          </div>
          <h3 className="text-xl font-display font-semibold text-white mb-2">9:16 Optimized</h3>
          <p className="text-sm text-[#666666]">Pre-formatted for TikTok, Reels, and Shorts.</p>
        </div>
      </div>
    </div>
      </div>
    </div>
  );
}
