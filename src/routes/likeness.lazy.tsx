import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  lockLikeness,
  listLikenesses,
  deleteLikeness,
  runLikenessShoot,
  LIKENESS_COST_PER_IMAGE,
  SHOOT_DECK,
  type LikenessWithUrl,
  type ShootResult,
} from "@/lib/likeness-shoot.functions";
import { toast } from "sonner";
import {
  Loader2,
  Lock as LockIcon,
  Upload,
  Trash2,
  Camera,
  Download,
  CheckCircle2,
  AlertCircle,
  Music2,
  Sparkles,
} from "lucide-react";

export const Route = createLazyFileRoute("/likeness")({ component: LikenessPage });

const ACCEPT = "image/jpeg,image/png,image/webp";

function LikenessPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);

  const [active, setActive] = useState<LikenessWithUrl | null>(null);
  const [wardrobe, setWardrobe] = useState(
    "Fitted black wool turtleneck, matte black tailored trousers, minimal silver chain.",
  );
  const [scene, setScene] = useState(
    "Cyclorama studio, warm key light from camera-left, cool teal rim behind, seamless charcoal backdrop.",
  );
  const [song, setSong] = useState("");
  const [bpm, setBpm] = useState<number>(92);
  const [selectedShots, setSelectedShots] = useState<Set<string>>(
    new Set(SHOOT_DECK.slice(0, 6).map((s) => s.id)),
  );
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ShootResult[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [user, loading, navigate]);

  const lockFn = useServerFn(lockLikeness);
  const listFn = useServerFn(listLikenesses);
  const delFn = useServerFn(deleteLikeness);
  const runFn = useServerFn(runLikenessShoot);

  const { data: locks = [], isLoading: locksLoading } = useQuery({
    queryKey: ["likeness-locks"],
    queryFn: () => listFn(),
    enabled: !!user,
  });

  useEffect(() => {
    if (!active && locks.length > 0) setActive(locks[0]);
  }, [locks, active]);

  const handleFile = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleLock = async () => {
    if (!file || !user || !name.trim()) {
      toast.error("Add a photo and a name");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/likeness/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("studio")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw new Error(error.message);
      await lockFn({ data: { name: name.trim(), primaryPath: path } });
      toast.success("Likeness locked ✓");
      setFile(null);
      setPreview(null);
      setName("");
      qc.invalidateQueries({ queryKey: ["likeness-locks"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lock failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this locked likeness?")) return;
    try {
      await delFn({ data: { id } });
      if (active?.id === id) setActive(null);
      qc.invalidateQueries({ queryKey: ["likeness-locks"] });
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const toggleShot = (id: string) => {
    setSelectedShots((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runShoot = async () => {
    if (!active) return toast.error("Pick a locked likeness first");
    if (selectedShots.size === 0) return toast.error("Pick at least one shot");
    if (!wardrobe.trim() || !scene.trim())
      return toast.error("Wardrobe and scene are required");
    setRunning(true);
    setResults([]);
    try {
      const { results: r } = await runFn({
        data: {
          likenessId: active.id,
          wardrobe: wardrobe.trim(),
          scene: scene.trim(),
          song: song.trim() || undefined,
          bpm: Number.isFinite(bpm) ? bpm : undefined,
          shotIds: Array.from(selectedShots),
        },
      });
      setResults(r);
      const ok = r.filter((x) => x.status === "succeeded").length;
      toast.success(`${ok}/${r.length} shots ready`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Shoot failed");
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  const totalCost = selectedShots.size * LIKENESS_COST_PER_IMAGE;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <header className="px-4 pt-6 pb-4 border-b border-border/40">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <LockIcon className="size-5 text-primary" /> Locked Digital Likeness
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Lock your face + fit once. Run music-synced studio shoots — identity, wardrobe and
          environment stay identical; only camera and pose change per beat.
        </p>
      </header>

      <section className="px-4 py-5 space-y-6">
        {/* ── 1. Lock a new likeness ─────────────────────────────────────── */}
        <div className="rounded-xl border border-border/50 bg-card/40 p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> Lock a new likeness
          </h2>
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="aspect-[3/4] rounded-lg border border-dashed border-border/60 bg-muted/20 flex flex-col items-center justify-center text-xs text-muted-foreground hover:bg-muted/40 overflow-hidden"
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Reference preview"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <>
                  <Upload className="size-5 mb-1" />
                  Upload reference
                </>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <div className="space-y-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Likeness name (e.g. Josh — hero look)"
                className="w-full text-sm bg-background border border-border/60 rounded-md px-3 py-2"
              />
              <p className="text-[11px] text-muted-foreground">
                Use a clean, well-lit portrait — face clearly visible, fully clothed. This is
                your identity anchor and every shoot pulls from it.
              </p>
              <button
                onClick={handleLock}
                disabled={uploading || !file || !name.trim()}
                className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                {uploading ? (
                  <><Loader2 className="size-3 animate-spin" /> Locking…</>
                ) : (
                  <><LockIcon className="size-3" /> Lock likeness</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── 2. Pick a locked likeness ──────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold mb-2">Your locked likenesses</h2>
          {locksLoading ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : locks.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No locks yet — upload a reference above to create your first.
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {locks.map((l) => {
                const isActive = active?.id === l.id;
                return (
                  <div
                    key={l.id}
                    onClick={() => setActive(l)}
                    className={`shrink-0 w-32 rounded-lg overflow-hidden border cursor-pointer relative ${
                      isActive ? "border-primary ring-2 ring-primary/40" : "border-border/50"
                    }`}
                  >
                    {l.signedUrl ? (
                      <img
                        src={l.signedUrl}
                        alt={l.name}
                        className="aspect-[3/4] w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="aspect-[3/4] w-full bg-muted/30" />
                    )}
                    <div className="p-1.5 text-[10px] font-medium truncate">{l.name}</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(l.id);
                      }}
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white opacity-0 hover:opacity-100 transition-opacity"
                      aria-label="Delete"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 3. Shoot brief ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Camera className="size-4 text-primary" /> Shoot brief
          </h2>
          <label className="block text-xs">
            <span className="text-muted-foreground">Wardrobe (locked across every shot)</span>
            <textarea
              value={wardrobe}
              onChange={(e) => setWardrobe(e.target.value)}
              rows={2}
              className="mt-1 w-full text-sm bg-background border border-border/60 rounded-md px-3 py-2"
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground">Scene / lighting (locked across every shot)</span>
            <textarea
              value={scene}
              onChange={(e) => setScene(e.target.value)}
              rows={2}
              className="mt-1 w-full text-sm bg-background border border-border/60 rounded-md px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Music2 className="size-3" /> Song / mood
              </span>
              <input
                type="text"
                value={song}
                onChange={(e) => setSong(e.target.value)}
                placeholder="e.g. slow burn trap"
                className="mt-1 w-full text-sm bg-background border border-border/60 rounded-md px-3 py-2"
              />
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">BPM</span>
              <input
                type="number"
                min={40}
                max={220}
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value, 10) || 0)}
                className="mt-1 w-full text-sm bg-background border border-border/60 rounded-md px-3 py-2"
              />
            </label>
          </div>
        </div>

        {/* ── 4. Shot deck ────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Shot deck</h2>
            <div className="text-[11px] text-muted-foreground">
              {selectedShots.size} selected · {totalCost} Aura total
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SHOOT_DECK.map((s) => {
              const on = selectedShots.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleShot(s.id)}
                  className={`text-left rounded-lg border p-2.5 text-xs transition-colors ${
                    on
                      ? "border-primary bg-primary/10"
                      : "border-border/50 bg-card/30 hover:bg-card/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{s.label}</span>
                    {on && <CheckCircle2 className="size-3.5 text-primary" />}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    beat · {s.beat}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 5. Run + results ───────────────────────────────────────────── */}
        <div>
          <button
            onClick={runShoot}
            disabled={running || !active || selectedShots.size === 0}
            className="w-full bg-primary text-primary-foreground rounded-lg py-3 text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {running ? (
              <><Loader2 className="size-4 animate-spin" /> Shooting…</>
            ) : (
              <><Camera className="size-4" /> Run studio shoot ({totalCost} Aura)</>
            )}
          </button>

          {results.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {results.map((r) => (
                <div
                  key={r.shotId}
                  className="rounded-lg overflow-hidden border border-border/50 bg-card/30"
                >
                  {r.status === "succeeded" && r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer" className="block">
                      <img
                        src={r.url}
                        alt={r.label}
                        className="aspect-[9/16] w-full object-cover"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <div className="aspect-[9/16] w-full flex items-center justify-center bg-muted/20 text-[10px] text-destructive px-2 text-center">
                      <AlertCircle className="size-4 mr-1" /> {r.error ?? "Failed"}
                    </div>
                  )}
                  <div className="p-2 flex items-center justify-between text-[11px]">
                    <span className="font-medium truncate">{r.label}</span>
                    {r.status === "succeeded" && r.url && (
                      <a
                        href={r.url}
                        download
                        className="text-muted-foreground hover:text-primary"
                        aria-label="Download"
                      >
                        <Download className="size-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
