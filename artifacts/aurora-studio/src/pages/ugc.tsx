import { useState } from "react";
import { useGenerateUgc } from "@workspace/api-client-react";
import { Smartphone, Sparkles, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useSetActiveGeneration } from "@/contexts/generationWatcher";

export default function UgcFactoryPage() {
  const [prompt, setPrompt] = useState("");
  const [avatarStyle, setAvatarStyle] = useState<"lifestyle" | "studio" | "unboxing">("lifestyle");
  const generate = useGenerateUgc();
  const [, setLocation] = useLocation();
  const setActiveGeneration = useSetActiveGeneration();

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error("Please provide the script or product description.");
      return;
    }
    
    generate.mutate(
      { data: { prompt, productDescription: prompt, avatarStyle } },
      {
        onSuccess: (data) => {
          setActiveGeneration({ id: data.id, creditsUsed: 6 });
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
    <div className="flex flex-col lg:flex-row gap-8 pb-12 h-[calc(100vh-8rem)]">
      <div className="w-full lg:w-[400px] flex-shrink-0 flex flex-col gap-6 overflow-y-auto pr-2">
        <header>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FF3B30]">Social Engine</span>
          </div>
          <h1 className="text-3xl font-display font-semibold text-white">TikTok30 UGC</h1>
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

        <div className="pt-4 border-t border-[#333333]">
          <button
            onClick={handleGenerate}
            disabled={generate.isPending}
            className="w-full aurora-btn-primary flex items-center justify-center gap-2 py-4 text-sm uppercase tracking-widest bg-[#FF3B30] hover:bg-[#D70015] border-none"
          >
            {generate.isPending ? (
              <><Loader2 className="animate-spin" size={16} /> Queuing...</>
            ) : (
              <><Smartphone size={16} /> Render 30s Clip (85 Aura)</>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 bg-[#111111] rounded-2xl border border-[#333333] overflow-hidden flex flex-col items-center justify-center relative shadow-inner">
        <div className="text-center max-w-sm px-6 relative z-10">
          <div className="w-16 h-32 rounded-lg border-2 border-[#333333] border-dashed flex items-center justify-center mx-auto mb-6">
            <User className="text-[#666666]" size={24} />
          </div>
          <h3 className="text-xl font-display font-semibold text-white mb-2">9:16 Optimized</h3>
          <p className="text-sm text-[#666666]">
            Outputs are pre-formatted for TikTok, Instagram Reels, and YouTube Shorts with safe-zones respected.
          </p>
        </div>
      </div>
    </div>
  );
}
