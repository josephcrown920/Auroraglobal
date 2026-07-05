import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { generateHeyGenVideo, HEYGEN_AVATARS, HEYGEN_VOICES, HEYGEN_BACKGROUNDS } from "@/lib/heygen.server";
import { Loader2, Play } from "lucide-react";

export function HeyGenPanel() {
  const genFn = useServerFn(generateHeyGenVideo);
  const [avatarId, setAvatarId] = useState(HEYGEN_AVATARS[0].id);
  const [voiceId, setVoiceId] = useState(HEYGEN_VOICES[0].id);
  const [backgroundId, setBackgroundId] = useState(HEYGEN_BACKGROUNDS[0].id);
  const [scriptText, setScriptText] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      if (!scriptText.trim()) throw new Error("Script is required");
      return genFn({
        data: {
          avatarId,
          voiceId,
          backgroundId,
          scriptText,
        },
      });
    },
    onSuccess: (res) => {
      if (res.videoUrl) {
        toast.success("Video generated! Check your gallery.");
      } else {
        toast.info("Video is rendering. Check back in a few minutes.");
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to generate video");
    },
  });

  return (
    <div className="space-y-6 rounded-xl border border-border bg-card/40 p-6">
      <div className="space-y-2">
        <h3 className="font-semibold">Avatar</h3>
        <Select value={avatarId} onValueChange={setAvatarId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HEYGEN_AVATARS.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name} — {a.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Voice</h3>
        <Select value={voiceId} onValueChange={setVoiceId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HEYGEN_VOICES.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Background</h3>
        <Select value={backgroundId} onValueChange={setBackgroundId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HEYGEN_BACKGROUNDS.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Script</h3>
        <Textarea
          placeholder="Write what your avatar should say..."
          value={scriptText}
          onChange={(e) => setScriptText(e.target.value)}
          rows={4}
        />
        <p className="text-xs text-muted-foreground">Max 2000 characters</p>
      </div>

      <Button
        onClick={() => mut.mutate()}
        disabled={mut.isPending || !scriptText.trim()}
        className="w-full"
      >
        {mut.isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" /> Generating...
          </>
        ) : (
          <>
            <Play className="mr-2 size-4" /> Generate with HeyGen
          </>
        )}
      </Button>
    </div>
  );
}
