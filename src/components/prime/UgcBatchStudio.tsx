import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  generatePrimeHeygenVideo,
  pollPrimeHeygenVideo,
  generatePrimeFreePreview,
} from "@/lib/prime-video.functions";
import {
  Rocket,
  Repeat,
  TrendingUp,
  Settings2,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  X,
  FileText,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Pencil,
  Wand2,
  Trash2,
  Download,
} from "lucide-react";

type ProviderId = "seedance" | "veo" | "sora" | "makeugc" | "kling";
type BackendId = "heygen" | "free" | "byo";

const PROVIDERS: { id: ProviderId; label: string; hint: string }[] = [
  { id: "seedance", label: "Seedance 2.0", hint: "ByteDance Seedance API key" },
  { id: "veo",      label: "Veo 3",        hint: "Google Vertex / Veo API key" },
  { id: "sora",     label: "Sora",         hint: "OpenAI Sora API key" },
  { id: "makeugc",  label: "MakeUGC",      hint: "MakeUGC API key" },
  { id: "kling",    label: "Kling 1.5",    hint: "Kling / Kuaishou API key" },
];

const BACKENDS: { id: BackendId; label: string; desc: string }[] = [
  { id: "heygen", label: "HeyGen (real)",      desc: "Talking-avatar video via HeyGen API — real MP4." },
  { id: "free",   label: "Free preview",       desc: "Pollinations keyframe — instant, no key needed." },
  { id: "byo",    label: "BYO provider",       desc: "Your own API key (Seedance / Veo / Sora / Kling)." },
];

const BACKEND_KEY  = "aurora-prime:ugc:backend:v1";
const CREDS_KEY    = "aurora-prime:ugc:creds:v1";
const ACTIVE_KEY   = "aurora-prime:ugc:active-provider:v1";

type Creds = Partial<Record<ProviderId, string>>;

function loadCreds(): Creds {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(CREDS_KEY) || "{}"); }
  catch { return {}; }
}
function saveCreds(c: Creds) {
  window.localStorage.setItem(CREDS_KEY, JSON.stringify(c));
}

type Card = {
  id: string;
  persona: string;
  hook: string;
  caption: string;
  beats: string;
  aspect: string;
  prompt: string;
};

type JobStatus = "draft" | "queued" | "generating" | "rendering" | "completed" | "failed";

type Job = Card & {
  status: JobStatus;
  videoUrl?: string | null;
  heygenId?: string;
  error?: string;
};

const DEFAULT_CARDS: Card[] = [
  { id: "c1", persona: "Morning routine", hook: "I switched and never looked back", caption: "THIS HITS DIFFERENT", beats: "Wake up → product reveal → reaction", aspect: "9:16", prompt: "Hyper-realistic morning routine, handheld, warm window light, 35mm look, natural skin texture, no AI glow. Product in hand, authentic expression." },
  { id: "c2", persona: "Kitchen creator",  hook: "OK but why is it so good",         caption: "DAY 1 VS DAY 30",     beats: "Top-down pour → taste → shocked face", aspect: "9:16", prompt: "Marble counter top-down cinematic pour, warm practical lighting, 50mm, Kodak Portra look. Natural hands, real kitchen, no plastic textures." },
  { id: "c3", persona: "Gym mirror",       hook: "This is my everyday now",          caption: "IF YOU GET IT",       beats: "Mirror check → product → pump", aspect: "9:16", prompt: "Concrete gym, mirror POV, high contrast, athlete glow, 35mm, natural fluorescent spill. Movement blur on arms, sharp face, no cgi skin." },
];

function genId() { return Math.random().toString(36).slice(2, 9); }

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-sm border px-2 py-1 text-[13px] transition-colors " +
        (active
          ? "border-prime/60 bg-prime/10 text-ink"
          : "border-line bg-canvas text-ink-dim hover:border-prime/40 hover:text-ink")
      }
    >
      {children}
    </button>
  );
}

export function UgcBatchStudio({ onLaunch }: { onLaunch: (t: string) => void }) {
  const [backend, setBackend] = useState<BackendId>(() => {
    if (typeof window === "undefined") return "free";
    return (window.localStorage.getItem(BACKEND_KEY) as BackendId) ?? "free";
  });
  const [creds, setCreds]         = useState<Creds>(loadCreds);
  const [activeProvider, setActiveProvider] = useState<ProviderId>(() => {
    if (typeof window === "undefined") return "seedance";
    return (window.localStorage.getItem(ACTIVE_KEY) as ProviderId) ?? "seedance";
  });
  const [showCreds, setShowCreds] = useState(false);
  const [jobs, setJobs]           = useState<Job[]>(() =>
    DEFAULT_CARDS.map((c) => ({ ...c, status: "draft" })),
  );
  const [editId, setEditId]       = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Card | null>(null);
  const [running, setRunning]     = useState(false);

  useEffect(() => {
    window.localStorage.setItem(BACKEND_KEY, backend);
  }, [backend]);
  useEffect(() => {
    saveCreds(creds);
    window.localStorage.setItem(ACTIVE_KEY, activeProvider);
  }, [creds, activeProvider]);

  const generateFn  = useServerFn(generatePrimeHeygenVideo);
  const pollFn      = useServerFn(pollPrimeHeygenVideo);
  const freeFn      = useServerFn(generatePrimeFreePreview);

  const pollUntilDone = async (jobId: string, heygenId: string) => {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const res = await pollFn({ data: { videoId: heygenId } });
        if (res.status === "completed" && res.videoUrl) {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === jobId ? { ...j, status: "completed", videoUrl: res.videoUrl } : j,
            ),
          );
          return;
        }
        if (res.status === "failed") {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === jobId ? { ...j, status: "failed", error: res.error ?? "HeyGen failed" } : j,
            ),
          );
          return;
        }
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId ? { ...j, status: res.status === "processing" ? "rendering" : "generating" } : j,
          ),
        );
      } catch { /* continue polling */ }
    }
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId ? { ...j, status: "failed", error: "Timed out" } : j,
      ),
    );
  };

  const runJob = async (job: Job) => {
    setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, status: "queued" } : j));

    try {
      if (backend === "free") {
        setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, status: "generating" } : j));
        const res = await freeFn({ data: { prompt: job.prompt, aspect: job.aspect } });
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, status: "completed", videoUrl: res.previewUrl } : j,
          ),
        );
      } else if (backend === "heygen") {
        setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, status: "generating" } : j));
        const res = await generateFn({ data: { prompt: job.hook + " — " + job.beats, aspect: job.aspect } });
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, heygenId: res.videoId, status: "rendering" } : j,
          ),
        );
        await pollUntilDone(job.id, res.videoId);
      } else {
        setJobs((prev) => prev.map((j) =>
          j.id === job.id ? { ...j, status: "failed", error: "BYO mode: configure your API key in the provider settings" } : j,
        ));
      }
    } catch (err) {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id ? { ...j, status: "failed", error: (err as Error).message } : j,
        ),
      );
    }
  };

  const runAll = async () => {
    if (running) return;
    setRunning(true);
    const drafts = jobs.filter((j) => j.status === "draft" || j.status === "failed");
    for (const job of drafts) {
      await runJob(job);
    }
    setRunning(false);
  };

  const addCard = () => {
    const card: Card = {
      id: genId(),
      persona: "New persona",
      hook: "Write your hook here",
      caption: "CAPTION HERE",
      beats: "Hook → demo → CTA",
      aspect: "9:16",
      prompt: "Cinematic UGC, 9:16, natural light, 35mm, no plastic AI look, real human motion.",
    };
    setJobs((prev) => [...prev, { ...card, status: "draft" }]);
    setEditId(card.id);
    setEditDraft(card);
  };

  const saveEdit = () => {
    if (!editDraft) return;
    setJobs((prev) =>
      prev.map((j) => (j.id === editDraft.id ? { ...j, ...editDraft, status: "draft" } : j)),
    );
    setEditId(null);
    setEditDraft(null);
  };

  const removeCard = (id: string) => setJobs((prev) => prev.filter((j) => j.id !== id));

  const resetCard = (id: string) => setJobs((prev) =>
    prev.map((j) => j.id === id ? { ...j, status: "draft", videoUrl: undefined, error: undefined } : j),
  );

  const statusIcon = (s: JobStatus) => {
    if (s === "completed") return <CheckCircle2 className="size-3.5 text-prime-glow" />;
    if (s === "failed")    return <AlertTriangle className="size-3.5 text-rec" />;
    if (s === "generating" || s === "rendering" || s === "queued")
      return <Loader2 className="size-3.5 animate-spin text-rec" />;
    return <FileText className="size-3.5 text-ink-dim" />;
  };

  const getAIBrief = () => {
    const brief = [
      `UGC CONTENT MACHINE — generate ${jobs.length + 3} short-form vertical (9:16) UGC video briefs.`,
      "Cinematic-real, natural human motion, TikTok-native pacing. No plastic AI look.",
      "",
      "FOR EACH variant output a card with:",
      "• persona / hook (≤ 8 words) / on-screen caption (≤ 6 words, ALL CAPS)",
      "• scene + wardrobe + lighting + lens (35mm, natural light)",
      "• 8-second beat plan (0-1s hook, 1-5s demo, 5-7s payoff, 7-8s CTA)",
      "• ready-to-paste Seedance prompt fenced as ```seedance ... ``` (subject, action, camera, lighting, film stock, aspect 9:16, negative prompt, duration 8s)",
      "",
      "End with the 5 strongest variants ranked by hook strength.",
    ].join("\n");
    onLaunch(brief);
  };

  return (
    <section className="fade-up rounded-sm border border-rec/40 bg-gradient-to-br from-rec/10 via-panel/80 to-prime/10 p-5">
      {/* header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.25em] text-rec">
            <span className="size-1.5 rounded-full bg-rec rec-pulse" />
            UGC Batch Studio
          </div>
          <h2 className="font-black-display mt-1 text-2xl uppercase leading-tight text-ink">
            Batch UGC videos. <span className="text-rec">One run.</span>
          </h2>
          <p className="mt-0.5 max-w-lg text-[13px] font-medium text-ink-dim">
            Edit cards, choose a backend, press Run. Each card generates a short-form video prompt
            — HeyGen for real renders, free preview for instant keyframes.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-[13px] uppercase tracking-widest text-rec/80">
          <span className="flex items-center gap-1"><TrendingUp className="size-3" /> {jobs.length} cards</span>
          <span className="flex items-center gap-1"><Repeat className="size-3" /> {backend}</span>
        </div>
      </div>

      {/* backend selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {BACKENDS.map((b) => (
          <button
            key={b.id}
            onClick={() => setBackend(b.id)}
            className={
              "flex flex-col rounded-sm border px-3 py-2 text-left text-sm transition-colors " +
              (backend === b.id
                ? "border-rec/60 bg-rec/10 text-ink"
                : "border-line text-ink-dim hover:border-prime/40 hover:text-ink")
            }
          >
            <span className="font-bold uppercase tracking-widest">{b.label}</span>
            <span className="mt-0.5 text-[13px] text-ink-dim">{b.desc}</span>
          </button>
        ))}
      </div>

      {/* creds panel (BYO only) */}
      {backend === "byo" && (
        <div className="mb-4 rounded-sm border border-line bg-panel/70 p-3">
          <button
            onClick={() => setShowCreds((v) => !v)}
            className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-widest text-ink-dim hover:text-ink"
          >
            <Settings2 className="size-3" />
            Provider Settings
            {showCreds ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
          </button>
          {showCreds && (
            <div className="mt-3 space-y-2">
              <div className="mb-2 flex flex-wrap gap-2">
                {PROVIDERS.map((p) => (
                  <Chip
                    key={p.id}
                    active={activeProvider === p.id}
                    onClick={() => setActiveProvider(p.id)}
                  >
                    {p.label}
                  </Chip>
                ))}
              </div>
              {PROVIDERS.filter((p) => p.id === activeProvider).map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <input
                    type="password"
                    value={creds[p.id] ?? ""}
                    onChange={(e) => setCreds((c) => ({ ...c, [p.id]: e.target.value }))}
                    placeholder={p.hint}
                    className="flex-1 rounded-sm border border-line bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-ink-dim/60 focus:border-prime focus:outline-none"
                  />
                  <button
                    onClick={() => setCreds((c) => ({ ...c, [p.id]: (document.querySelector(`input[placeholder="${p.hint}"]`) as HTMLInputElement)?.value ?? "" }))}
                    className="flex items-center gap-1 rounded-sm border border-line bg-panel-2 px-2 py-1.5 text-[13px] uppercase tracking-widest text-ink-dim hover:border-prime/60 hover:text-ink"
                  >
                    <Save className="size-3" /> Save
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* job cards grid */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="relative rounded-sm border border-line bg-panel/60 p-3"
          >
            {/* status badge */}
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[13px] uppercase tracking-widest text-ink-dim">
                {statusIcon(job.status)}
                {job.status}
              </div>
              <div className="flex gap-1">
                {(job.status === "draft" || job.status === "failed") && (
                  <button onClick={() => { setEditId(job.id); setEditDraft({ ...job }); }} className="rounded-sm p-1 text-ink-dim hover:text-ink">
                    <Pencil className="size-3" />
                  </button>
                )}
                {job.status !== "draft" && (
                  <button onClick={() => resetCard(job.id)} className="rounded-sm p-1 text-ink-dim hover:text-ink">
                    <RotateCcw className="size-3" />
                  </button>
                )}
                <button onClick={() => removeCard(job.id)} className="rounded-sm p-1 text-ink-dim hover:text-rec">
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>

            {/* preview / content */}
            {job.videoUrl && job.status === "completed" ? (
              <div className="mb-2 overflow-hidden rounded-sm">
                {job.videoUrl.endsWith(".mp4") ? (
                  <video src={job.videoUrl} controls className="w-full rounded-sm" />
                ) : (
                  <img src={job.videoUrl} alt="preview" className="w-full rounded-sm object-cover" />
                )}
                <a
                  href={job.videoUrl}
                  download
                  className="mt-1 flex items-center gap-1 text-xs uppercase tracking-widest text-prime-glow hover:underline"
                >
                  <Download className="size-3" /> Download
                </a>
              </div>
            ) : null}

            {editId === job.id && editDraft ? (
              <div className="space-y-2 text-sm">
                {(["persona", "hook", "caption", "beats"] as const).map((field) => (
                  <label key={field} className="block">
                    <span className="text-[13px] uppercase tracking-widest text-ink-dim">{field}</span>
                    <input
                      value={editDraft[field]}
                      onChange={(e) => setEditDraft((d) => d ? { ...d, [field]: e.target.value } : d)}
                      className="mt-0.5 w-full rounded-sm border border-line bg-canvas px-2 py-1 text-sm text-ink focus:border-prime focus:outline-none"
                    />
                  </label>
                ))}
                <label className="block">
                  <span className="text-[13px] uppercase tracking-widest text-ink-dim">Prompt</span>
                  <textarea
                    value={editDraft.prompt}
                    onChange={(e) => setEditDraft((d) => d ? { ...d, prompt: e.target.value } : d)}
                    rows={3}
                    className="mt-0.5 w-full resize-none rounded-sm border border-line bg-canvas px-2 py-1 text-sm text-ink focus:border-prime focus:outline-none"
                  />
                </label>
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="flex items-center gap-1 rounded-sm bg-prime px-2 py-1 text-[13px] uppercase tracking-widest text-white hover:bg-prime-glow">
                    <Save className="size-3" /> Save
                  </button>
                  <button onClick={() => { setEditId(null); setEditDraft(null); }} className="flex items-center gap-1 rounded-sm border border-line px-2 py-1 text-[13px] uppercase tracking-widest text-ink-dim hover:text-ink">
                    <X className="size-3" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-[13px] font-bold uppercase tracking-widest text-prime">{job.persona}</div>
                <div className="mt-1 text-[12px] font-bold text-ink">{job.hook}</div>
                <div className="mt-0.5 text-[13px] uppercase tracking-widest text-rec">{job.caption}</div>
                {job.error && (
                  <div className="mt-1 text-sm font-medium text-rec">{job.error}</div>
                )}
                {(job.status === "draft" || job.status === "failed") && (
                  <button
                    onClick={() => runJob(job)}
                    className="mt-2 flex items-center gap-1 rounded-sm bg-rec px-2 py-1 text-[13px] uppercase tracking-widest text-white hover:bg-rec-glow"
                  >
                    <Rocket className="size-3" /> Run
                  </button>
                )}
              </>
            )}
          </div>
        ))}

        {/* add card */}
        <button
          onClick={addCard}
          className="flex min-h-[120px] items-center justify-center rounded-sm border border-dashed border-line text-ink-dim transition-colors hover:border-prime/60 hover:text-ink"
        >
          <span className="flex flex-col items-center gap-1 text-sm font-medium">
            <Wand2 className="size-4" />
            Add card
          </span>
        </button>
      </div>

      {/* actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={getAIBrief}
          className="flex items-center gap-1.5 rounded-sm border border-prime/40 px-3 py-2 text-[13px] uppercase tracking-widest text-prime hover:border-prime hover:bg-prime/10"
        >
          <Wand2 className="size-3" /> AI Brief {jobs.length + 3} UGC Cards
        </button>
        <button
          onClick={runAll}
          disabled={running}
          className="flex items-center gap-1.5 rounded-sm bg-rec px-5 py-2 font-display text-sm font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-rec-glow disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? <Loader2 className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />}
          Run All
        </button>
      </div>
    </section>
  );
}
