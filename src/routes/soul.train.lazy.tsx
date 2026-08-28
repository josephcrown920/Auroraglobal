import { useRef, useState } from "react";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, X, Wand2 } from "lucide-react";
import { SoulShell } from "@/features/soul/soul-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getSoul, addSoulTrainingImage, trainSoul, listSouls } from "@/lib/soul.functions";

export const Route = createLazyFileRoute("/soul/train")({
  component: () => (
    <SoulShell>
      <SoulTrainPage />
    </SoulShell>
  ),
});

const MIN_PHOTOS = 10;

function SoulTrainPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const getFn = useServerFn(getSoul);
  const listFn = useServerFn(listSouls);
  const addImageFn = useServerFn(addSoulTrainingImage);
  const trainFn = useServerFn(trainSoul);

  const [uploading, setUploading] = useState(false);
  const [training, setTraining] = useState(false);

  const { data: souls = [] } = useQuery({ queryKey: ["souls"], queryFn: () => listFn(), enabled: !search.soulId });
  const { data: soul, isLoading } = useQuery({
    queryKey: ["soul", search.soulId],
    queryFn: () => getFn({ data: { soulId: search.soulId! } }),
    enabled: !!search.soulId,
  });

  if (!search.soulId) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Pick a soul to train, or create a new one first.</p>
        {souls.length === 0 ? (
          <Button asChild variant="premium">
            <Link to="/soul">Create a soul</Link>
          </Button>
        ) : (
          <ul className="space-y-2">
            {souls.map((s) => (
              <li key={s.id}>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link to="/soul/train" search={{ soulId: s.id }}>
                    {s.name} — {s.status}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (isLoading || !soul) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const path = `${user.id}/${soul.id}/upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage
          .from("soul-training")
          .upload(path, file, { contentType: file.type, upsert: true });
        if (error) throw new Error(error.message);
        await addImageFn({ data: { soulId: soul.id, storagePath: path } });
      }
      qc.invalidateQueries({ queryKey: ["soul", soul.id] });
      toast.success("Photos uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleTrain = async () => {
    setTraining(true);
    try {
      const res = await trainFn({ data: { soulId: soul.id } });
      if (!res.ok) throw new Error(res.error);
      toast.success("Training started — this usually takes a few minutes.");
      qc.invalidateQueries({ queryKey: ["soul", soul.id] });
      qc.invalidateQueries({ queryKey: ["souls"] });
      navigate({ to: "/soul" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start training");
    } finally {
      setTraining(false);
    }
  };

  const photoCount = soul.training_image_paths.length;
  const canTrain = photoCount >= MIN_PHOTOS && (soul.status === "pending" || soul.status === "failed" || soul.stale);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">{soul.name}</h2>
        <p className="text-sm text-muted-foreground">
          {photoCount} / {MIN_PHOTOS}+ training photos uploaded
          {soul.status === "training" && !soul.stale ? " · training in progress" : ""}
        </p>
      </div>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-glass-strong)] p-8 text-center transition-colors hover:brightness-110 disabled:opacity-60"
      >
        {uploading ? <Loader2 className="size-6 animate-spin" /> : <Upload className="size-6" />}
        <span className="text-sm font-medium text-white">
          {uploading ? "Uploading…" : "Click to upload photos"}
        </span>
        <span className="text-xs text-muted-foreground">
          Clear, varied face photos (different angles/lighting) work best.
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {soul.error_message && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {soul.error_message}
        </p>
      )}

      <Button onClick={handleTrain} disabled={!canTrain || training} variant="premium" size="lg" className="w-full">
        {training ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
        {photoCount < MIN_PHOTOS ? `Need ${MIN_PHOTOS - photoCount} more photos` : "Start training"}
      </Button>
    </div>
  );
}
