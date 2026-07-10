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
import { generateHeyGenVideo } from "@/lib/heygen.server";
import { Loader2, Play } from "lucide-react";

export function HeyGenPanel() {
  const genFn = useServerFn(generateHeyGenVideo);
  const [scriptText, setScriptText] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      if (!scriptText.trim()) throw new Error("Script is required");
      return genFn({
        data: {
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
      <p className="text-xs text-muted-foreground">
        We pick a real HeyGen avatar and matching voice for you automatically.
      </p>

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
