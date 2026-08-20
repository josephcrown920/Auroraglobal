import { useState, type ReactElement } from "react";
import { toast } from "sonner";
import { Share2, Link as LinkIcon, Download, Loader2, ChevronDown, Megaphone } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { saveAssetToDisk } from "@/lib/save";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABEL,
  hasWebIntent,
  nativeShareSupported,
  openWebIntent,
  shareNative,
  type ShareTarget,
  type SocialPlatform,
} from "@/lib/social-share";
import { InstagramIcon, TikTokIcon, SnapchatIcon, WhatsAppIcon, FacebookIcon, XIcon } from "./social-icons";

const PLATFORM_ICON: Record<SocialPlatform, (props: { className?: string }) => ReactElement> = {
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  snapchat: SnapchatIcon,
  whatsapp: WhatsAppIcon,
  facebook: FacebookIcon,
  x: XIcon,
};

export interface ShareMenuProps {
  /** Resolve (and publish, if needed) the public share link + text. Called lazily on first use. */
  getShareTarget: () => Promise<ShareTarget> | ShareTarget;
  className?: string;
  triggerClassName?: string;
  label?: string;
  /** Icon-only trigger that just opens the platform dropdown (no split "quick share" button). */
  compact?: boolean;
  /** Optional destination for turning this asset into an ad creative. */
  adsHref?: string;
}

/**
 * Reusable "share this generation" control: tries the OS share sheet first
 * (lets a phone user pick Instagram/TikTok/Snapchat/WhatsApp/etc directly with
 * the media attached), and always offers a dropdown with direct web share
 * links (WhatsApp / Facebook / X), copy-link, and download for the platforms
 * that don't support external web posting (Instagram / TikTok / Snapchat).
 */
export function ShareMenu({ getShareTarget, className, triggerClassName, label = "Share", compact = false, adsHref }: ShareMenuProps) {
  const [busy, setBusy] = useState<string | null>(null);

  const resolve = async () => {
    const target = await getShareTarget();
    return target;
  };

  const handlePrimaryShare = async () => {
    setBusy("native");
    try {
      const target = await resolve();
      if (nativeShareSupported()) {
        const ok = await shareNative(target);
        if (ok) return;
      }
      // No native share sheet (desktop) — copy the link as the sensible default.
      await navigator.clipboard.writeText(target.url);
      toast.success("Share link copied to clipboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't share");
    } finally {
      setBusy(null);
    }
  };

  const handlePlatform = async (platform: SocialPlatform) => {
    setBusy(platform);
    try {
      const target = await resolve();
      if (hasWebIntent(platform)) {
        openWebIntent(platform, target);
        return;
      }
      // Instagram / TikTok / Snapchat: no web posting intent exists. Try the
      // native share sheet (works if the app is installed on a phone); if
      // that's unavailable, download the asset so it can be attached by hand.
      if (nativeShareSupported()) {
        const ok = await shareNative(target);
        if (ok) return;
      }
      if (target.assetUrl) {
        await saveAssetToDisk(target.assetUrl, target.filename);
        toast.info(`${SOCIAL_PLATFORM_LABEL[platform]} doesn't support sharing from a website — downloaded the file, upload it in the app.`);
      } else {
        toast.info(`${SOCIAL_PLATFORM_LABEL[platform]} doesn't support sharing from a website. Open the app and upload it manually.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't share");
    } finally {
      setBusy(null);
    }
  };

  const handleCopyLink = async () => {
    setBusy("copy");
    try {
      const target = await resolve();
      await navigator.clipboard.writeText(target.url);
      toast.success("Link copied to clipboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't copy link");
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async () => {
    setBusy("download");
    try {
      const target = await resolve();
      if (!target.assetUrl) throw new Error("Nothing to download yet");
      await saveAssetToDisk(target.assetUrl, target.filename);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={className}>
      <DropdownMenu>
        {compact ? (
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={busy !== null}
              aria-label="Share"
              title="Share"
              className={triggerClassName ?? "size-8 rounded-full bg-background/70 backdrop-blur-md border border-border hover:bg-background flex items-center justify-center disabled:opacity-50"}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Share2 className="size-3.5" />}
            </button>
          </DropdownMenuTrigger>
        ) : (
          <div className="inline-flex">
            <button
              type="button"
              onClick={handlePrimaryShare}
              disabled={busy !== null}
              className={
                triggerClassName ??
                "inline-flex items-center gap-2 pl-4 pr-2 py-2 rounded-l-full bg-background/90 backdrop-blur text-sm font-medium hover:bg-background disabled:opacity-50"
              }
            >
              {busy === "native" ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />} {label}
            </button>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={busy !== null}
                aria-label="More share options"
                className="inline-flex items-center px-2 py-2 rounded-r-full border-l border-border/40 bg-background/90 backdrop-blur hover:bg-background disabled:opacity-50"
              >
                <ChevronDown className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
          </div>
        )}
        <DropdownMenuContent align="end" className="w-52">
          {SOCIAL_PLATFORMS.map((platform) => {
            const Icon = PLATFORM_ICON[platform];
            return (
              <DropdownMenuItem key={platform} onSelect={(e) => { e.preventDefault(); handlePlatform(platform); }}>
                {busy === platform ? <Loader2 className="animate-spin" /> : <Icon />}
                {SOCIAL_PLATFORM_LABEL[platform]}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          {adsHref ? (
            <DropdownMenuItem asChild>
              <a href={adsHref}>
                <Megaphone />
                Build an ad creative
              </a>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleCopyLink(); }}>
            {busy === "copy" ? <Loader2 className="animate-spin" /> : <LinkIcon />}
            Copy link
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleDownload(); }}>
            {busy === "download" ? <Loader2 className="animate-spin" /> : <Download />}
            Download
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
