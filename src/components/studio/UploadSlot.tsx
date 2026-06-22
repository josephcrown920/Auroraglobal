import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ImagePlus, Loader2, X, Video } from "lucide-react";
import { toast } from "sonner";

type Props = {
  userId: string;
  label: string;
  hint: string;
  accept?: string;
  kind?: "image" | "video";
  value: string | null;
  onChange: (url: string | null) => void;
};

export function UploadSlot({ userId, label, hint, accept = "image/*", kind = "image", value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Max 20MB");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg");
      const path = `${userId}/uploads/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("studio").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      const { data: signed, error: signErr } = await supabase.storage
        .from("studio")
        .createSignedUrl(path, 60 * 60);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Could not sign upload URL");
      onChange(signed.signedUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1">
            <X className="size-3" /> Clear
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "group relative aspect-square rounded-2xl border-2 border-dashed transition-all overflow-hidden",
          "bg-card/60 hover:bg-card",
          value ? "border-primary/30" : "border-border hover:border-primary/50",
        )}
      >
        {value ? (
          kind === "video" ? (
            <video src={value} className="w-full h-full object-cover" muted loop autoPlay playsInline />
          ) : (
            <img src={value} alt={label} className="w-full h-full object-cover" />
          )
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
            {busy ? <Loader2 className="size-6 animate-spin" /> : kind === "video" ? <Video className="size-6" /> : <ImagePlus className="size-6" />}
            <span className="text-xs px-3 text-center">{hint}</span>
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}