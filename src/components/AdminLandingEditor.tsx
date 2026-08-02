import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { amIAdmin } from "@/lib/admin.functions";
import { getSiteImages, adminResetSiteImage, type SiteImageRow } from "@/lib/site-images.functions";
import { getSiteCopy, adminSetSiteCopy, adminDeleteSiteCopy, type SiteCopyRow } from "@/lib/site-copy.functions";
import { SITE_IMAGES_REFRESH_EVENT } from "@/components/landing/SiteImagesProvider";
import { SITE_COPY_REFRESH_EVENT } from "@/components/landing/SiteCopyProvider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Pencil, Upload, RotateCcw, Image, Type } from "lucide-react";

/**
 * Floating "Edit landing" pill visible only to signed-in admins on the
 * landing page. Opens a Sheet with two tabs:
 *  - Images: replace / reset any hero or gallery image slot
 *  - Text:   edit any piece of landing page copy (hero slides + marquee tags)
 */
export function AdminLandingEditor() {
  const [isAdmin, setIsAdmin] = useState(false);
  const amIAdminFn = useServerFn(amIAdmin);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session) return;
      amIAdminFn()
        .then((r) => { if (!cancelled) setIsAdmin(!!r.isAdmin); })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [amIAdminFn]);

  if (!isAdmin) return null;
  return <EditorSheet />;
}

// ─── Copy schema — every editable text field on the landing page ────────────

type CopyField = { key: string; label: string; default: string; multiline?: boolean };
type CopySection = { section: string; fields: CopyField[] };

const COPY_SCHEMA: CopySection[] = [
  {
    section: "Hero Slide 1",
    fields: [
      { key: "landing_hero_0_eyebrow", label: "Eyebrow",    default: "PERFORM ANYWHERE" },
      { key: "landing_hero_0_badge",   label: "Badge",      default: "★ Pro" },
      { key: "landing_hero_0_headline",label: "Headline",   default: "Turn a 30-Second Phone Recording Into a Cinematic Music Video." },
      { key: "landing_hero_0_sub",     label: "Body text",  default: "Stop renting studios, hiring crews, and waiting weeks for edits. Record yourself for 30 seconds on your iPhone or any device with a clear camera. Aurora transforms your performance into cinematic music videos, performances, and visuals that look like they were directed by a major production team.", multiline: true },
      { key: "landing_hero_0_cta",     label: "CTA button", default: "Perform Anywhere →" },
    ],
  },
  {
    section: "Hero Slide 2 — TikTok 30",
    fields: [
      { key: "landing_hero_1_eyebrow", label: "Eyebrow",    default: "TikTok 30" },
      { key: "landing_hero_1_headline",label: "Headline",   default: "Go Viral Without Running Out Of Content." },
      { key: "landing_hero_1_sub",     label: "Body text",  default: "Turn one idea into an entire month of scroll-stopping content. Aurora creates 30 unique TikToks, lyric videos, teasers, cover reveals, reels, and promo posts ready to publish.", multiline: true },
      { key: "landing_hero_1_cta",     label: "CTA button", default: "TikTok 30 →" },
    ],
  },
  {
    section: "Hero Slide 3 — Colors Studio",
    fields: [
      { key: "landing_hero_2_eyebrow", label: "Eyebrow",    default: "Colors Studio" },
      { key: "landing_hero_2_headline",label: "Headline",   default: "One Performance. Unlimited Visual Worlds." },
      { key: "landing_hero_2_sub",     label: "Body text",  default: "Record one 30-second performance. Aurora rebuilds it into endless cinematic stages, lighting styles, outfits, moods and color worlds ready for every release.", multiline: true },
      { key: "landing_hero_2_cta",     label: "CTA button", default: "Explore Colors Studio →" },
    ],
  },
  {
    section: "Hero Slide 4 — Press Ready",
    fields: [
      { key: "landing_hero_3_eyebrow", label: "Eyebrow",    default: "Press Ready" },
      { key: "landing_hero_3_headline",label: "Headline",   default: "Look Like The Biggest Artist In Your City." },
      { key: "landing_hero_3_sub",     label: "Body text",  default: "Create magazine-quality press photos, tour posters, album covers, and promotional visuals in minutes—not weeks.", multiline: true },
      { key: "landing_hero_3_cta",     label: "CTA button", default: "Create Press Photos →" },
    ],
  },
  {
    section: "Hero Slide 5 — AI Creative Director",
    fields: [
      { key: "landing_hero_4_eyebrow", label: "Eyebrow",    default: "AI Creative Director" },
      { key: "landing_hero_4_headline",label: "Headline",   default: "Your Entire Creative Team. Powered By AI." },
      { key: "landing_hero_4_sub",     label: "Body text",  default: "Instead of hiring a Director, Photographer, Editor, Colorist, Stylist, or Motion Designer — Aurora does it all from one dashboard.", multiline: true },
      { key: "landing_hero_4_cta",     label: "CTA button", default: "Meet Aurora →" },
    ],
  },
  {
    section: "Marquee Strip — Row 1",
    fields: [
      { key: "landing_marquee_r1_1_tag", label: "Photo 1 label", default: "Promo" },
      { key: "landing_marquee_r1_2_tag", label: "Photo 2 label", default: "Editorial" },
      { key: "landing_marquee_r1_3_tag", label: "Photo 3 label", default: "Promo" },
      { key: "landing_marquee_r1_4_tag", label: "Photo 4 label", default: "Cover art" },
    ],
  },
  {
    section: "Marquee Strip — Row 2",
    fields: [
      { key: "landing_marquee_r2_1_tag", label: "Photo 1 label", default: "Concert" },
      { key: "landing_marquee_r2_2_tag", label: "Photo 2 label", default: "Cinema" },
      { key: "landing_marquee_r2_3_tag", label: "Photo 3 label", default: "Glam" },
      { key: "landing_marquee_r2_4_tag", label: "Photo 4 label", default: "Cinema" },
      { key: "landing_marquee_r2_5_tag", label: "Photo 5 label", default: "Color" },
    ],
  },
  {
    section: "Gallery section",
    fields: [
      { key: "landing_gallery_heading", label: "Heading", default: "Real artists. Real outputs. Zero stock." },
      { key: "landing_gallery_sub",     label: "Subheading", default: "A curated feed of recent generations across covers, promo, and motion." },
    ],
  },
  {
    section: "Process section",
    fields: [
      { key: "landing_process_heading", label: "Heading", default: "Reference. Direction. Delivered." },
      { key: "landing_process_sub",     label: "Subheading", default: "Three steps between the sound in your head and the visual on your feed.", multiline: true },
    ],
  },
  {
    section: "Tools section",
    fields: [
      { key: "landing_tools_heading",    label: "Heading",    default: "The full studio." },
      { key: "landing_tools_subheading", label: "Subheading", default: "Pay only for what you make." },
      { key: "landing_tools_blurb",      label: "Blurb",      default: "Every feature is credit based. No subscriptions required to start. 5 free Aura on signup.", multiline: true },
    ],
  },
];

// ─── Main sheet ──────────────────────────────────────────────────────────────

function EditorSheet() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"images" | "text">("images");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="fixed bottom-5 left-5 z-40 inline-flex items-center gap-2 rounded-full bg-primary/90 backdrop-blur px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/30 border border-primary/40 hover:bg-primary transition"
          aria-label="Edit landing"
        >
          <Pencil className="size-4" /> Edit landing
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle>Edit landing page</SheetTitle>
        </SheetHeader>

        {/* Tabs */}
        <div className="mt-4 flex gap-1 rounded-lg bg-muted p-1 shrink-0">
          {(["images", "text"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "images" ? <Image className="size-3.5" /> : <Type className="size-3.5" />}
              {t === "images" ? "Photos" : "Text"}
            </button>
          ))}
        </div>

        {tab === "images" ? (
          <ImagesTab open={open} />
        ) : (
          <TextTab open={open} />
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Images tab (unchanged logic) ───────────────────────────────────────────

function ImagesTab({ open }: { open: boolean }) {
  const [rows, setRows] = useState<SiteImageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const getImages = useServerFn(getSiteImages);
  const resetFn = useServerFn(adminResetSiteImage);
  const bulkInput = useRef<HTMLInputElement>(null);
  const perSlotInputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function refresh() {
    setLoading(true);
    try {
      const list = await getImages();
      setRows(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) refresh(); }, [open]);

  async function bearer(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Not signed in");
    return token;
  }

  async function uploadSingle(key: string, file: File) {
    setBusyKey(key);
    try {
      const token = await bearer();
      const fd = new FormData();
      fd.append("file", file);
      fd.append("key", key);
      const res = await fetch("/api/admin/upload-site-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = (await res.json()) as { results?: { key: string; url: string; skipped?: string }[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      toast.success(`Updated ${key}`);
      window.dispatchEvent(new Event(SITE_IMAGES_REFRESH_EVENT));
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusyKey(null);
    }
  }

  async function uploadBulk(files: File[]) {
    if (!files.length) return;
    setBulkBusy(true);
    try {
      const token = await bearer();
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      const res = await fetch("/api/admin/upload-site-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = (await res.json()) as { results?: { key: string; url: string; skipped?: string }[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      const ok = (json.results ?? []).filter((r) => !r.skipped).length;
      const skipped = (json.results ?? []).filter((r) => r.skipped);
      toast.success(`Uploaded ${ok} image${ok === 1 ? "" : "s"}`);
      if (skipped.length) toast.warning(`Skipped ${skipped.length}: ${skipped.map((s) => s.key).join(", ")}`);
      window.dispatchEvent(new Event(SITE_IMAGES_REFRESH_EVENT));
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk upload failed");
    } finally {
      setBulkBusy(false);
      if (bulkInput.current) bulkInput.current.value = "";
    }
  }

  async function reset(key: string) {
    setBusyKey(key);
    try {
      await resetFn({ data: { key } });
      toast.success(`Reset ${key}`);
      window.dispatchEvent(new Event(SITE_IMAGES_REFRESH_EVENT));
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setBusyKey(null);
    }
  }

  const grouped: Record<string, SiteImageRow[]> = {};
  for (const r of rows) (grouped[r.section] ??= []).push(r);

  return (
    <div className="mt-2 flex-1 overflow-y-auto">
      <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
        <p className="text-sm font-medium">Bulk upload</p>
        <p className="text-xs text-muted-foreground mt-1">
          File names must match slot keys — e.g. <code>hero_1.jpg</code>.
        </p>
        <input
          ref={bulkInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => uploadBulk(Array.from(e.target.files ?? []))}
        />
        <Button type="button" size="sm" className="mt-3" onClick={() => bulkInput.current?.click()} disabled={bulkBusy}>
          {bulkBusy ? <Loader2 className="size-4 animate-spin" /> : <><Upload className="size-4 mr-2" /> Choose files</>}
        </Button>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        Object.entries(grouped).map(([section, list]) => (
          <section key={section} className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{section}</h3>
            <div className="grid grid-cols-2 gap-3">
              {list.map((img) => {
                const isBusy = busyKey === img.key;
                const isCustom = img.url !== img.default_url;
                return (
                  <div key={img.key} className="rounded-xl border border-border bg-card/60 overflow-hidden">
                    <div className="relative aspect-[3/4] bg-muted">
                      <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                      {isCustom && (
                        <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wide">
                          custom
                        </span>
                      )}
                    </div>
                    <div className="p-2 space-y-2">
                      <div>
                        <p className="text-xs font-medium truncate">{img.label}</p>
                        <p className="text-[10px] text-muted-foreground">{img.key}</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        ref={(el) => { perSlotInputs.current[img.key] = el; }}
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadSingle(img.key, f);
                          e.target.value = "";
                        }}
                      />
                      <div className="flex gap-1.5">
                        <Button
                          type="button" size="sm" variant="secondary"
                          className="flex-1 h-7 text-[11px]"
                          disabled={isBusy}
                          onClick={() => perSlotInputs.current[img.key]?.click()}
                        >
                          {isBusy ? <Loader2 className="size-3 animate-spin" /> : "Replace"}
                        </Button>
                        {isCustom && (
                          <Button
                            type="button" size="sm" variant="ghost"
                            className="h-7 px-2" disabled={isBusy}
                            onClick={() => reset(img.key)} title="Reset to default"
                          >
                            <RotateCcw className="size-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

// ─── Text tab ────────────────────────────────────────────────────────────────

function TextTab({ open }: { open: boolean }) {
  const [copyRows, setCopyRows] = useState<SiteCopyRow[]>([]);
  const [loading, setLoading] = useState(false);
  // drafts: key → current input value
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const getCopyFn = useServerFn(getSiteCopy);
  const saveFn = useServerFn(adminSetSiteCopy);
  const deleteFn = useServerFn(adminDeleteSiteCopy);

  async function loadCopy() {
    setLoading(true);
    try {
      const rows = await getCopyFn();
      setCopyRows(rows);
      // Initialise drafts: override value if set, otherwise hardcoded default
      const initial: Record<string, string> = {};
      for (const sec of COPY_SCHEMA) {
        for (const f of sec.fields) {
          const override = rows.find((r) => r.key === f.key);
          initial[f.key] = override?.value ?? f.default;
        }
      }
      setDrafts(initial);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load copy");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) loadCopy(); }, [open]);

  function isOverridden(key: string) {
    return copyRows.some((r) => r.key === key);
  }

  async function save(key: string, value: string) {
    setBusyKey(key);
    try {
      await saveFn({ data: { key, value } });
      setCopyRows((prev) => {
        const next = prev.filter((r) => r.key !== key);
        next.push({ key, value, updated_at: new Date().toISOString() });
        return next;
      });
      window.dispatchEvent(new Event(SITE_COPY_REFRESH_EVENT));
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusyKey(null);
    }
  }

  async function reset(key: string, defaultValue: string) {
    setBusyKey(key);
    try {
      await deleteFn({ data: { key } });
      setCopyRows((prev) => prev.filter((r) => r.key !== key));
      setDrafts((prev) => ({ ...prev, [key]: defaultValue }));
      window.dispatchEvent(new Event(SITE_COPY_REFRESH_EVENT));
      toast.success("Reset to default");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reset");
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return (
      <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="mt-2 flex-1 overflow-y-auto space-y-6 pb-6">
      <p className="text-xs text-muted-foreground">
        You can also hover any text on the landing page and click the{" "}
        <Pencil className="size-3 inline-block" /> pencil icon to edit it inline.
      </p>

      {COPY_SCHEMA.map(({ section, fields }) => (
        <div key={section}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 pb-1.5 border-b border-border">
            {section}
          </h3>
          <div className="space-y-4">
            {fields.map((field) => {
              const isBusy = busyKey === field.key;
              const overridden = isOverridden(field.key);
              const draft = drafts[field.key] ?? field.default;
              const isDirty = draft !== (copyRows.find(r => r.key === field.key)?.value ?? field.default);

              return (
                <div key={field.key}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <label className="text-xs font-medium text-foreground">{field.label}</label>
                    {overridden && (
                      <span className="inline-flex items-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                        custom
                      </span>
                    )}
                  </div>
                  {field.multiline ? (
                    <textarea
                      value={draft}
                      rows={3}
                      onChange={(e) => setDrafts((p) => ({ ...p, [field.key]: e.target.value }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  ) : (
                    <input
                      type="text"
                      value={draft}
                      onChange={(e) => setDrafts((p) => ({ ...p, [field.key]: e.target.value }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  )}
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Button
                      type="button" size="sm"
                      className="h-7 px-3 text-xs"
                      disabled={isBusy || !isDirty}
                      onClick={() => save(field.key, draft)}
                    >
                      {isBusy && busyKey === field.key ? <Loader2 className="size-3 animate-spin" /> : "Save"}
                    </Button>
                    {overridden && (
                      <Button
                        type="button" size="sm" variant="ghost"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        disabled={isBusy}
                        onClick={() => reset(field.key, field.default)}
                        title="Reset to default"
                      >
                        <RotateCcw className="size-3 mr-1" /> Reset
                      </Button>
                    )}
                    {overridden && (
                      <p className="text-[10px] text-muted-foreground ml-auto truncate max-w-[160px]">
                        Default: {field.default}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
