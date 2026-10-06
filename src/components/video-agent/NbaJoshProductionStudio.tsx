/**
 * NbaJoshProductionStudio
 *
 * Media-first production studio for the NBA Josh "Looping Officers" workflow.
 * Visual references appear above all text. Outfit cards are image-dominant.
 * Server callbacks are wired directly; no invented routes.
 */
import React, { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Music,
  Upload,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

import {
  nbaJoshPlanHash,
  NBA_JOSH_SCENE_PRESETS,
  type NbaJoshOutfit,
  type NbaJoshProduction,
} from "@/lib/nba-josh-production";
import {
  approveNbaJoshMotion,
  approveNbaJoshStill,
  generateNbaJoshMotionPreview,
  generateNbaJoshStills,
  generateNbaJoshVideo,
  selectNbaJoshStill,
  updateVideoAgentProject,
  type VideoAgentProjectDto,
} from "@/lib/video-agent-projects.functions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  project: VideoAgentProjectDto;
  production: NbaJoshProduction;
  /** Called after any mutation that returns a fresh project. */
  onProjectUpdated: (project: VideoAgentProjectDto) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(
  stillStatus: NbaJoshOutfit["stillStatus"],
  videoStatus: NbaJoshOutfit["videoStatus"],
): string {
  if (videoStatus === "succeeded") return "Layer A ready";
  if (videoStatus === "processing") return "Rendering final clip";
  if (videoStatus === "preview_succeeded") return "Preview ready — accept to render";
  if (videoStatus === "preview_queued") return "Generating motion preview";
  if (videoStatus === "awaiting_motion_approval") return "Awaiting motion approval";
  if (stillStatus === "succeeded") return "Stills ready — select one";
  if (stillStatus === "processing") return "Generating stills";
  if (stillStatus === "queued") return "Stills queued";
  if (stillStatus === "awaiting_approval") return "Pending still approval";
  if (stillStatus === "failed") return "Generation failed";
  return "Idle";
}

function StatusBadge({ outfit }: { outfit: NbaJoshOutfit }) {
  const { stillStatus, videoStatus } = outfit;
  const isError = stillStatus === "failed" || videoStatus === "failed";
  const isSuccess = videoStatus === "succeeded";
  const isActive =
    stillStatus === "processing" ||
    stillStatus === "queued" ||
    videoStatus === "processing" ||
    videoStatus === "preview_queued";

  return (
    <Badge
      variant={isError ? "destructive" : isSuccess ? "default" : "secondary"}
      className={cn(
        "text-[10px] uppercase tracking-wider font-semibold",
        isActive && "animate-pulse",
        isSuccess && "bg-primary/20 text-primary border-primary/30",
      )}
      aria-label={`Outfit status: ${statusLabel(stillStatus, videoStatus)}`}
    >
      {isActive && <Loader2 className="size-3 animate-spin mr-1" aria-hidden />}
      {isSuccess && <CheckCircle2 className="size-3 mr-1" aria-hidden />}
      {isError && <AlertCircle className="size-3 mr-1" aria-hidden />}
      {statusLabel(stillStatus, videoStatus)}
    </Badge>
  );
}

// ─── Layer B missing state ─────────────────────────────────────────────────────

function LayerBMissingCard({
  layerB,
  onUpload,
  uploading,
}: {
  layerB: NbaJoshProduction["layers"][1];
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isMissing = layerB.status === "missing";

  return (
    <section
      aria-label="Layer B — Officers background clip"
      className="rounded-xl border border-dashed border-border bg-card/40 overflow-hidden"
    >
      {/* Reference image above all text */}
      <div className="relative w-full aspect-video bg-muted">
        <img
          src={layerB.asset.previewUrl}
          alt="Officers background clip reference"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {isMissing && (
          <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-black/30 to-transparent">
            <div className="p-4 flex items-center gap-2">
              <AlertCircle className="size-4 text-destructive shrink-0" aria-hidden />
              <span className="text-xs font-semibold text-white">
                Upload required — supplied officers clip missing
              </span>
            </div>
          </div>
        )}
        {!isMissing && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] uppercase tracking-wider">
              <CheckCircle2 className="size-3 mr-1" aria-hidden /> Ready
            </Badge>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Layer B · Background
          </p>
          <p className="text-sm font-semibold mt-0.5">{layerB.asset.label}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {layerB.durationSeconds}-second officers clip — looped cleanly behind the foreground performance.
            Upload your supplied media to unlock delivery.
          </p>
        </div>

        {isMissing && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              className="sr-only"
              aria-label="Upload officers background clip"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
                e.target.value = "";
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-2 w-full"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              aria-label="Upload officers background clip video file"
            >
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-3.5" aria-hidden />
              )}
              {uploading ? "Uploading…" : "Upload officers clip"}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

// ─── Still grid ───────────────────────────────────────────────────────────────

function GeneratedStillsGrid({
  outfit,
  planHash,
  projectId,
  onDone,
  disabled,
}: {
  outfit: NbaJoshOutfit;
  planHash: string;
  projectId: string;
  onDone: (project: VideoAgentProjectDto) => void;
  disabled: boolean;
}) {
  const selectStill = useServerFn(selectNbaJoshStill);
  const [selecting, setSelecting] = useState<string | null>(null);

  if (!outfit.stillUrls.length) return null;

  async function handleSelect(url: string) {
    if (disabled || selecting) return;
    setSelecting(url);
    try {
      await selectStill({
        data: {
          projectId,
          outfitId: outfit.id,
          planHash,
          stillUrl: url,
        },
      });
      toast.success("Still selected — review the motion plan below");
      // Parent will refetch; trigger via onDone with a lightweight notification
      onDone({ id: projectId } as VideoAgentProjectDto);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSelecting(null);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
        Generated stills — select one to continue
      </p>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${outfit.stillUrls.length}, minmax(0,1fr))` }}
        role="radiogroup"
        aria-label="Generated stills"
      >
        {outfit.stillUrls.map((url) => {
          const isSelected = outfit.selectedStillUrl === url;
          const isLoading = selecting === url;
          return (
            <button
              key={url}
              onClick={() => handleSelect(url)}
              disabled={disabled || !!selecting}
              aria-pressed={isSelected}
              aria-label={isSelected ? "Selected still" : "Select this still"}
              className={cn(
                "relative rounded-lg overflow-hidden aspect-video border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "border-primary shadow-[0_0_18px_-4px_var(--color-primary)]"
                  : "border-border/40 hover:border-primary/50",
                disabled && "opacity-60 cursor-not-allowed",
              )}
            >
              <img
                src={url}
                alt={isSelected ? "Selected still" : "Generated still"}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 className="size-5 animate-spin text-white" aria-hidden />
                </div>
              )}
              {isSelected && !isLoading && (
                <div className="absolute top-1.5 right-1.5">
                  <span className="flex items-center justify-center size-5 rounded-full bg-primary shadow">
                    <CheckCircle2 className="size-3.5 text-primary-foreground" aria-hidden />
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Motion preview player ────────────────────────────────────────────────────

function MotionPreviewPlayer({
  videoUrl,
  outfit,
  planHash,
  projectId,
  onDone,
  disabled,
}: {
  videoUrl: string;
  outfit: NbaJoshOutfit;
  planHash: string;
  projectId: string;
  onDone: (project: VideoAgentProjectDto) => void;
  disabled: boolean;
}) {
  const generateVideo = useServerFn(generateNbaJoshVideo);
  const [rendering, setRendering] = useState(false);

  const isPreview = outfit.videoStatus === "preview_succeeded";
  const isFinal = outfit.videoStatus === "succeeded";

  async function handleAcceptAndRender() {
    if (disabled || rendering || !isPreview) return;
    setRendering(true);
    try {
      await generateVideo({
        data: {
          projectId,
          outfitId: outfit.id,
          planHash,
          previewAccepted: true,
        },
      });
      toast.success(`Layer A rendering for ${outfit.name} — ${outfit.quote.video} Aura`);
      onDone({ id: projectId } as VideoAgentProjectDto);
    } catch (err) {
      const msg = (err as Error).message;
      toast.error(msg);
    } finally {
      setRendering(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
        {isFinal ? "Layer A — final clip" : "Motion preview"}
      </p>
      <div className="rounded-lg overflow-hidden bg-black aspect-video relative">
        <video
          src={videoUrl}
          controls
          playsInline
          preload="metadata"
          className="w-full h-full"
          aria-label={isFinal ? `Final Layer A clip for ${outfit.name}` : `Motion preview for ${outfit.name}`}
        />
        {isFinal && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] uppercase tracking-wider">
              <CheckCircle2 className="size-3 mr-1" aria-hidden /> Layer A Ready
            </Badge>
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Actually served: <span className="font-mono text-foreground">{outfit.videoServingModel ?? "Provider result pending"}</span>
      </p>
      {isPreview && (
        <Button
          size="sm"
          className="w-full gap-2"
          onClick={handleAcceptAndRender}
          disabled={disabled || rendering}
          aria-label={`Accept preview and render final Layer A for ${outfit.name} — ${outfit.quote.video} Aura`}
        >
          {rendering ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Video className="size-3.5" aria-hidden />
          )}
          {rendering
            ? "Rendering Layer A…"
            : `Accept preview — render final · ${outfit.quote.video} Aura`}
        </Button>
      )}
    </div>
  );
}

// ─── Outfit card ──────────────────────────────────────────────────────────────

function OutfitCard({
  outfit,
  index,
  production,
  project,
  onProjectUpdated,
}: {
  outfit: NbaJoshOutfit;
  index: number;
  production: NbaJoshProduction;
  project: VideoAgentProjectDto;
  onProjectUpdated: (p: VideoAgentProjectDto) => void;
}) {
  const queryClient = useQueryClient();
  const approveStill = useServerFn(approveNbaJoshStill);
  const generateStills = useServerFn(generateNbaJoshStills);
  const approveMotion = useServerFn(approveNbaJoshMotion);
  const generatePreview = useServerFn(generateNbaJoshMotionPreview);
  const updateProject = useServerFn(updateVideoAgentProject);

  const [expanded, setExpanded] = useState(index === 0);
  const [approving, setApproving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [approvingMotion, setApprovingMotion] = useState(false);
  const [generatingPreview, setGeneratingPreview] = useState(false);

  const planHash = nbaJoshPlanHash(production);
  const queryKey = ["video-agent-project", project.id];

  const isLocked =
    project.status === "queued" || project.status === "processing";

  async function refetchProject() {
    await queryClient.invalidateQueries({ queryKey });
  }

  // Notify parent and refetch
  const handleDone = useCallback(
    async (_partial: VideoAgentProjectDto) => {
      await refetchProject();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.id],
  );

  async function handleApproveStill() {
    if (approving || isLocked) return;
    setApproving(true);
    try {
      await approveStill({
        data: {
          projectId: project.id,
          outfitId: outfit.id,
          planHash,
          creatorAttested: true,
        },
      });
      toast.success(`${outfit.name} still approved`);
      await refetchProject();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setApproving(false);
    }
  }

  async function handleGenerateStills() {
    if (generating || isLocked) return;
    setGenerating(true);
    try {
      const res = await generateStills({
        data: { projectId: project.id, outfitId: outfit.id, planHash },
      });
      toast.success(
        `${outfit.name} stills generated${res.failedVariations ? ` (${res.failedVariations} variation failed)` : ""}`,
      );
      await refetchProject();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleApproveMotion() {
    if (approvingMotion || isLocked || !outfit.selectedStillUrl) return;
    setApprovingMotion(true);
    try {
      await approveMotion({
        data: {
          projectId: project.id,
          outfitId: outfit.id,
          planHash,
          stillUrl: outfit.selectedStillUrl,
        },
      });
      toast.success(`${outfit.name} motion approved`);
      await refetchProject();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setApprovingMotion(false);
    }
  }

  async function handleGeneratePreview() {
    if (generatingPreview || isLocked) return;
    setGeneratingPreview(true);
    try {
      await generatePreview({
        data: { projectId: project.id, outfitId: outfit.id, planHash },
      });
      toast.success(`${outfit.name} motion preview ready`);
      await refetchProject();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGeneratingPreview(false);
    }
  }

  const wardrobeRef = outfit.refs.find((r) => r.role === "wardrobe");
  const outfitPreview = wardrobeRef?.previewUrl;

  const canApproveStill =
    outfit.stillStatus === "awaiting_approval" && !outfit.approvals.still.approved;
  const canGenerateStills =
    outfit.approvals.still.approved &&
    outfit.approvals.still.planHash === planHash &&
    (outfit.stillStatus === "queued" || outfit.stillStatus === "awaiting_approval");
  const hasStills = outfit.stillUrls.length > 0 && outfit.stillStatus === "succeeded";
  const canApproveMotion =
    hasStills &&
    !!outfit.selectedStillUrl &&
    outfit.videoStatus === "awaiting_motion_approval" &&
    !outfit.approvals.motion.approved;
  const canGeneratePreview =
    outfit.approvals.motion.approved &&
    outfit.approvals.motion.planHash === planHash &&
    (outfit.videoStatus === "preview_queued" || outfit.videoStatus === "awaiting_motion_approval");
  const hasPreview =
    outfit.videoStatus === "preview_succeeded" && !!outfit.videoUrl;
  const hasFinalVideo = outfit.videoStatus === "succeeded" && !!outfit.videoUrl;

  const anyBusy = approving || generating || approvingMotion || generatingPreview;

  return (
    <article
      className="rounded-xl border border-border bg-card overflow-hidden"
      aria-label={`Outfit ${index + 1}: ${outfit.name}`}
    >
      {/* Wardrobe reference image — always shown above text */}
      <div className="relative w-full aspect-video bg-muted">
        {outfitPreview ? (
          <img
            src={outfitPreview}
            alt={`${outfit.name} wardrobe reference`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Video className="size-8 opacity-20" aria-hidden />
          </div>
        )}
        {/* Violet gradient overlay */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none"
          aria-hidden
        />
        {/* Quote chips at bottom of image */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60 mb-1">
              Outfit {index + 1}
            </p>
            <h3 className="text-base font-bold text-white leading-tight">{outfit.name}</h3>
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusBadge outfit={outfit} />
          </div>
        </div>
        {/* Violet glow border on selected/active */}
        {(outfit.videoStatus === "succeeded" || outfit.approvals.still.approved) && (
          <div
            className="absolute inset-0 rounded-xl ring-1 ring-primary/40 pointer-events-none"
            aria-hidden
          />
        )}
      </div>

      {/* Card body */}
      <div className="p-4 space-y-4">
        {/* Cost summary row */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>
            Stills&nbsp;
            <span className="text-foreground font-semibold">{outfit.quote.stills} Aura</span>
          </span>
          <span>
            Preview&nbsp;
            <span className="text-foreground font-semibold">{outfit.quote.preview} Aura</span>
          </span>
          <span>
            Final clip&nbsp;
            <span className="text-foreground font-semibold">{outfit.quote.video} Aura</span>
          </span>
        </div>

        {/* Expand / collapse for prompt detail */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          aria-expanded={expanded}
          aria-controls={`outfit-detail-${outfit.id}`}
        >
          {expanded ? (
            <ChevronUp className="size-3.5" aria-hidden />
          ) : (
            <ChevronDown className="size-3.5" aria-hidden />
          )}
          {expanded ? "Collapse production detail" : "Show production detail"}
        </button>

        {expanded && (
          <div id={`outfit-detail-${outfit.id}`} className="space-y-3">
            {/* Prompt */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                Generation prompt
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                {outfit.prompt}
              </p>
            </div>

            {/* Model info */}
            <div className="flex flex-wrap gap-4 text-[11px]">
              <span className="text-muted-foreground">
                Still model&nbsp;
                <span className="text-foreground font-mono">{outfit.stillModel}</span>
              </span>
              <span className="text-muted-foreground">
                Video model&nbsp;
                <span className="text-foreground font-mono">{outfit.videoModel}</span>
              </span>
              {outfit.stillServingModels.length > 0 && (
                <span className="text-muted-foreground">
                  Stills served by&nbsp;
                  <span className="text-foreground font-mono">{Array.from(new Set(outfit.stillServingModels)).join(", ")}</span>
                </span>
              )}
              {outfit.videoServingModel && (
                <span className="text-muted-foreground">
                  Video served by&nbsp;
                  <span className="text-foreground font-mono">{outfit.videoServingModel}</span>
                </span>
              )}
            </div>

            {/* Approvals */}
            <div className="flex gap-3 text-[11px]">
              <span
                className={cn(
                  "flex items-center gap-1",
                  outfit.approvals.still.approved ? "text-primary" : "text-muted-foreground",
                )}
              >
                {outfit.approvals.still.approved ? (
                  <CheckCircle2 className="size-3" aria-hidden />
                ) : (
                  <div className="size-3 rounded-full border border-muted-foreground" aria-hidden />
                )}
                Still approved
              </span>
              <span
                className={cn(
                  "flex items-center gap-1",
                  outfit.approvals.motion.approved ? "text-primary" : "text-muted-foreground",
                )}
              >
                {outfit.approvals.motion.approved ? (
                  <CheckCircle2 className="size-3" aria-hidden />
                ) : (
                  <div className="size-3 rounded-full border border-muted-foreground" aria-hidden />
                )}
                Motion approved
              </span>
            </div>
          </div>
        )}

        <Separator />

        {/* Error display */}
        {(outfit.stillError || outfit.videoError) && (
          <div
            className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive"
            role="alert"
          >
            <AlertCircle className="size-3.5 shrink-0 mt-0.5" aria-hidden />
            <span>{outfit.stillError ?? outfit.videoError}</span>
          </div>
        )}

        {/* Generated stills grid */}
        {hasStills && (
          <GeneratedStillsGrid
            outfit={outfit}
            planHash={planHash}
            projectId={project.id}
            onDone={handleDone}
            disabled={isLocked || anyBusy}
          />
        )}

        {/* Motion preview / final video */}
        {(hasPreview || hasFinalVideo) && outfit.videoUrl && (
          <MotionPreviewPlayer
            videoUrl={outfit.videoUrl}
            outfit={outfit}
            planHash={planHash}
            projectId={project.id}
            onDone={handleDone}
            disabled={isLocked || anyBusy}
          />
        )}

        {/* Action buttons — sequential workflow */}
        <div className="space-y-2">
          {/* Step 1: Approve still plan */}
          {canApproveStill && (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10"
              onClick={handleApproveStill}
              disabled={approving || isLocked}
              aria-label={`Approve still generation plan for ${outfit.name}`}
            >
              {approving ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="size-3.5" aria-hidden />
              )}
              {approving ? "Approving…" : `Approve still plan · ${outfit.quote.stills} Aura`}
            </Button>
          )}

          {/* Step 2: Generate stills */}
          {canGenerateStills && outfit.stillStatus !== "processing" && (
            <Button
              size="sm"
              className="w-full gap-2"
              onClick={handleGenerateStills}
              disabled={generating || isLocked}
              aria-label={`Generate stills for ${outfit.name}`}
            >
              {generating ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Video className="size-3.5" aria-hidden />
              )}
              {generating ? "Generating stills…" : "Generate stills"}
            </Button>
          )}

          {/* Step 3: Approve motion */}
          {canApproveMotion && (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10"
              onClick={handleApproveMotion}
              disabled={approvingMotion || isLocked}
              aria-label={`Approve motion plan for ${outfit.name}`}
            >
              {approvingMotion ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="size-3.5" aria-hidden />
              )}
              {approvingMotion
                ? "Approving motion…"
                : `Approve motion · ${outfit.quote.preview} Aura`}
            </Button>
          )}

          {/* Step 4: Generate motion preview */}
          {canGeneratePreview && outfit.videoStatus !== "preview_queued" && outfit.videoStatus !== "processing" && (
            <Button
              size="sm"
              className="w-full gap-2"
              onClick={handleGeneratePreview}
              disabled={generatingPreview || isLocked}
              aria-label={`Generate 5-second motion preview for ${outfit.name}`}
            >
              {generatingPreview ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Video className="size-3.5" aria-hidden />
              )}
              {generatingPreview ? "Generating preview…" : "Generate motion preview"}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Identity refs strip ───────────────────────────────────────────────────────

function IdentityRefsStrip({ refs }: { refs: NbaJoshProduction["identityRefs"] }) {
  return (
    <section aria-label="Identity and tattoo references" className="space-y-2">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
        Identity references
      </p>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {refs.map((ref) => (
          <div
            key={ref.id}
            className="flex-shrink-0 relative rounded-lg overflow-hidden border border-border bg-card"
            style={{ width: 120 }}
          >
            <div className="aspect-square">
              <img
                src={ref.previewUrl}
                alt={ref.label}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                {ref.label}
              </p>
              {ref.approved && (
                <span className="flex items-center gap-0.5 mt-1 text-[9px] text-primary font-semibold">
                  <CheckCircle2 className="size-2.5" aria-hidden /> Approved
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SceneAndTimingControls({
  production,
  projectId,
  onProjectUpdated,
}: {
  production: NbaJoshProduction;
  projectId: string;
  onProjectUpdated: (project: VideoAgentProjectDto) => void;
}) {
  const updateProject = useServerFn(updateVideoAgentProject);
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  async function persist(next: NbaJoshProduction, successMessage: string) {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await updateProject({ data: { id: projectId, production: next } });
      queryClient.setQueryData(["video-agent-project", projectId], updated);
      onProjectUpdated(updated);
      toast.success(successMessage);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function selectScene(scene: NbaJoshProduction["scene"]) {
    void persist(
      { ...production, scene },
      "Scene changed — review the refreshed production plan before rerendering",
    );
  }

  function selectDuration(durationSeconds: number) {
    if (durationSeconds === production.delivery.durationSeconds) return;
    const factor = durationSeconds / production.delivery.durationSeconds;
    const timeline = production.timeline.map((beat, index, beats) => {
      const start = index === 0 ? 0 : Math.min(durationSeconds - 1, Math.round(beat.start * factor));
      const end = index === beats.length - 1
        ? durationSeconds
        : Math.max(start + 1, Math.min(durationSeconds, Math.round(beat.end * factor)));
      return { ...beat, start, end };
    });
    const layerADuration = durationSeconds === 15 ? 10 : durationSeconds;
    void persist(
      {
        ...production,
        delivery: { ...production.delivery, durationSeconds },
        layers: [
          { ...production.layers[0], durationSeconds: layerADuration },
          { ...production.layers[1], durationSeconds },
        ],
        timeline,
        compositeRecipe: {
          ...production.compositeRecipe,
          loop: `Loop Layer B cleanly to exactly ${durationSeconds} seconds with no speed change.`,
        },
      },
      `${durationSeconds}-second delivery selected — review the refreshed production plan`,
    );
  }

  return (
    <section aria-label="Scene and timing controls" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Scene treatment
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pick a visual world before generation. Changing it resets pending approvals and media.
          </p>
        </div>
        <label className="shrink-0 text-xs text-muted-foreground">
          <span className="mr-2">Length</span>
          <select
            value={production.delivery.durationSeconds}
            onChange={(event) => selectDuration(Number(event.target.value))}
            disabled={saving}
            aria-label="Select delivery length"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs font-semibold text-foreground"
          >
            <option value={15}>15 sec</option>
            <option value={20}>20 sec</option>
            <option value={30}>30 sec</option>
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {NBA_JOSH_SCENE_PRESETS.map((scene) => {
          const selected = production.scene.id === scene.id && production.scene.previewUrl === scene.previewUrl;
          return (
            <button
              key={scene.id}
              type="button"
              disabled={saving}
              onClick={() => selectScene(scene)}
              aria-pressed={selected}
              aria-label={`Use ${scene.label} scene`}
              className={cn(
                "overflow-hidden rounded-lg border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                selected ? "border-primary ring-1 ring-primary/70" : "border-border hover:border-primary/50",
              )}
            >
              <img
                src={scene.previewUrl}
                alt={`${scene.label} scene reference`}
                className="aspect-video w-full object-cover"
                loading="lazy"
              />
              <span className="block px-2 py-1.5 text-[11px] font-semibold">{scene.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ReferenceUploadPanel({
  outfits,
  onUpload,
  uploadingTarget,
}: {
  outfits: NbaJoshProduction["outfits"];
  onUpload: (target: "identity" | "scene" | string, file: File) => void;
  uploadingTarget: string | null;
}) {
  const identityInput = useRef<HTMLInputElement>(null);
  const sceneInput = useRef<HTMLInputElement>(null);
  const outfitInputs = useRef<Record<string, HTMLInputElement | null>>({});
  return (
    <section aria-label="Verified production references" className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">Verified production references</p>
        <p className="text-xs text-muted-foreground mt-1">
          Bundled imagery is a visual brief only. Upload the artist and a wardrobe photo per outfit before paid generation.
        </p>
      </div>
      <div className="grid gap-2">
        <input
          ref={identityInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload("identity", file);
            event.target.value = "";
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="justify-between gap-2"
          disabled={uploadingTarget !== null}
          onClick={() => identityInput.current?.click()}
        >
          <span>Upload primary artist reference</span>
          {uploadingTarget === "identity" ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        </Button>
        <input
          ref={sceneInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload("scene", file);
            event.target.value = "";
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="justify-between gap-2"
          disabled={uploadingTarget !== null}
          onClick={() => sceneInput.current?.click()}
        >
          <span>Upload a custom scene reference</span>
          {uploadingTarget === "scene" ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        </Button>
        {outfits.map((outfit) => (
          <div key={outfit.id}>
            <input
              ref={(element) => { outfitInputs.current[outfit.id] = element; }}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(outfit.id, file);
                event.target.value = "";
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-between gap-2 mt-2"
              disabled={uploadingTarget !== null}
              onClick={() => outfitInputs.current[outfit.id]?.click()}
            >
              <span>Upload {outfit.name} wardrobe reference</span>
              {uploadingTarget === outfit.id ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Timeline read-only view ───────────────────────────────────────────────────

function TimelineView({
  timeline,
  durationSeconds,
}: {
  timeline: NbaJoshProduction["timeline"];
  durationSeconds: number;
}) {
  return (
    <section aria-label="Production timeline" className="space-y-2">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
        Production timeline · {durationSeconds}s
      </p>
      <ol className="space-y-1.5" role="list">
        {timeline.map((beat) => (
          <li
            key={`${beat.start}-${beat.end}`}
            className="flex items-start gap-3 text-xs"
          >
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground w-14">
              {beat.start}s–{beat.end}s
            </span>
            <span>
              <span className="font-semibold text-foreground">{beat.label}</span>
              <span className="text-muted-foreground ml-1.5">{beat.direction}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ─── Audio reference ───────────────────────────────────────────────────────────

function AudioRefCard({ audioRef }: { audioRef: NbaJoshProduction["audioRef"] }) {
  return (
    <section
      aria-label="Audio reference: The One hook"
      className="rounded-xl border border-border bg-card p-4 flex items-center gap-4"
    >
      <div
        className="size-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0"
        aria-hidden
      >
        <Music className="size-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Audio · Canonical hook
        </p>
        <p className="text-sm font-bold text-foreground mt-0.5 truncate">
          The One hook · canonical 20s cut
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {audioRef.label}
        </p>
      </div>
      {audioRef.generationUrl ? (
        <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] uppercase tracking-wider shrink-0">
          <CheckCircle2 className="size-3 mr-1" aria-hidden /> Ready
        </Badge>
      ) : (
        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider shrink-0">
          Bundled
        </Badge>
      )}
    </section>
  );
}

// ─── Authorization checklist ────────────────────────────────────────────────────

function AuthorizationChecklist({
  authorization,
  projectId,
  production,
  onProjectUpdated,
}: {
  authorization: NbaJoshProduction["authorization"];
  projectId: string;
  production: NbaJoshProduction;
  onProjectUpdated: (p: VideoAgentProjectDto) => void;
}) {
  const updateProject = useServerFn(updateVideoAgentProject);
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const fields: Array<{ key: keyof typeof authorization; label: string }> = [
    { key: "creatorAttested", label: "Creator attested — authorized to use this likeness for commercial AI generation" },
    { key: "likeness", label: "Likeness rights confirmed" },
    { key: "audio", label: "Audio rights confirmed for The One hook" },
    { key: "media", label: "Supplied media rights confirmed for officers clip" },
  ];

  const allGranted = Object.values(authorization).every(Boolean);

  async function toggle(key: keyof typeof authorization) {
    if (saving) return;
    setSaving(true);
    const next: NbaJoshProduction = {
      ...production,
      authorization: { ...authorization, [key]: !authorization[key] },
    };
    try {
      const updated = await updateProject({ data: { id: projectId, production: next } });
      queryClient.setQueryData(["video-agent-project", projectId], updated);
      onProjectUpdated(updated);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-label="Rights and authorization checklist"
      className={cn(
        "rounded-xl border p-4 space-y-3 transition-colors",
        allGranted
          ? "border-primary/30 bg-primary/5"
          : "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
          Rights authorization
        </p>
        {allGranted ? (
          <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] uppercase tracking-wider">
            <CheckCircle2 className="size-3 mr-1" aria-hidden /> Granted
          </Badge>
        ) : (
          <Badge variant="destructive" className="text-[10px] uppercase tracking-wider">
            <AlertCircle className="size-3 mr-1" aria-hidden /> Required
          </Badge>
        )}
      </div>

      <ul className="space-y-2" role="list" aria-label="Authorization items">
        {fields.map(({ key, label }) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => toggle(key)}
              disabled={saving}
              aria-pressed={authorization[key]}
              aria-label={`${authorization[key] ? "Revoke" : "Grant"}: ${label}`}
              className={cn(
                "flex items-start gap-2.5 w-full text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded p-1 -m-1",
                authorization[key] ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 size-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors",
                  authorization[key]
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/50 bg-transparent",
                )}
                aria-hidden
              >
                {authorization[key] && (
                  <CheckCircle2 className="size-3 text-primary-foreground" />
                )}
              </span>
              <span>{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

export function NbaJoshProductionStudioSkeleton() {
  return (
    <div className="space-y-6 p-4" aria-busy="true" aria-label="Loading production studio">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
        <Skeleton className="aspect-video rounded-xl" />
        <Skeleton className="aspect-video rounded-xl" />
        <Skeleton className="aspect-video rounded-xl" />
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function NbaJoshProductionStudio({ project, production, onProjectUpdated }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const updateProject = useServerFn(updateVideoAgentProject);

  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);

  const planHash = nbaJoshPlanHash(production);

  const layerA = production.layers[0];
  const layerB = production.layers[1];

  async function uploadToStudio(file: File, kind: "image" | "video") {
    if (!user?.id) throw new Error("Sign in before uploading production media");
    const maxBytes = kind === "video" ? 200 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxBytes) throw new Error(`${kind === "video" ? "Video" : "Image"} is too large`);
    const extension = file.name.split(".").pop()?.toLowerCase() || (kind === "video" ? "mp4" : "jpg");
    const path = `${user.id}/uploads/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("studio").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    const { data, error: signError } = await supabase.storage.from("studio").createSignedUrl(path, 60 * 60);
    if (signError || !data?.signedUrl) throw signError ?? new Error("Could not sign uploaded media");
    return data.signedUrl;
  }

  async function handleLayerBUpload(file: File) {
    if (uploadingTarget) return;
    setUploadingTarget("layer-b");
    try {
      const signedUrl = await uploadToStudio(file, "video");
      const next: NbaJoshProduction = {
        ...production,
        layers: [
          layerA,
          {
            ...layerB,
            status: "ready",
            asset: { ...layerB.asset, source: "user-upload", sourceFilename: file.name, previewUrl: signedUrl, generationUrl: signedUrl },
          },
        ],
      };
      const updated = await updateProject({ data: { id: project.id, production: next } });
      queryClient.setQueryData(["video-agent-project", project.id], updated);
      onProjectUpdated(updated);
      toast.success("Officers clip uploaded — Layer B ready");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadingTarget(null);
    }
  }

  async function handleReferenceUpload(target: "identity" | "scene" | string, file: File) {
    if (uploadingTarget) return;
    setUploadingTarget(target);
    try {
      const signedUrl = await uploadToStudio(file, "image");
      const asset = {
        id: `upload-${crypto.randomUUID()}`,
        role: target === "identity" ? "identity" as const : target === "scene" ? "scene" as const : "wardrobe" as const,
        label: file.name,
        source: "user-upload" as const,
        sourceFilename: file.name,
        previewUrl: signedUrl,
        generationUrl: signedUrl,
        approved: target === "identity",
      };
      const next: NbaJoshProduction = target === "identity"
        ? { ...production, identityRefs: [...production.identityRefs, asset] }
        : target === "scene"
          ? {
              ...production,
              scene: {
                ...production.scene,
                label: `${production.scene.label} · custom reference`,
                previewUrl: signedUrl,
                reference: asset,
              },
            }
        : {
            ...production,
            outfits: production.outfits.map((item) =>
              item.id === target ? { ...item, refs: [...item.refs, asset] } : item,
            ),
          };
      const updated = await updateProject({ data: { id: project.id, production: next } });
      queryClient.setQueryData(["video-agent-project", project.id], updated);
      onProjectUpdated(updated);
      toast.success(
        target === "identity"
          ? "Primary artist reference added"
          : target === "scene"
            ? "Custom scene reference added"
            : "Wardrobe reference added",
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadingTarget(null);
    }
  }

  const layerAReady = layerA.status === "ready_for_delivery";

  return (
    <main
      aria-label="NBA Josh Looping Officers — Production Studio"
      className="space-y-8 p-4"
    >
      {/* ── Header ── */}
      <header className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-bold tracking-tight">{project.title}</h2>
          <Badge
            variant="secondary"
            className="text-[10px] uppercase tracking-wider font-semibold"
          >
            NBA Josh · Looping Officers
          </Badge>
          {layerAReady && (
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] uppercase tracking-wider">
              <CheckCircle2 className="size-3 mr-1" aria-hidden /> Layer A Delivered
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground max-w-prose">
          Approve each outfit in sequence: still plan, generated stills, motion, preview,
          and final Layer A clip. Upload the officers clip to complete Layer B.
        </p>
      </header>

      {/* ── Identity references — visual first ── */}
      <IdentityRefsStrip refs={production.identityRefs} />

      <SceneAndTimingControls
        production={production}
        projectId={project.id}
        onProjectUpdated={onProjectUpdated}
      />

      <ReferenceUploadPanel
        outfits={production.outfits}
        onUpload={handleReferenceUpload}
        uploadingTarget={uploadingTarget}
      />

      <Separator />

      {/* ── Audio reference ── */}
      <AudioRefCard audioRef={production.audioRef} />

      <Separator />

      {/* ── Authorization ── */}
      <AuthorizationChecklist
        authorization={production.authorization}
        projectId={project.id}
        production={production}
        onProjectUpdated={onProjectUpdated}
      />

      <Separator />

      {/* ── Layer B ── */}
      <LayerBMissingCard
        layerB={layerB}
        onUpload={handleLayerBUpload}
        uploading={uploadingTarget === "layer-b"}
      />

      <Separator />

      {/* ── Outfit queue ── */}
      <section aria-label="Outfit queue — three outfits">
        <div className="flex items-center justify-between mb-4 gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Outfit queue
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Three wardrobe variants — work through each in order
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {production.outfits.length} outfits
          </Badge>
        </div>

        {production.outfits.length === 0 ? (
          <div
            className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm"
            role="status"
          >
            No outfits in this production plan.
          </div>
        ) : (
          <div className="space-y-4">
            {production.outfits.map((outfit, i) => (
              <OutfitCard
                key={outfit.id}
                outfit={outfit}
                index={i}
                production={production}
                project={project}
                onProjectUpdated={onProjectUpdated}
              />
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* ── Timeline ── */}
      <TimelineView
        timeline={production.timeline}
        durationSeconds={production.delivery.durationSeconds}
      />

      <Separator />

      {/* ── Composite recipe ── */}
      <section aria-label="Composite recipe">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
          Composite recipe
        </p>
        <dl className="space-y-2 text-xs">
          {(
            Object.entries(production.compositeRecipe) as Array<
              [keyof typeof production.compositeRecipe, string]
            >
          ).map(([key, value]) => (
            <div key={key} className="flex gap-3">
              <dt className="shrink-0 font-semibold capitalize text-muted-foreground w-16">
                {key}
              </dt>
              <dd className="text-foreground leading-relaxed">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Delivery spec ── */}
      <section aria-label="Delivery specification">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
          Delivery spec
        </p>
        <div className="flex flex-wrap gap-4 text-xs">
          <span className="text-muted-foreground">
            Duration&nbsp;
            <span className="text-foreground font-semibold">
              {production.delivery.durationSeconds}s
            </span>
          </span>
          <span className="text-muted-foreground">
            Aspect ratio&nbsp;
            <span className="text-foreground font-semibold">
              {production.delivery.aspectRatio}
            </span>
          </span>
          <span className="text-muted-foreground">
            Frame rate&nbsp;
            <span className="text-foreground font-semibold">{production.delivery.fps} fps</span>
          </span>
          <span className="text-muted-foreground">
            Revision&nbsp;
            <span className="text-foreground font-semibold">#{production.revision}</span>
          </span>
        </div>
      </section>
    </main>
  );
}

export default NbaJoshProductionStudio;
