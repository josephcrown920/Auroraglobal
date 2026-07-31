import { useState } from "react";
import { useGenerateMusicVideo } from "@workspace/api-client-react";
import { Music, Film, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useSetActiveGeneration } from "@/contexts/generationWatcher";

export default function MusicVideoStudioPage() {
  const [prompt, setPrompt] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const generate = useGenerateMusicVideo();
  const [, setLocation] = useLocation();
  const setActiveGeneration = useSetActiveGeneration();

  const handleGenerate = () => {
    if (!prompt.trim() || !audioUrl.trim()) {
      toast.error("Please provide both scene direction and audio URL.");
      return;
    }
    
    generate.mutate(
      { data: { prompt, audioUrl } },
      {
        onSuccess: (data) => {
          setActiveGeneration({ id: data.id, creditsUsed: 12 });
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
    <div className="max-w-4xl mx-auto pb-12 pt-8">
      <header className="mb-10 text-center">
        <div className="inline-block px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
          Flagship
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-semibold text-white mb-4">Perform Anywhere</h1>
        <p className="text-lg text-[#999999] max-w-2xl mx-auto">
          Upload an audio track and describe the scene. We'll generate a full cinematic performance perfectly timed to the beat.
        </p>
      </header>

      <div className="aurora-card p-8 md:p-12 space-y-8">
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

        <div className="pt-8 border-t border-[#333333] flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={generate.isPending}
            className="w-full md:w-auto px-12 py-4 aurora-btn-primary flex items-center justify-center gap-2 text-sm uppercase tracking-widest font-bold bg-white text-black hover:bg-gray-200"
          >
            {generate.isPending ? (
              <><Loader2 className="animate-spin" size={16} /> Processing...</>
            ) : (
              <><Film size={18} /> Generate Scene (50 Aura)</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
