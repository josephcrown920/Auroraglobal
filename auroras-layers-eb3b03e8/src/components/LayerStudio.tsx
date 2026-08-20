import { useEffect, useRef, useState } from "react";
import { streamImage } from "@/lib/streamImage";
import { composeSheet, gpuStatus, type GpuStatus } from "@/lib/gpuCompose";
import { onStudioCommand } from "@/lib/studioBus";
import { saveCloudProject } from "@/lib/cloudProjects";
import { useBibles } from "@/lib/bibleStore";
import { bibleReferenceImages, compileIdentityGraph, compileVoiceProfile } from "@/lib/characterBible";
import {
  buildSequencePrompt,
  moveShot,
  patchShot,
  removeShot,
  sequence,
  shotCode,
  staleShots,
  upsertShot,
  type Shot,
} from "@/lib/storyboard";
import {
  DEFAULT_BRAIN_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  IMAGE_MODELS,
  VIDEO_MODELS,
} from "@/lib/auroraModels";
import {
  deleteProject,
  downloadDataUrl,
  exportProjectZip,
  loadProjects,
  saveProject,
  type LayerProject,
} from "@/lib/projects";

const PRESETS = [
  "Turn the outfit into full trap streetwear — puffer jacket, iced-out cuban chains, designer shades",
  "Give her long neon-green braids and oversized varsity jacket",
  "Add a red bandana, backwards fitted cap and gold rope chain",
  "Relight the scene as a night block party with neon signage",
];

const IDENTITY_LOCK =
  "LOCKED PLATE: preserve identical face, ethnicity, skin tone, hair, body, expression, pose, hand placement, camera angle, crop and background. Keep every subject on the same side of frame. Do not mirror, flip, swap, recast or reposition anyone. Change only the named region.";

export function LayerStudio() {
  const { active: bible } = useBibles();
  const [prompt, setPrompt] = useState<string>(PRESETS[0] ?? "");
  const [model, setModel] = useState<string>(DEFAULT_IMAGE_MODEL);
  const [videoModel, setVideoModel] = useState<string>(DEFAULT_VIDEO_MODEL);
  const [brainModel] = useState<string>(DEFAULT_BRAIN_MODEL);
  const [lockIdentity, setLockIdentity] = useState(true);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [characterReference, setCharacterReference] = useState<string | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpuMode, setGpuMode] = useState<GpuStatus>("cpu");
  const [projects, setProjects] = useState<LayerProject[]>([]);
  const [projectId, setProjectId] = useState<string>(() => crypto.randomUUID());
  const [name, setName] = useState("Untitled shoot");
  const fileRef = useRef<HTMLInputElement>(null);
  const characterRef = useRef<HTMLInputElement>(null);
  const runRef = useRef<((prompt: string, target?: Shot) => Promise<void>) | null>(null);

  useEffect(() => {
    setProjects(loadProjects());
    setGpuMode(gpuStatus());
  }, []);

  const result = shots.find((s) => s.id === active)?.dataUrl ?? null;
  const identityGraph = bible ? compileIdentityGraph(bible) : "";
  const voiceProfile = bible ? compileVoiceProfile(bible) : "";
  const bibleRef = bible ? bibleReferenceImages(bible)[0] : undefined;
  const stale = bible ? staleShots(shots.filter((s) => s.dataUrl), bible.version) : [];

  function readFile(file: File | undefined, setter: (value: string) => void) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function render(text: string, target?: Shot) {
    if (busy || !text.trim()) return;
    setBusy(true);
    setError(null);
    setIsFinal(false);
    const id = target?.id ?? crypto.randomUUID();
    // chain edits: the previous frame becomes the plate so identity carries forward
    const base = target?.dataUrl ?? result ?? sourceUrl;
    const reference = characterReference ?? bibleRef;
    const composed = [
      identityGraph,
      text.trim(),
      lockIdentity && base ? IDENTITY_LOCK : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      await streamImage(
        "/api/generate-image",
        {
          prompt: composed,
          model,
          ...(base ? { imageDataUrl: base } : {}),
          ...(reference ? { characterReferenceDataUrl: reference } : {}),
        },
        (dataUrl, final) => {
          setShots((prev) =>
            upsertShot(prev, {
              id,
              prompt: text.trim(),
              dataUrl,
              ...(target?.beat ? { beat: target.beat } : {}),
              ...(target?.motion ? { motion: target.motion } : {}),
              ...(bible ? { bibleVersion: bible.version } : {}),
            }),
          );
          setActive(id);
          if (final) setIsFinal(true);
        },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  runRef.current = render;

  useEffect(
    () =>
      onStudioCommand((command) => {
        if (command.type === "prompt") setPrompt(command.prompt);
        if (command.type === "render") {
          setPrompt(command.prompt);
          void runRef.current?.(command.prompt);
        }
        if (command.type === "storyboard") {
          setShots((prev) => {
            let next = prev;
            for (const shot of command.shots) {
              next = upsertShot(next, {
                id: crypto.randomUUID(),
                prompt: shot.prompt,
                dataUrl: "",
                beat: shot.beat,
                ...(shot.motion ? { motion: shot.motion } : {}),
              });
            }
            return next;
          });
        }
      }),
    [],
  );

  function currentProject(): LayerProject {
    return {
      id: projectId,
      name: name.trim() || "Untitled shoot",
      prompt,
      model,
      createdAt: Date.now(),
      ...(sourceUrl ? { sourceUrl } : {}),
      layers: sequence(shots).filter((s) => s.dataUrl),
    };
  }

  async function onSave() {
    const project = currentProject();
    if (project.layers.length === 0) return;
    setProjects(saveProject(project));
    try {
      const synced = await saveCloudProject(project, {
        brainModel,
        videoModel,
        identityLock: lockIdentity,
        ...(characterReference ? { characterReference } : {}),
      });
      if (synced) setError(null);
    } catch (cloudError) {
      setError(cloudError instanceof Error ? cloudError.message : "Cloud sync failed");
    }
  }

  function openProject(p: LayerProject) {
    setProjectId(p.id);
    setName(p.name);
    setPrompt(p.prompt);
    setModel(p.model);
    setSourceUrl(p.sourceUrl ?? null);
    setShots(sequence(p.layers as Shot[]));
    setActive(p.layers[p.layers.length - 1]?.id ?? null);
    setIsFinal(true);
  }

  function newProject() {
    setProjectId(crypto.randomUUID());
    setName("Untitled shoot");
    setShots([]);
    setActive(null);
    setSourceUrl(null);
    setCharacterReference(null);
  }

  async function retroUpdate() {
    if (!bible) return;
    for (const shot of stale) {
      await render(shot.prompt, shot);
    }
  }

  async function composeSheetNow() {
    try {
      const frames = sequence(shots)
        .map((s) => s.dataUrl)
        .filter(Boolean);
      const { dataUrl, status } = await composeSheet(frames);
      setGpuMode(status);
      downloadDataUrl(dataUrl, "aurora-composite.png");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compose failed");
    }
  }

  const ordered = sequence(shots);


  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-bold outline-none hover:border-border focus:border-primary"
            aria-label="Project name"
          />
          <button
            type="button"
            onClick={newProject}
            className="rounded-full border border-border px-3 py-1 text-[0.65rem] tracking-wider uppercase transition-colors hover:border-primary hover:text-primary"
          >
            New
          </button>
        </div>

        {bible ? (
          <p className="mt-3 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-[0.7rem] text-primary">
            Bible locked · {bible.name || "artist"} v{bible.version}
            {identityGraph ? " — identity graph injected into every render" : " — add traits to strengthen the lock"}
          </p>
        ) : null}

        <p className="mt-4 font-[family-name:var(--font-mono-ui)] text-[0.65rem] tracking-[0.25em] text-muted-foreground uppercase">
          Step 01 — Source layer
        </p>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-3 flex aspect-4/3 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-secondary/40 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          {sourceUrl ? (
            <img src={sourceUrl} alt="Uploaded source" className="h-full w-full object-cover" />
          ) : (
            "+ Upload media (optional)"
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => readFile(e.target.files?.[0], setSourceUrl)}
        />

        <button
          type="button"
          onClick={() => characterRef.current?.click()}
          className="mt-3 flex w-full items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary"
        >
          <span>Character sheet / face reference</span>
          <span>{characterReference ?? bibleRef ? "Locked" : "Add"}</span>
        </button>
        <input
          ref={characterRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => readFile(e.target.files?.[0], setCharacterReference)}
        />

        <p className="mt-6 font-[family-name:var(--font-mono-ui)] text-[0.65rem] tracking-[0.25em] text-muted-foreground uppercase">
          Step 02 — Engine
        </p>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1 text-center text-xs sm:grid-cols-3">
          {IMAGE_MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModel(m.id)}
              disabled={!m.available}
              title={m.available ? m.note : `${m.note}. This engine is not available through Lovable AI yet.`}
              className={
                model === m.id
                  ? "btn-aurora rounded-md py-2 font-bold"
                  : "rounded-md py-2 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
              }
            >
              {m.label}
            </button>
          ))}
        </div>

        <p className="mt-5 font-[family-name:var(--font-mono-ui)] text-[0.65rem] tracking-[0.25em] text-muted-foreground uppercase">
          Motion engine
        </p>
        <select
          value={videoModel}
          onChange={(event) => setVideoModel(event.target.value)}
          className="mt-3 w-full rounded-lg border border-border bg-secondary px-3 py-3 text-xs outline-none focus:border-primary"
        >
          {VIDEO_MODELS.map((engine) => (
            <option key={engine.id} value={engine.id} disabled={!engine.available}>
              {engine.label}{engine.available ? "" : " · connector required"}
            </option>
          ))}
        </select>
        <p className="mt-2 text-[0.65rem] text-muted-foreground">
          Motion direction is written per shot and travels with the sequence. Seedance, Kling and Wan
          stay visible but disabled until their providers are available.
        </p>

        <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={lockIdentity}
            onChange={(e) => setLockIdentity(e.target.checked)}
            className="accent-primary"
          />
          Lock identity, pose & framing (recommended)
        </label>

        <p className="mt-6 font-[family-name:var(--font-mono-ui)] text-[0.65rem] tracking-[0.25em] text-muted-foreground uppercase">
          Step 03 — Layer prompt
        </p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="mt-3 w-full resize-none rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm outline-none focus:border-primary"
          placeholder="Type your prompt here..."
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPrompt(p)}
              className="rounded-full border border-border px-3 py-1.5 text-left text-[0.7rem] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {p.slice(0, 34)}…
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void render(prompt)}
          disabled={busy}
          className="btn-aurora mt-5 w-full rounded-full px-6 py-3.5 text-sm font-bold tracking-widest uppercase transition-transform hover:scale-[1.01] disabled:opacity-60"
        >
          {busy ? "Rendering layer…" : ordered.length ? "✦ Stack another shot" : "✦ Run layer edit"}
        </button>

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        {projects.length > 0 ? (
          <div className="mt-6 border-t border-border pt-4">
            <p className="font-[family-name:var(--font-mono-ui)] text-[0.65rem] tracking-[0.25em] text-muted-foreground uppercase">
              Saved projects
            </p>
            <ul className="mt-3 space-y-1">
              {projects.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => openProject(p)}
                    className="flex-1 truncate rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary"
                  >
                    {p.name} <span className="text-muted-foreground">· {p.layers.length} shots</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportProjectZip(p)}
                    className="text-[0.65rem] tracking-wider text-accent uppercase"
                  >
                    zip
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjects(deleteProject(p.id))}
                    className="text-[0.65rem] tracking-wider text-muted-foreground uppercase hover:text-destructive"
                  >
                    del
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        <div className="glow-frame relative flex min-h-[340px] items-center justify-center bg-card">
          <span className="label-chip absolute -top-4 left-5 z-10">Output</span>
          {result ? (
            <img
              src={result}
              alt="Generated layer edit"
              className={
                isFinal
                  ? "h-full w-full object-cover blur-0 transition-[filter] duration-500"
                  : "h-full w-full object-cover blur-2xl transition-[filter] duration-500"
              }
            />
          ) : (
            <p className="px-8 text-center font-[family-name:var(--font-mono-ui)] text-xs tracking-[0.25em] text-muted-foreground uppercase">
              {busy ? "Decomposing · editing · recomposing" : "Your edited frame lands here"}
            </p>
          )}
        </div>

        {ordered.length > 0 ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-chip">Storyboard</span>
              <span className="text-[0.65rem] tracking-wider text-muted-foreground uppercase">
                {ordered.length} shots
              </span>
              {stale.length > 0 ? (
                <button
                  type="button"
                  onClick={() => void retroUpdate()}
                  disabled={busy}
                  className="ml-auto rounded-full border border-accent px-3 py-1 text-[0.6rem] font-bold tracking-wider text-accent uppercase disabled:opacity-50"
                >
                  Retro-update {stale.length} shot{stale.length > 1 ? "s" : ""} → v{bible?.version}
                </button>
              ) : null}
            </div>

            <ul className="mt-3 space-y-2">
              {ordered.map((shot) => (
                <li
                  key={shot.id}
                  className={
                    shot.id === active
                      ? "rounded-xl border border-primary bg-secondary/40 p-3"
                      : "rounded-xl border border-border p-3"
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="font-[family-name:var(--font-mono-ui)] text-[0.65rem] tracking-[0.2em] text-accent">
                      {shotCode(shot.order)}
                    </span>
                    {shot.dataUrl ? (
                      <button type="button" onClick={() => setActive(shot.id)} className="size-10 overflow-hidden rounded">
                        <img src={shot.dataUrl} alt={`Shot ${shot.order}`} className="h-full w-full object-cover" />
                      </button>
                    ) : (
                      <span className="rounded bg-secondary px-2 py-1 text-[0.55rem] tracking-wider text-muted-foreground uppercase">
                        unrendered
                      </span>
                    )}
                    <input
                      value={shot.beat ?? ""}
                      onChange={(e) => setShots((prev) => patchShot(prev, shot.id, { beat: e.target.value }))}
                      placeholder="Story beat"
                      className="flex-1 rounded bg-transparent px-1 text-xs font-bold outline-none focus:bg-secondary"
                    />
                    <button
                      type="button"
                      onClick={() => setShots((prev) => moveShot(prev, shot.id, -1))}
                      className="text-xs text-muted-foreground hover:text-primary"
                      aria-label="Move shot up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => setShots((prev) => moveShot(prev, shot.id, 1))}
                      className="text-xs text-muted-foreground hover:text-primary"
                      aria-label="Move shot down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => setShots((prev) => removeShot(prev, shot.id))}
                      className="text-[0.6rem] tracking-wider text-muted-foreground uppercase hover:text-destructive"
                    >
                      del
                    </button>
                  </div>
                  <textarea
                    value={shot.prompt}
                    onChange={(e) => setShots((prev) => patchShot(prev, shot.id, { prompt: e.target.value }))}
                    rows={2}
                    className="mt-2 w-full resize-none rounded bg-transparent text-xs outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      value={shot.motion ?? ""}
                      onChange={(e) => setShots((prev) => patchShot(prev, shot.id, { motion: e.target.value }))}
                      placeholder="Motion direction (for the video pass)"
                      className="flex-1 rounded bg-transparent text-[0.7rem] text-muted-foreground outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void render(shot.prompt, shot)}
                      disabled={busy}
                      className="rounded-full border border-primary px-3 py-1 text-[0.6rem] font-bold tracking-wider text-primary uppercase disabled:opacity-50"
                    >
                      {shot.dataUrl ? "re-render" : "render"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setShots((prev) =>
                    upsertShot(prev, { id: crypto.randomUUID(), prompt: prompt.trim(), dataUrl: "", beat: "New beat" }),
                  )
                }
                className="rounded-full border border-border px-3 py-1.5 text-[0.6rem] tracking-wider uppercase hover:border-primary hover:text-primary"
              >
                + Add shot
              </button>
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard.writeText(buildSequencePrompt(ordered, identityGraph, voiceProfile))
                }
                className="rounded-full border border-border px-3 py-1.5 text-[0.6rem] tracking-wider uppercase hover:border-primary hover:text-primary"
              >
                Copy shot list
              </button>
            </div>
          </div>
        ) : null}

        {ordered.some((s) => s.dataUrl) ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onSave()}
              className="rounded-full border border-primary px-4 py-2 text-[0.7rem] font-bold tracking-wider text-primary uppercase transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              Save + sync
            </button>
            <button
              type="button"
              onClick={() => result && downloadDataUrl(result, "aurora-layer.png")}
              className="rounded-full border border-border px-4 py-2 text-[0.7rem] font-bold tracking-wider uppercase transition-colors hover:border-primary hover:text-primary"
            >
              Download PNG
            </button>
            <button
              type="button"
              onClick={() =>
                ordered
                  .filter((s) => s.dataUrl)
                  .forEach((s) => downloadDataUrl(s.dataUrl, `aurora-${shotCode(s.order)}.png`))
              }
              className="rounded-full border border-border px-4 py-2 text-[0.7rem] font-bold tracking-wider uppercase transition-colors hover:border-primary hover:text-primary"
            >
              All shots
            </button>
            <button
              type="button"
              onClick={() => void composeSheetNow()}
              disabled={busy}
              className="rounded-full border border-border px-4 py-2 text-[0.7rem] font-bold tracking-wider uppercase transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            >
              Composite sheet
            </button>
            <button
              type="button"
              onClick={() => void exportProjectZip(currentProject())}
              className="btn-aurora rounded-full px-4 py-2 text-[0.7rem] font-bold tracking-wider uppercase"
            >
              Export ZIP
            </button>
            <span className="self-center rounded-full border border-border px-3 py-1 text-[0.6rem] tracking-wider text-muted-foreground uppercase">
              {gpuMode === "webgpu" ? "● GPU accelerated" : "○ CPU compose"}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
