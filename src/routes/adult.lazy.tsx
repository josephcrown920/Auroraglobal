import { useEffect, useMemo, useRef, useState } from "react";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Download,
  ImagePlus,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { FeatureGuard } from "@/components/FeatureVisibilityProvider";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

type AdultModel = {
  id: string;
  name: string;
  niche: string;
  cover: string;
  photos: string[];
  tag?: string;
};

const MODELS: AdultModel[] = [
  {
    id: "yuki",
    name: "Yuki",
    niche: "Fashion · Editorial",
    cover: "/sample-photos/model-yuki-1.jpg",
    photos: ["/sample-photos/model-yuki-1.jpg", "/sample-photos/model-yuki-2.jpg"],
    tag: "Featured",
  },
  { id: "lily", name: "Lily", niche: "Travel · Outdoor", cover: "/eromify/avatar-lily.jpg", photos: ["/eromify/avatar-lily.jpg"] },
  { id: "aria", name: "Aria", niche: "Lifestyle", cover: "/eromify/avatar-aria.jpg", photos: ["/eromify/avatar-aria.jpg"] },
  { id: "maya", name: "Maya", niche: "Beauty · Glam", cover: "/eromify/avatar-maya.jpg", photos: ["/eromify/avatar-maya.jpg"] },
];

const LOOKS = [
  ["boudoir", "Boudoir", "from-rose-700 to-rose-950"],
  ["velvet", "Velvet", "from-violet-700 to-violet-950"],
  ["golden", "Golden Hour", "from-amber-600 to-amber-950"],
  ["neon", "Neon", "from-fuchsia-600 to-pink-950"],
  ["luxury", "Luxury Suite", "from-stone-600 to-stone-950"],
  ["noir", "Noir", "from-gray-600 to-gray-950"],
  ["ethereal", "Ethereal", "from-purple-600 to-indigo-950"],
  ["power", "Power", "from-red-600 to-red-950"],
] as const;

const LOOK_PROMPTS: Record<string, string> = {
  boudoir: "Magazine-grade boudoir editorial portrait, luxurious silk sheets, soft morning window light, warm amber glow, intimate but tasteful composition.",
  velvet: "Cinematic editorial portrait in deep velvet surroundings, rich jewel-tone colors, atmospheric side lighting, dramatic shadows.",
  golden: "Golden hour outdoor editorial, warm backlit rim light, soft bokeh background, glowing skin, sun-kissed look.",
  neon: "Moody neon-lit editorial portrait, magenta and cyan gels, atmospheric haze, wet reflections, anamorphic cinema look.",
  luxury: "Five-star hotel suite editorial, marble surfaces, designer furnishings, warm chandelier light, aspirational magazine look.",
  noir: "Classic film noir editorial portrait, high contrast black and white, hard spotlight, venetian blind shadows, old Hollywood glamour.",
  ethereal: "Ethereal high-key editorial portrait, soft diffused light, dreamy atmosphere, white and cream tones, delicate shadows.",
  power: "Bold power editorial portrait, strong directional dramatic lighting, confident pose framing, fashion magazine cover quality.",
};

export const Route = createLazyFileRoute("/adult")({
  component: () => (
    <FeatureGuard feature="adult-school">
      <AdultSchool />
    </FeatureGuard>
  ),
});

function AdultSchool() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [entered, setEntered] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(() => {
    try {
      return localStorage.getItem("aurora_adult_age_confirmed") === "1";
    } catch {
      return false;
    }
  });
  const [selectedModel, setSelectedModel] = useState<AdultModel | null>(null);

  if (!entered) return <AdultLanding onEnter={() => setEntered(true)} />;
  if (!ageConfirmed) {
    return (
      <AgeGate
        onConfirm={() => {
          localStorage.setItem("aurora_adult_age_confirmed", "1");
          setAgeConfirmed(true);
        }}
      />
    );
  }
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#050207] text-rose-300"><Loader2 className="animate-spin" /></div>;
  }
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050207] px-6 text-center text-white">
        <div className="max-w-sm">
          <ShieldCheck className="mx-auto mb-5 text-rose-400" size={32} />
          <h1 className="text-2xl font-black">Sign in to enter your private studio</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/45">Your roster and generated gallery are scoped to your Aurora account.</p>
          <button
            className="mt-7 rounded-full bg-gradient-to-r from-rose-600 to-pink-600 px-6 py-3 text-sm font-bold text-white"
            onClick={() => navigate({ to: "/auth", search: { next: "/adult" } })}
          >
            Sign in securely
          </button>
        </div>
      </div>
    );
  }

  return selectedModel ? (
    <AdultModelStudio model={selectedModel} userId={user.id} onBack={() => setSelectedModel(null)} />
  ) : (
    <AdultRoster
      userEmail={user.email}
      onSelect={setSelectedModel}
      onSignOut={() => void supabase.auth.signOut()}
    />
  );
}

function AdultLanding({ onEnter }: { onEnter: () => void }) {
  const grid = Array.from({ length: 8 }, (_, index) => `/eromify/grid-${index + 1}.jpg`);
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#06020a] text-white">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#06020a]/85 px-5 py-4 backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-2 text-sm font-black text-white no-underline">
          <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-rose-600 to-pink-400 italic">e</span>
          Eromify <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-rose-300">Adult School</span>
        </Link>
        <button onClick={onEnter} className="rounded-full bg-gradient-to-r from-rose-600 to-pink-500 px-5 py-2 text-xs font-bold">Enter studio <ArrowRight className="ml-1 inline" size={13} /></button>
      </header>
      <section className="mx-auto max-w-6xl px-5 pb-20 pt-12 sm:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-rose-400">AI photoshoot studio · 18+</p>
            <h1 className="mt-5 text-5xl font-black leading-[0.98] tracking-[-0.05em] sm:text-7xl">Your editorial.<br />Your <span className="bg-gradient-to-r from-rose-500 to-pink-300 bg-clip-text text-transparent">identity.</span><br />Your control.</h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-white/55">Upload a face photo, choose an editorial look, and create identity-locked 8K shots that stay in your private vault.</p>
            <button onClick={onEnter} className="mt-8 rounded-full bg-gradient-to-r from-rose-600 to-pink-500 px-7 py-3.5 text-sm font-black shadow-[0_0_40px_rgba(225,29,106,0.35)]">Enter the private studio</button>
          </div>
          <div className="grid grid-cols-4 gap-2 rounded-3xl border border-white/10 bg-white/[0.03] p-2 shadow-2xl shadow-black/40">
            {grid.map((src, index) => <img key={src} src={src} alt={`Editorial preview ${index + 1}`} className="aspect-[3/4] w-full rounded-xl object-cover" loading={index > 3 ? "lazy" : "eager"} />)}
          </div>
        </div>
        <div className="mt-20 grid gap-4 sm:grid-cols-3">
          {[
            { title: "Identity locked", body: "Keep the same face, skin tone, and hairstyle across every look.", Icon: Lock },
            { title: "Private by default", body: "Your generations stay scoped to your account until you export them.", Icon: ShieldCheck },
            { title: "Ready in ~60s", body: "Pick a look, add direction, and get a finished editorial frame.", Icon: Camera },
          ].map(({ title, body, Icon }) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <Icon className="mb-4 text-rose-400" size={20} />
              <h2 className="text-sm font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/45">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function AgeGate({ onConfirm }: { onConfirm: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050207] px-6 text-center text-white">
      <div className="max-w-md">
        <div className="mx-auto mb-7 flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-rose-600 to-rose-900 text-3xl shadow-[0_0_55px_rgba(225,29,106,0.4)]">🔞</div>
        <h1 className="text-3xl font-black tracking-tight">You must be 18+<br />to enter this site</h1>
        <p className="mt-4 text-sm leading-relaxed text-white/50">Adult School is an adult platform for 18+ content creators. By continuing you confirm you are of legal age.</p>
        <div className="mt-8 flex flex-col gap-3">
          <button onClick={onConfirm} className="rounded-2xl bg-gradient-to-r from-rose-600 to-pink-500 px-5 py-4 text-base font-black">I am 18 or older — Enter</button>
          <Link to="/" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/50 no-underline">I am under 18 — Exit</Link>
        </div>
        <p className="mt-5 text-xs text-white/25">Your choice is stored locally on this device.</p>
      </div>
    </main>
  );
}

function AdultRoster({ userEmail, onSelect, onSignOut }: { userEmail?: string; onSelect: (model: AdultModel) => void; onSignOut: () => void }) {
  return (
    <main className="min-h-screen bg-[#050207] text-white">
      <header className="flex items-center justify-between border-b border-white/10 bg-[#050207]/90 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2"><Camera size={16} className="text-rose-400" /><span className="text-sm font-black">Adult School</span><span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-rose-300">Studio</span></div>
        <div className="flex items-center gap-3 text-xs text-white/40"><span className="hidden sm:inline">{userEmail}</span><button onClick={onSignOut} className="rounded-lg border border-white/10 px-2.5 py-1.5 hover:text-white">Sign out</button></div>
      </header>
      <section className="mx-auto max-w-6xl px-5 py-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-400">Model studios</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Choose a model to shoot</h1>
        <p className="mt-2 text-sm text-white/40">Shared identity anchors. Your generated shots stay private to you.</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {MODELS.map((model) => (
            <button key={model.id} onClick={() => onSelect(model)} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-left transition hover:border-rose-500/50 hover:shadow-[0_0_35px_rgba(225,29,106,0.14)]">
              <div className="relative aspect-[3/4] overflow-hidden"><img src={model.cover} alt={model.name} className="size-full object-cover object-top transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-[#050207] via-transparent to-transparent" />{model.tag && <span className="absolute right-3 top-3 rounded bg-rose-600 px-2 py-1 text-[9px] font-bold uppercase tracking-widest">Featured</span>}</div>
              <div className="p-4"><p className="font-bold">{model.name}</p><p className="mt-1 text-xs text-white/40">{model.niche}</p><p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-rose-400/75">{model.photos.length} reference photo{model.photos.length > 1 ? "s" : ""} · 8 looks</p></div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function AdultModelStudio({ model, userId, onBack }: { model: AdultModel; userId: string; onBack: () => void }) {
  const [lookId, setLookId] = useState("boudoir");
  const [prompt, setPrompt] = useState("");
  const [extraFile, setExtraFile] = useState<File | null>(null);
  const [extraPreview, setExtraPreview] = useState<string | null>(null);
  const [results, setResults] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedLook = useMemo(() => LOOKS.find(([id]) => id === lookId) ?? LOOKS[0], [lookId]);

  useEffect(() => {
    let cancelled = false;
    void supabase.from("generations").select("result_image_url, status, created_at").eq("user_id", userId).like("model", `adult-school/${model.id}%`).eq("status", "succeeded").order("created_at", { ascending: false }).limit(40).then(({ data }) => {
      if (!cancelled) setResults((data ?? []).flatMap((row) => row.result_image_url ? [row.result_image_url] : []));
    });
    return () => { cancelled = true; };
  }, [model.id, userId]);

  async function generate() {
    setGenerating(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expired — sign in again");
      const toDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const refs = await Promise.all(model.photos.map(async (src) => {
        const response = await fetch(src);
        return toDataUrl(new File([await response.blob()], "reference.jpg", { type: "image/jpeg" }));
      }));
      if (extraFile) refs.push(await toDataUrl(extraFile));
      const details = prompt.trim() ? ` Additional details: ${prompt.trim()}.` : "";
      const response = await fetch("/api/adult-admin/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          kind: "image",
          prompt: `Use the uploaded face photo as strict identity reference. Preserve facial likeness, skin tone, and hairstyle exactly. ${LOOK_PROMPTS[lookId]}${details} Hyper-realistic editorial photography, ultra-HD 8K, lifelike skin texture, physically accurate lighting, no CGI.`,
          base64Images: refs,
          editStrict: true,
          historyModelId: model.id,
          historyLookId: lookId,
        }),
      });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Generation failed");
      if (!body.url) throw new Error("Render finished but no image was returned");
      setResults((previous) => [body.url!, ...previous]);
      toast.success("Shot ready");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050207] text-white">
      <header className="flex items-center justify-between border-b border-white/10 bg-[#050207]/90 px-5 py-3 backdrop-blur-xl">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-white/45 hover:text-white"><ArrowLeft size={13} /> Models</button>
        <div className="flex items-center gap-2"><img src={model.cover} alt="" className="size-7 rounded-full object-cover object-top" /><span className="text-sm font-bold">{model.name}</span><span className="hidden text-xs text-white/35 sm:inline">{model.niche}</span></div>
        <Link to="/connect" className="text-xs text-white/45 no-underline hover:text-white">Connect</Link>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 p-5 lg:grid-cols-[300px_1fr]">
        <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3"><div className="flex gap-1">{model.photos.map((src) => <img key={src} src={src} alt="" className="size-9 rounded-lg object-cover object-top" />)}</div><div><p className="text-xs font-bold">{model.name}</p><p className="text-[10px] text-rose-300/70">Identity locked</p></div></div>
          <p className="mb-2 mt-6 text-[10px] font-bold uppercase tracking-widest text-white/35">Look</p>
          <div className="grid grid-cols-4 gap-1.5">{LOOKS.map(([id, label, swatch]) => <button key={id} onClick={() => setLookId(id)} className={`rounded-xl border p-2 transition ${id === lookId ? "border-rose-500/60 bg-rose-500/10" : "border-white/5 bg-white/[0.02]"}`}><span className={`mx-auto block size-5 rounded-md bg-gradient-to-br ${swatch}`} /><span className={`mt-1 block text-[9px] ${id === lookId ? "text-rose-300" : "text-white/40"}`}>{label}</span></button>)}</div>
          <p className="mb-2 mt-6 text-[10px] font-bold uppercase tracking-widest text-white/35">Style reference <span className="font-normal normal-case tracking-normal opacity-60">(optional)</span></p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0] ?? null; setExtraFile(file); setExtraPreview(file ? URL.createObjectURL(file) : null); }} />
          {extraPreview ? <div className="relative size-20 overflow-hidden rounded-xl"><img src={extraPreview} alt="Style reference" className="size-full object-cover" /><button onClick={() => { setExtraFile(null); setExtraPreview(null); }} className="absolute right-1 top-1 rounded bg-black/70 p-1"><X size={10} /></button></div> : <button onClick={() => fileRef.current?.click()} className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/10 text-white/30 hover:border-rose-500/50 hover:text-rose-300"><ImagePlus size={17} /><span className="text-[9px]">Outfit</span></button>}
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={3} placeholder="Outfit details, setting notes, styling instructions…" className="mt-5 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white outline-none placeholder:text-white/20 focus:border-rose-500/50" />
          <button onClick={() => void generate()} disabled={generating} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-500 py-3.5 text-sm font-black disabled:opacity-50">{generating ? <><Loader2 size={15} className="animate-spin" /> Rendering…</> : <><Sparkles size={15} /> Generate · 1 Aura</>}</button>
          <p className="mt-3 text-center text-[10px] text-white/25">Private to you · Watermarked · ~60s</p>
        </aside>
        <section className="min-h-[600px] rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="text-sm font-bold uppercase tracking-widest text-white/60">Your gallery — {model.name}</h2><p className="mt-1 text-xs text-white/30">{results.length} shot{results.length === 1 ? "" : "s"}</p></div><span className="flex items-center gap-1.5 text-[10px] text-emerald-300"><Check size={12} /> Private vault</span></div>
          {results.length === 0 ? <div className="flex min-h-[480px] flex-col items-center justify-center text-center text-white/25"><Upload size={34} className="mb-4" /><p className="text-sm">Choose a look and generate your first shot.</p><p className="mt-2 max-w-xs text-xs leading-relaxed">Your identity-locked editorial output will appear here.</p></div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{results.map((url, index) => <div key={`${url}-${index}`} className="group overflow-hidden rounded-xl border border-white/10"><div className="relative aspect-[9/16]"><img src={url} alt={`${selectedLook[1]} editorial shot ${index + 1}`} className="size-full object-cover" /><a href={url} target="_blank" rel="noreferrer" className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-black/70 px-2 py-1 text-[10px] text-white opacity-0 transition group-hover:opacity-100"><Download size={10} /> Save</a></div><p className="px-2 py-2 text-[10px] text-white/40">{selectedLook[1]}</p></div>)}</div>}
        </section>
      </div>
    </main>
  );
}