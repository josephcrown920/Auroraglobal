import { useState } from "react";
import { useGenerateVideo } from "@workspace/api-client-react";
import { Video, Film, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function MotionStudioPage() {
  const [prompt, setPrompt] = useState("");
  const generate = useGenerateVideo();
  const [, setLocation] = useLocation();

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error("Please enter a scene direction.");
      return;
    }
    
    generate.mutate(
      { data: { prompt } },
      {
        onSuccess: () => {
          toast.success("Motion generation queued! Videos take 2-4 minutes.");
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
    <div className="flex flex-col lg:flex-row gap-8 pb-12 h-[calc(100vh-8rem)]">
      <div className="w-full lg:w-[400px] flex-shrink-0 flex flex-col gap-6 overflow-y-auto pr-2">
        <header>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f6d365]">Video Agent</span>
          </div>
          <h1 className="text-3xl font-display font-semibold text-white">Motion Control</h1>
          <p className="text-sm text-[#999999] mt-2 leading-relaxed">
            Turn static concepts into cinematic performance videos.
          </p>
        </header>

        <div className="space-y-6 flex-1">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-white">Scene Action</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Artist walking slowly towards camera in a rain-slicked cyberpunk alleyway, neon reflections, 4k 60fps cinematic pan..."
              className="w-full h-40 aurora-input resize-none font-mono text-sm"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-[#333333]">
          <button
            onClick={handleGenerate}
            disabled={generate.isPending}
            className="w-full aurora-btn-primary flex items-center justify-center gap-2 py-4 text-sm uppercase tracking-widest bg-gradient-to-r from-[#b8860b] to-[#f6d365] text-black hover:from-[#fbbf24] hover:to-[#f6d365] border-none shadow-[0_0_20px_rgba(246,211,101,0.2)]"
          >
            {generate.isPending ? (
              <><Loader2 className="animate-spin" size={16} /> Queuing...</>
            ) : (
              <><Film size={16} /> Render Motion (25 Aura)</>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 bg-[#111111] rounded-2xl border border-[#333333] overflow-hidden flex flex-col items-center justify-center relative shadow-inner">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
           <div className="w-[120%] h-px bg-gradient-to-r from-transparent via-[#f6d365] to-transparent animate-pulse transform -rotate-12"></div>
        </div>
        <div className="text-center max-w-sm px-6 relative z-10">
          <div className="w-16 h-16 rounded-full bg-[#1A1A1A] border border-[#333333] flex items-center justify-center mx-auto mb-6">
            <Video className="text-[#666666]" size={24} />
          </div>
          <h3 className="text-xl font-display font-semibold text-white mb-2">Motion Director</h3>
          <p className="text-sm text-[#666666]">
            Write a detailed action script. Our motion model will construct the scene from scratch.
          </p>
        </div>
      </div>
    </div>
  );
}
