import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Palette, Save, Trash2, Check, RotateCcw, Shield, Eye } from "lucide-react";
import {
  applyDesignSkin,
  deleteSkin,
  fetchSkins,
  saveSkin,
  setActiveSkin,
  slugify,
  DEFAULT_TOKENS,
  SKIN_PRESETS,
  TOKEN_FIELDS,
  type SkinTokens,
} from "@/lib/design-skins";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";

export const Route = createLazyFileRoute("/admin/design")({
  component: AdminDesignPage,
});

const GROUPS = Array.from(new Set(TOKEN_FIELDS.map((f) => f.group)));

function AdminDesignPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("My skin");
  const [tokens, setTokens] = useState<SkinTokens>({ ...DEFAULT_TOKENS });
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [user, loading, navigate]);

  // Live preview writes tokens straight onto <html>; leaving the page or
  // toggling preview off restores whatever the site-wide skin is.
  useEffect(() => {
    if (previewing) applyDesignSkin(tokens);
  }, [previewing, tokens]);
  useEffect(() => {
    return () => {
      if (previewing) applyDesignSkin(null);
    };
  }, [previewing]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-design-skins"],
    queryFn: fetchSkins,
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
  const skins = data?.skins ?? [];
  const activeSlug = data?.activeSlug ?? "";

  const saveMut = useMutation({
    mutationFn: async () => {
      const slug = slugify(name);
      await saveSkin({ slug, name, tokens });
      return slug;
    },
    onSuccess: () => {
      toast.success("Skin saved");
      qc.invalidateQueries({ queryKey: ["admin-design-skins"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const activateMut = useMutation({
    mutationFn: (slug: string) => setActiveSkin(slug),
    onSuccess: (_r, slug) => {
      toast.success(slug ? "Skin is now live site-wide" : "Reverted to the default design");
      qc.invalidateQueries({ queryKey: ["admin-design-skins"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (slug: string) => deleteSkin(slug),
    onSuccess: () => {
      toast.success("Skin deleted");
      qc.invalidateQueries({ queryKey: ["admin-design-skins"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const grouped = useMemo(
    () => GROUPS.map((g) => ({ group: g, fields: TOKEN_FIELDS.filter((f) => f.group === g) })),
    [],
  );

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }
  const set = (key: string, value: string) => setTokens((t) => ({ ...t, [key]: value }));

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between pl-24 pr-6 md:pl-24 md:pr-10 py-5 border-b border-border bg-card/40 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <Link to="/admin" className="flex items-center gap-2 font-semibold tracking-tight">
            <img loading="lazy" src={auroraLogo.url} alt="Aurora" className="size-8 rounded-xl object-contain" />
            Aurora Admin
            <span className="ml-2 text-xs uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center gap-1">
              <Shield className="size-3" /> Admin
            </span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Palette className="size-4" /> Design Studio
          </span>
        </div>
        <Link to="/admin" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to Admin
        </Link>
      </header>

      <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Front-end design skins</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Build a design style, preview it live, save it as a template, then activate one to change the
            look of the whole site for every visitor. Deactivate at any time to return to the shipped design.
          </p>
        </div>

        {/* Saved skins */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Saved templates</h2>
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          )}
          {!isLoading && skins.length === 0 && (
            <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
              No saved skins yet — start from a preset below, tweak it, and save.
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {skins.map((s) => (
              <div key={s.slug} className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{s.name}</span>
                  {activeSlug === s.slug && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                      LIVE
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  {["background", "card", "primary", "primary-glow", "foreground"].map((k) => (
                    <span
                      key={k}
                      className="size-6 rounded-md border border-border"
                      style={{ background: s.tokens[k] ?? "transparent" }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs gap-1"
                    onClick={() => {
                      setName(s.name);
                      setTokens({ ...DEFAULT_TOKENS, ...s.tokens });
                      toast.success(`Loaded "${s.name}" into the editor`);
                    }}
                  >
                    Edit
                  </Button>
                  {activeSlug === s.slug ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs gap-1"
                      onClick={() => activateMut.mutate("")}
                      disabled={activateMut.isPending}
                    >
                      <RotateCcw className="size-3.5" /> Deactivate
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="text-xs gap-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
                      onClick={() => activateMut.mutate(s.slug)}
                      disabled={activateMut.isPending}
                    >
                      <Check className="size-3.5" /> Make live
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs gap-1 text-destructive"
                    onClick={() => deleteMut.mutate(s.slug)}
                    disabled={deleteMut.isPending}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Editor */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 justify-between">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Skin name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="w-64" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={previewing ? "default" : "outline"}
                className="gap-1.5"
                onClick={() => {
                  const next = !previewing;
                  setPreviewing(next);
                  if (!next) applyDesignSkin(null);
                }}
              >
                <Eye className="size-4" /> {previewing ? "Preview on" : "Live preview"}
              </Button>
              <Button className="gap-1.5" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                {saveMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
                template
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {SKIN_PRESETS.map((p) => (
              <Button
                key={p.name}
                size="sm"
                variant="outline"
                onClick={() => {
                  setTokens({ ...p.tokens });
                  setName(p.name.replace(" (default)", ""));
                }}
              >
                {p.name}
              </Button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {grouped.map(({ group, fields }) => (
              <div key={group} className="rounded-2xl border border-border bg-card/40 p-5 space-y-3">
                <h3 className="text-sm font-semibold">{group}</h3>
                <div className="space-y-2">
                  {fields.map((f) => (
                    <div key={f.key} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground flex-1 truncate">{f.label}</span>
                      {f.type === "color" ? (
                        <>
                          <input
                            type="color"
                            aria-label={f.label}
                            value={/^#[0-9a-f]{6}$/i.test(tokens[f.key] ?? "") ? tokens[f.key] : "#000000"}
                            onChange={(e) => set(f.key, e.target.value)}
                            className="size-8 rounded-md border border-border bg-transparent p-0.5"
                          />
                          <Input
                            value={tokens[f.key] ?? ""}
                            onChange={(e) => set(f.key, e.target.value)}
                            className="w-28 h-8 text-xs font-mono"
                          />
                        </>
                      ) : (
                        <Input
                          value={tokens[f.key] ?? ""}
                          onChange={(e) => set(f.key, e.target.value)}
                          className="flex-1 h-8 text-xs font-mono max-w-[22rem]"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Static swatch preview — always reflects the editor, regardless of live preview */}
          <div
            className="rounded-2xl border p-6 space-y-4"
            style={{ background: tokens.background, borderColor: tokens.border, color: tokens.foreground }}
          >
            <div className="text-xs uppercase tracking-wider" style={{ color: tokens["muted-foreground"] }}>
              Preview
            </div>
            <div
              className="text-2xl font-semibold"
              style={{
                backgroundImage: tokens["gradient-text"],
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              AURORA PERFORMANCE STUDIO
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <span
                className="px-4 py-2 text-sm font-medium"
                style={{
                  background: tokens.primary,
                  color: tokens["primary-foreground"],
                  borderRadius: tokens.radius,
                  boxShadow: tokens["shadow-glow"],
                }}
              >
                Generate
              </span>
              <span
                className="px-4 py-2 text-sm"
                style={{
                  background: tokens.card,
                  border: `1px solid ${tokens.border}`,
                  borderRadius: tokens.radius,
                }}
              >
                Card surface
              </span>
              <span
                className="px-4 py-2 text-sm"
                style={{ backgroundImage: tokens["gradient-hero"], borderRadius: tokens.radius, color: "#fff" }}
              >
                Hero gradient
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
