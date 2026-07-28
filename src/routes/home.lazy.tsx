import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { listGenerations } from "@/lib/studio.functions";
import { getMyProfile } from "@/lib/billing.functions";

import { HomeTopBar } from "@/components/home/HomeTopBar";
import { ComposerHero } from "@/components/home/ComposerHero";
import { FormatChipRow } from "@/components/home/FormatChipRow";
import { RecentProjectsGrid } from "@/components/home/RecentProjectsGrid";
import type { GenItem } from "@/components/home/RecentProjectsGrid";

export const Route = createLazyFileRoute("/home")({ component: HomePage });

function HomePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Auth redirect
  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // Data hooks (unchanged from previous version)
  const profileFn = useServerFn(getMyProfile);
  const listFn    = useServerFn(listGenerations);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn:  () => profileFn(),
    enabled:  !!user,
  });

  const { data: hist } = useQuery({
    queryKey: ["gens", user?.id],
    queryFn:  () => listFn(),
    enabled:  !!user,
  });

  const credits     = profile?.credits ?? null;
  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Creator";
  const avatarInitial = displayName.charAt(0).toUpperCase();

  const succeeded: GenItem[] = (hist?.items ?? []).filter(
    (i) =>
      (i.status === "complete" || i.status === "succeeded") &&
      (i.result_image_url || i.result_video_url),
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center aurora-page-shell">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="aurora-page-shell relative min-h-screen text-foreground">
      <span aria-hidden className="aurora-ambient" />

      {/* Fixed top bar — sits above everything */}
      <HomeTopBar credits={credits} avatarInitial={avatarInitial} />

      {/* Spacer for fixed top bar */}
      <div style={{ height: "3.5rem" }} />

      {/* Page content */}
      <div
        className="relative z-10"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
      >
        <ComposerHero />
        <FormatChipRow />
        <RecentProjectsGrid items={succeeded} />
      </div>
    </div>
  );
}
