import { useState } from "react";
import { useGenerateLipsync, useGetMe } from "@workspace/api-client-react";
import { Mic, Video, Sparkles, Loader2, Link } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import FileUploadSlot from "@/components/FileUploadSlot";
import { useSetActiveGeneration } from "@/contexts/generationWatcher";
import { CreditCostIndicator } from "@/components/CreditCostIndicator";

const LIPSYNC_COST = 15;

type InputMode = "upload" | "url";

export default function LipsyncStudioPage() {
  const [videoMode, setVideoMode] = useState<InputMode>("upload");
  const [audioMode, setAudioMode] = useState<InputMode>("upload");
  const [videoUrl, setVideoUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [videoObjectPath, setVideoObjectPath] = useState<string | null>(null);
  const [audioObjectPath, setAudioObjectPath] = useState<string | null>(null);
  const generate = useGenerateLipsync();
  const [, setLocation] = useLocation();
  const setActiveGeneration = useSetActiveGeneration();
  const { data: user } = useGetMe();
  const insufficientCredits = user?.credits !== undefined && user.credits < LIPSYNC_COST;

  const resolvedVideoUrl =
    videoMode === "upload"
      ? videoObjectPath
        ? `/api/storage${videoObjectPath}`
        : ""
      : videoUrl;

  const resolvedAudioUrl =
    audioMode === "upload"
      ? audioObjectPath
        ? `/api/storage${audioObjectPath}`
        : ""
      : audioUrl;

  const handleGenerate = () => {
    if (!resolvedVideoUrl.trim() || !resolvedAudioUrl.trim()) {
      toast.error("Please provide both a base video and target audio.");
      return;
    }

    generate.mutate(
      { data: { videoUrl: resolvedVideoUrl, audioUrl: resolvedAudioUrl } },
      {
        onSuccess: (data) => {
          setActiveGeneration({ id: data.id, creditsUsed: LIPSYNC_COST });
          toast.success("Lipsync processing started!");
          setVideoUrl("");
          setAudioUrl("");
          setVideoObjectPath(null);
          setAudioObjectPath(null);
          setLocation("/dashboard");
        },
        onError: () => {
          toast.error("Failed to start sync. Check your credit balance.");
        },
      }
    );
  };

  const canSubmit =
    resolvedVideoUrl.trim() !== "" && resolvedAudioUrl.trim() !== "";

  return (
    <div className="flex flex-col lg:flex-row gap-8 pb-12 h-[calc(100vh-8rem)]">
      <div className="w-full lg:w-[420px] flex-shrink-0 flex flex-col gap-6 overflow-y-auto pr-2">
        <header>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#007AFF]">
              Vocal Sync
            </span>
          </div>
          <h1 className="text-3xl font-display font-semibold text-white">
            Lip Sync Studio
          </h1>
          <p className="text-sm text-[#999999] mt-2 leading-relaxed">
            Perfectly map any audio track to a subject's face.
          </p>
        </header>

        <div className="space-y-8 flex-1">
          {/* --- Base Video --- */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Video size={14} className="text-brand" />
                Base Video
              </span>
              <ModeToggle mode={videoMode} onChange={setVideoMode} />
            </div>

            {videoMode === "upload" ? (
              <FileUploadSlot
                label=""
                accept="video/*"
                icon={<Video size={14} />}
                accentClass="text-brand"
                onUploaded={(path) => setVideoObjectPath(path)}
                onCleared={() => setVideoObjectPath(null)}
                hint="MP4, MOV, WebM · max 500 MB"
                maxBytes={500 * 1024 * 1024}
              />
            ) : (
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://example.com/portrait-video.mp4"
                className="w-full aurora-input text-sm"
              />
            )}
          </div>

          {/* --- Target Audio --- */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Mic size={14} className="text-[#34C759]" />
                Target Audio
              </span>
              <ModeToggle mode={audioMode} onChange={setAudioMode} />
            </div>

            {audioMode === "upload" ? (
              <FileUploadSlot
                label=""
                accept="audio/*"
                icon={<Mic size={14} />}
                accentClass="text-[#34C759]"
                onUploaded={(path) => setAudioObjectPath(path)}
                onCleared={() => setAudioObjectPath(null)}
                hint="MP3, WAV, AAC, M4A · max 100 MB"
                maxBytes={100 * 1024 * 1024}
              />
            ) : (
              <input
                type="url"
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                placeholder="https://example.com/vocal-track.mp3"
                className="w-full aurora-input text-sm"
              />
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-[#333333] space-y-3">
          <CreditCostIndicator
            cost={LIPSYNC_COST}
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
              disabled={generate.isPending || !canSubmit}
              className="w-full aurora-btn-primary flex items-center justify-center gap-2 py-4 text-sm uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generate.isPending ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Processing...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Run Sync
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Preview pane */}
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
          <h3 className="text-xl font-display font-semibold text-white mb-2">
            Awaiting Sources
          </h3>
          <p className="text-sm text-[#666666]">
            Upload or paste URLs for your source video and audio to begin the
            synchronization process.
          </p>
        </div>
      </div>
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: InputMode;
  onChange: (m: InputMode) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-[#1a1a1a] rounded-lg p-0.5 border border-[#2a2a2a]">
      <button
        onClick={() => onChange("upload")}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${
          mode === "upload"
            ? "bg-[#2a2a2a] text-white"
            : "text-[#555555] hover:text-[#888888]"
        }`}
      >
        Upload
      </button>
      <button
        onClick={() => onChange("url")}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${
          mode === "url"
            ? "bg-[#2a2a2a] text-white"
            : "text-[#555555] hover:text-[#888888]"
        }`}
      >
        <Link size={10} /> URL
      </button>
    </div>
  );
}
