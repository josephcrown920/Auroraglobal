/**
 * EditableCopy
 *
 * Renders a piece of site copy for all users. Admins additionally see a small
 * pencil icon on hover that opens an inline popover for editing the text.
 *
 * Usage:
 *   <EditableCopy copyKey="landing_hero_0_headline" fallback="Film Yourself. Aurora Builds the World." />
 *
 * The rendered element is a plain <span> so it can be nested inside any block
 * element (h1, h2, p, etc.) without changing the DOM structure.
 */

import { useState, type ElementType } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Loader2, RotateCcw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSiteCopy, SITE_COPY_REFRESH_EVENT } from "@/components/landing/SiteCopyProvider";
import { adminSetSiteCopy, adminDeleteSiteCopy } from "@/lib/site-copy.functions";

interface EditableCopyProps {
  copyKey: string;
  fallback: string;
  /** Extra class names applied to the outer wrapper span. */
  className?: string;
  /** Override the wrapper element type. Defaults to "span". */
  as?: ElementType;
}

export function EditableCopy({ copyKey, fallback, className, as: Tag = "span" }: EditableCopyProps) {
  const { copy, isAdmin, updateLocalCopy, deleteLocalCopy } = useSiteCopy();
  const value = copy[copyKey] ?? fallback;
  const hasOverride = copyKey in copy;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const setFn = useServerFn(adminSetSiteCopy);
  const deleteFn = useServerFn(adminDeleteSiteCopy);

  function openPopover() {
    setDraft(copy[copyKey] ?? fallback);
    setOpen(true);
  }

  async function handleSave() {
    if (draft.trim() === fallback && !hasOverride) { setOpen(false); return; }
    setSaving(true);
    try {
      await setFn({ data: { key: copyKey, value: draft } });
      updateLocalCopy(copyKey, draft);
      window.dispatchEvent(new Event(SITE_COPY_REFRESH_EVENT));
      toast.success("Copy updated");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      await deleteFn({ data: { key: copyKey } });
      deleteLocalCopy(copyKey);
      window.dispatchEvent(new Event(SITE_COPY_REFRESH_EVENT));
      toast.success("Reset to default");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reset");
    } finally {
      setResetting(false);
    }
  }

  // Non-admin: plain text, no overhead
  if (!isAdmin) {
    return <Tag className={className}>{value}</Tag>;
  }

  return (
    <Tag className={cn("group relative inline-flex items-baseline gap-0.5", className)}>
      <span>{value}</span>
      {hasOverride && (
        <span
          title="Custom copy active"
          className="opacity-0 group-hover:opacity-100 transition-opacity inline-block size-1.5 rounded-full bg-primary self-center mx-0.5 flex-shrink-0"
        />
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Edit copy: ${copyKey}`}
            onClick={openPopover}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity inline-flex items-center justify-center size-5 rounded bg-primary/15 hover:bg-primary/35 text-primary flex-shrink-0 self-center"
          >
            <Pencil className="size-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-80 space-y-3 p-4"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div>
            <p className="text-xs font-medium text-foreground">Edit copy</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{copyKey}</p>
          </div>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="text-sm resize-none"
            autoFocus
          />
          {hasOverride && (
            <div className="rounded-md bg-muted/50 px-2.5 py-1.5">
              <p className="text-[10px] text-muted-foreground">
                <span className="font-medium text-foreground/70">Default: </span>
                {fallback}
              </p>
            </div>
          )}
          <div className="flex items-center gap-2">
            {hasOverride && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleReset}
                disabled={resetting || saving}
                title="Reset to hardcoded default"
              >
                {resetting ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3 mr-1" />}
                Reset
              </Button>
            )}
            <div className="flex-1" />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setOpen(false)}
              disabled={saving || resetting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={handleSave}
              disabled={saving || resetting}
            >
              {saving ? <Loader2 className="size-3 animate-spin" /> : "Save"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </Tag>
  );
}
