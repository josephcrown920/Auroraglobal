import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { amIAdmin } from "@/lib/admin.functions";
import { getSiteImages, adminResetSiteImage, type SiteImageRow } from "@/lib/site-images.functions";
import { SITE_IMAGES_REFRESH_EVENT } from "@/components/landing/SiteImagesProvider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Pencil, Upload, RotateCcw } from "lucide-react";

/**
 * Floating "Edit landing" pill visible only to signed-in admins on the
 * landing page. Opens a Sheet listing every editable image slot with:
 *  • per-slot Replace (single file → the row's key)
 *  • Reset-to-default
 *  • Bulk drop zone that matches each file's basename to a known slot
 *    (e.g. hero_1.jpg → hero_1)
 *
 * Uses the Supabase bearer token; every server call re-checks the admin
 * role, so the button is UI convenience, not the security boundary.
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

function EditorSheet() {
  const [open, setOpen] = useState(false);
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

  useEffect(() => { if (open) refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);

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
      const res = await fetch("/api/admin/upload-image", {
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
      const res = await fetch("/api/admin/upload-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = (await res.json()) as { results?: { key: string; url: string; skipped?: string }[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      const ok = (json.results ?? []).filter((r) => !r.skipped).length;
      const skipped = (json.results ?? []).filter((r) => r.skipped);
      toast.success(`Uploaded ${ok} image${ok === 1 ? "" : "s"}`);
      if (skipped.length) {
        toast.warning(`Skipped ${skipped.length}: ${skipped.map((s) => s.key).join(", ")}`);
      }
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="fixed bottom-5 left-5 z-40 inline-flex items-center gap-2 rounded-full bg-primary/90 backdrop-blur px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/30 border border-primary/40 hover:bg-primary transition"
          aria-label="Edit landing images"
        >
          <Pencil className="size-4" /> Edit landing
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Landing images</SheetTitle>
        </SheetHeader>

        <div className="mt-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-medium">Bulk upload</p>
          <p className="text-xs text-muted-foreground mt-1">
            Drop multiple images. File names must match slot keys — e.g. <code>hero_1.jpg</code>, <code>creator_3.png</code>.
          </p>
          <input
            ref={bulkInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => uploadBulk(Array.from(e.target.files ?? []))}
          />
          <Button
            type="button"
            size="sm"
            className="mt-3"
            onClick={() => bulkInput.current?.click()}
            disabled={bulkBusy}
          >
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
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="flex-1 h-7 text-[11px]"
                            disabled={isBusy}
                            onClick={() => perSlotInputs.current[img.key]?.click()}
                          >
                            {isBusy ? <Loader2 className="size-3 animate-spin" /> : "Replace"}
                          </Button>
                          {isCustom && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              disabled={isBusy}
                              onClick={() => reset(img.key)}
                              title="Reset to default"
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
      </SheetContent>
    </Sheet>
  );
}
