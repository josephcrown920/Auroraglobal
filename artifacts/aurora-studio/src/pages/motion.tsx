import { useState } from "react";
import { useGenerateVideo, useGetMe } from "@workspace/api-client-react";
import { Video, Film, Sparkles, Loader2, Image } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import FileUploadSlot from "@/components/FileUploadSlot";
import { useSetActiveGeneration } from "@/contexts/generationWatcher";
import { CreditCostIndicator } from "@/components/CreditCostIndicator";

const MOTION_COST = 25;

export default function MotionStudioPage() {
  const [prompt, setPrompt] = useState("");
  const [sourceImageObjectPath, setSourceImageObjectPath] = useState<
    string | null
  >(null);
  const generate = useGenerateVideo();
  const [, setLocation] = useLocation();
  const setActiveGeneration = useSetActiveGeneration();
  const { data: user } = useGetMe();
  const insufficientCredits = user?.credits !== undefined && user.credits < MOTION_COST;

  const resolvedSourceImageUrl = sourceImageObjectPath
    ? `/api/storage${sourceImageObjectPath}`
    : undefined;

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error("Please enter a scene direction.");
      return;
    }

    generate.mutate(
      {
        data: {
          prompt,
          ...(resolvedSourceImageUrl
            ? { sourceImageUrl: resolvedSourceImageUrl }
            : {}),
        },
      },
      {
        onSuccess: (data) => {
          setActiveGeneration({ id: data.id, creditsUsed: MOTION_COST });
          toast.success("Motion generation queued! Videos take 2-4 minutes.");
          setPrompt("");
          setSourceImageObjectPath(null);
          setLocation("/dashboard");
        },
        onError: () => {
          toast.error("Failed to start generation. Check your credit balance.");
        },
      }
    );
  };

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff" }}>
      {/* ── Hero image header ── */}
      <div style={{ position: "relative", height: 220, overflow: "hidden" }}>
        <img
          src="https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1400&q=90&fit=crop"
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.22 }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 0%, #080808 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 100% at 0% 50%, #FFFFFF0e 0%, transparent 60%)" }} />
        <div style={{ position: "absolute", bottom: 28, left: 40 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.3em", color: "#f6d365", marginBottom: 10 }}>
            06 — KINETIC VISUAL GENERATION
          </div>
          <div style={{ fontSize: "clamp(38px, 5vw, 60px)", fontWeight: 900, letterSpacing: "-0.04em", textTransform: "uppercase", lineHeight: 0.9 }}>
            MOTION CONTROL
          </div>
        </div>
      </div>

      {/* ── Form content ── */}
      <div style={{ padding: "0 40px 48px" }}>
    <div className="flex flex-col lg:flex-row gap-8 pb-12">
      <div className="w-full lg:w-[420px] flex-shrink-0 flex flex-col gap-6 pr-2">
        <header>
          <p className="text-sm text-[#999999] mt-2 leading-relaxed">
            Turn static concepts into cinematic performance videos.
          </p>
        </header>

        <div className="space-y-6 flex-1">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-white">
              Scene Action
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Artist walking slowly towards camera in a rain-slicked cyberpunk alleyway, neon reflections, 4k 60fps cinematic pan..."
              className="w-full h-40 aurora-input resize-none font-mono text-sm"
            />
          </div>

          {/* Optional source image upload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Image size={14} className="text-[#f6d365]" />
                Reference Image
                <span className="text-[#555555] font-normal normal-case tracking-normal">
                  — optional
                </span>
              </span>
            </div>
            <p className="text-[11px] text-[#555555] leading-snug">
              Anchor the video to a specific subject or scene. The model will
              animate from this starting frame.
            </p>
            <FileUploadSlot
              label=""
              accept="image/*"
              icon={<Image size={14} />}
              accentClass="text-[#f6d365]"
              onUploaded={(path) => setSourceImageObjectPath(path)}
              onCleared={() => setSourceImageObjectPath(null)}
              hint="JPG, PNG, WebP · max 20 MB"
              maxBytes={20 * 1024 * 1024}
            />
          </div>
        </div>

        <div className="pt-4 border-t border-[#333333] space-y-3">
          <CreditCostIndicator
            cost={MOTION_COST}
            balance={user?.credits}
            accentColor="#f6d365"
          />
          {insufficientCredits ? (
            <div className="w-full py-4 rounded-xl border border-[#FF453A]/40 bg-[#FF453A]/10 flex items-center justify-center gap-2 text-sm font-bold text-[#FF453A] uppercase tracking-widest">
              Not enough credits — top up
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generate.isPending}
              className="w-full aurora-btn-primary flex items-center justify-center gap-2 py-4 text-sm uppercase tracking-widest bg-gradient-to-r from-[#b8860b] to-[#f6d365] text-black hover:from-[#fbbf24] hover:to-[#f6d365] border-none shadow-[0_0_20px_rgba(246,211,101,0.2)]"
            >
              {generate.isPending ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Queuing...
                </>
              ) : (
                <>
                  <Film size={16} /> Render Motion
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Preview pane */}
      <div className="flex-1 bg-[#111111] rounded-2xl border border-[#1a1a1a] overflow-hidden flex flex-col items-center justify-center relative" style={{ minHeight: 320 }}>
        <img
          src="https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=800&q=80&fit=crop"
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.07 }}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="w-[120%] h-px bg-gradient-to-r from-transparent via-[#f6d365] to-transparent animate-pulse transform -rotate-12"></div>
        </div>
        <div className="text-center max-w-sm px-6 relative z-10">
          <div className="w-16 h-16 rounded-full bg-[#1A1A1A] border border-[#333333] flex items-center justify-center mx-auto mb-6">
            <Video className="text-[#666666]" size={24} />
          </div>
          <h3 className="text-xl font-display font-semibold text-white mb-2">Motion Director</h3>
          <p className="text-sm text-[#666666]">Write a detailed action script. Upload a reference image to anchor the subject.</p>
        </div>
      </div>
    </div>
      </div>
    </div>
  );
}
