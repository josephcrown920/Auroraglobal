import { useState } from "react";
import { useGenerateLipsync } from "@workspace/api-client-react";
import { Mic, Video, Upload, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function LipsyncStudioPage() {
  const [videoUrl, setVideoUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const generate = useGenerateLipsync();
  const [, setLocation] = useLocation();

  const handleGenerate = () => {
    if (!videoUrl.trim() || !audioUrl.trim()) {
      toast.error("Please provide both video and audio source URLs.");
      return;
    }
    
    generate.mutate(
      { data: { videoUrl, audioUrl } },
      {
        onSuccess: () => {
          toast.success("Lipsync processing started!");
          setVideoUrl("");
          setAudioUrl("");
          setLocation("/dashboard");
        },
        onError: () => {
          toast.error("Failed to start sync. Check your credit balance.");
        }
      }
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 pb-12 h-[calc(100vh-8rem)]">
      <div className="w-full lg:w-[400px] flex-shrink-0 flex flex-col gap-6 overflow-y-auto pr-2">
        <header>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#007AFF]">Vocal Sync</span>
          </div>
          <h1 className="text-3xl font-display font-semibold text-white">Lip Sync Studio</h1>
          <p className="text-sm text-[#999999] mt-2 leading-relaxed">
            Perfectly map any audio track to a subject's face.
          </p>
        </header>

        <div className="space-y-8 flex-1">
          <div className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Video size={14} className="text-brand" /> Base Video URL
            </label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://example.com/portrait-video.mp4"
              className="w-full aurora-input text-sm"
            />
          </div>

          <div className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Mic size={14} className="text-[#34C759]" /> Target Audio URL
            </label>
            <input
              type="url"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="https://example.com/vocal-track.mp3"
              className="w-full aurora-input text-sm"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-[#333333]">
          <button
            onClick={handleGenerate}
            disabled={generate.isPending}
            className="w-full aurora-btn-primary flex items-center justify-center gap-2 py-4 text-sm uppercase tracking-widest"
          >
            {generate.isPending ? (
              <><Loader2 className="animate-spin" size={16} /> Processing...</>
            ) : (
              <><Sparkles size={16} /> Run Sync (15 Aura)</>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 bg-[#111111] rounded-2xl border border-[#333333] overflow-hidden flex flex-col items-center justify-center relative shadow-inner">
        <div className="text-center max-w-sm px-6 relative z-10">
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-[#1A1A1A] border border-[#333333] flex items-center justify-center">
              <Video className="text-[#666666]" size={24} />
            </div>
            <div className="w-12 h-px bg-[#333333] relative">
              <div className="absolute inset-0 bg-brand animate-pulse"></div>
            </div>
            <div className="w-16 h-16 rounded-full bg-[#1A1A1A] border border-[#333333] flex items-center justify-center">
              <Mic className="text-[#666666]" size={24} />
            </div>
          </div>
          <h3 className="text-xl font-display font-semibold text-white mb-2">Awaiting Sources</h3>
          <p className="text-sm text-[#666666]">
            Provide public URLs for your source video and audio to begin the synchronization process.
          </p>
        </div>
      </div>
    </div>
  );
}
