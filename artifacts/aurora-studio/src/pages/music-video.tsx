import { useState } from "react";
import { useGenerateMusicVideo, useGetMe } from "@workspace/api-client-react";
import { Music, Film, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useSetActiveGeneration } from "@/contexts/generationWatcher";
import { CreditCostIndicator } from "@/components/CreditCostIndicator";

const MUSIC_VIDEO_COST = 50;

export default function MusicVideoStudioPage() {
  const [prompt, setPrompt] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const generate = useGenerateMusicVideo();
  const [, setLocation] = useLocation();
  const setActiveGeneration = useSetActiveGeneration();
  const { data: user } = useGetMe();
  const insufficientCredits = user?.credits !== undefined && user.credits < MUSIC_VIDEO_COST;

  const handleGenerate = () => {
    if (!prompt.trim() || !audioUrl.trim()) {
      toast.error("Please provide both scene direction and audio URL.");
      return;
    }
    
    generate.mutate(
      { data: { prompt, audioUrl } },
      {
        onSuccess: (data) => {
          setActiveGeneration({ id: data.id, creditsUsed: MUSIC_VIDEO_COST });
          toast.success("Music video generation started!");
          setLocation("/dashboard");
        },
        onError: () => {
          toast.error("Failed to start generation.");
        }
      }
    );
  };

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff" }}>
      {/* ── Hero image header ── */}
      <div style={{ position: "relative", height: 220, overflow: "hidden" }}>
        <img
          src="https://images.unsplash.com/photo-1598387993441-a364f854cde0?w=1400&q=90&fit=crop"
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.22 }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 0%, #080808 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 100% at 0% 50%, #007AFF10 0%, transparent 60%)" }} />
        <div style={{ position: "absolute", bottom: 28, left: 40 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.3em", color: "#007AFF", marginBottom: 10 }}>
            MUSIC VIDEO GENERATION
          </div>
          <div style={{ fontSize: "clamp(38px, 5vw, 60px)", fontWeight: 900, letterSpacing: "-0.04em", textTransform: "uppercase", lineHeight: 0.9 }}>
            MUSIC VIDEO
          </div>
        </div>
      </div>

      <div style={{ padding: "0 40px 48px" }}>
      <div className="max-w-2xl pb-12 pt-6 space-y-8">
        <div className="space-y-4">
          <label className="text-xs font-bold uppercase tracking-wider text-white">Audio Track URL</label>
          <input
            type="url"
            value={audioUrl}
            onChange={(e) => setAudioUrl(e.target.value)}
            placeholder="https://example.com/master-track.mp3"
            className="w-full aurora-input text-base py-3"
          />
        </div>

        <div className="space-y-4">
          <label className="text-xs font-bold uppercase tracking-wider text-white">Scene Direction & Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Artist performing on top of a moving train at sunset, cinematic drone shots circling, high contrast, 35mm film look..."
            className="w-full h-40 aurora-input resize-none font-mono text-sm leading-relaxed"
          />
        </div>

        <div className="pt-8 border-t border-[#333333] space-y-4">
          <CreditCostIndicator
            cost={MUSIC_VIDEO_COST}
            balance={user?.credits}
            accentColor="#007AFF"
          />
          <div className="flex justify-end">
            {insufficientCredits ? (
              <div className="w-full py-4 rounded-xl border border-[#FF453A]/40 bg-[#FF453A]/10 flex items-center justify-center gap-2 text-sm font-bold text-[#FF453A] uppercase tracking-widest">
                Not enough credits — top up
              </div>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={generate.isPending}
                className="w-full md:w-auto px-12 py-4 aurora-btn-primary flex items-center justify-center gap-2 text-sm uppercase tracking-widest font-bold bg-white text-black hover:bg-gray-200"
              >
                {generate.isPending ? (
                  <><Loader2 className="animate-spin" size={16} /> Processing...</>
                ) : (
                  <><Film size={18} /> Generate Scene</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
