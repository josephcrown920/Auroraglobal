import { useEffect, useState } from "react";
import { Eye, RefreshCw, X, ExternalLink } from "lucide-react";

/**
 * Floating live preview of the landing page for admin editing screens
 * (Site Images / Site Copy). Opens a bottom drawer with the real landing
 * in an iframe and auto-reloads it whenever `version` changes (bump it
 * after every successful save), so the operator sees exactly what
 * visitors see — without leaving the editor.
 */
export function LandingLivePreview({ version }: { version: number }) {
  const [open, setOpen] = useState(false);
  const [bust, setBust] = useState(0);

  // Reload the iframe when a change lands while the drawer is open.
  useEffect(() => {
    if (open) setBust((b) => b + 1);
  }, [version, open]);

  return (
    <>
      {/* Floating toggle */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:scale-[1.03]"
        >
          <Eye className="size-4" /> Preview
        </button>
      )}

      {/* Drawer */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex h-[78vh] flex-col rounded-t-2xl border border-border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Eye className="size-4 text-primary" />
              Live preview
              <span className="text-[10px] font-normal text-muted-foreground">
                — this is the real landing page; it refreshes after every save
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBust((b) => b + 1)}
                title="Refresh preview"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              >
                <RefreshCw className="size-4" />
              </button>
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                title="Open landing in a new tab"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              >
                <ExternalLink className="size-4" />
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Close preview"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
          <iframe
            key={`${version}-${bust}`}
            src="/?admin_preview=1"
            title="Landing page live preview"
            className="h-full w-full flex-1 bg-black"
          />
        </div>
      )}
    </>
  );
}
