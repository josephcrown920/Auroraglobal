import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Toaster } from "sonner";
import { Landing } from "@/components/Landing";
import { Auth } from "@/components/Auth";
import { ModelGrid } from "@/components/ModelGrid";
import { ModelStudio } from "@/components/ModelStudio";
import { FeatureVisibilityGate } from "@/components/FeatureVisibilityGate";
import { AgeGate } from "@/components/AgeGate";
import { CanvasWorkspace } from "@/components/canvas/CanvasWorkspace";
import { McpCliPage } from "@/components/mcp/McpCliPage";
import { OnboardingTour } from "@/components/tour/OnboardingTour";
import type { TourView } from "@/components/tour/tourSteps";
import { TOUR_STEPS } from "@/components/tour/tourSteps";
import { hasTourCompleted, markTourCompleted } from "@/lib/tour";
import { supabase } from "@/lib/supabase";
import type { Model } from "@/lib/models";

type View = "grid" | "canvas" | "connect";

// Access model (owner decision 2026-08-09):
//   - Model studios are SHARED — every signed-in creator sees the same roster.
//   - Each creator's gallery/generation history is PRIVATE — rows in
//     `generations` are scoped to their user_id by Supabase RLS.
export default function App() {
  return (
    <FeatureVisibilityGate>
      <AdultSchoolApp />
    </FeatureVisibilityGate>
  );
}

function AdultSchoolApp() {
  const [entered, setEntered] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(() => {
    try {
      return localStorage.getItem("aurora_adult_age_confirmed") === "1";
    } catch {
      return false;
    }
  });
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [view, setView] = useState<View>("grid");
  const [tourStep, setTourStep] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionLoaded(true);
    }).catch(() => {
      if (!active) return;
      setSession(null);
      setSessionLoaded(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      if (!active) return;
      setSession(s);
      if (!s) {
        setSelectedModel(null); // clear user-scoped view state on sign-out
        setView("grid");
        setTourStep(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Start the once-per-user onboarding tour the first time a signed-in
  // creator reaches the roster.
  useEffect(() => {
    if (session && !hasTourCompleted(session.user.id)) {
      setTourStep(0);
    }
  }, [session]);

  function navigateForTour(v: TourView) {
    setSelectedModel(null);
    setView(v);
  }

  function endTour() {
    if (session) markTourCompleted(session.user.id);
    setTourStep(null);
  }

  if (!entered) return <Landing onEnter={() => setEntered(true)} />;
  if (!ageConfirmed) return <AgeGate onConfirm={() => setAgeConfirmed(true)} />;

  // Never render a blank page while auth is resolving. The old null return
  // made the app look broken immediately after entering from the landing page.
  if (!sessionLoaded) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0b0814] px-6 text-white">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="mx-auto size-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          <h1 className="text-lg font-semibold">Opening Aurora School…</h1>
          <p className="text-sm text-white/60">Preparing your secure studio session.</p>
        </div>
      </main>
    );
  }

  if (!session) return <Auth />;

  const tourOverlay =
    tourStep !== null ? (
      <OnboardingTour
        stepIndex={tourStep}
        onNavigate={navigateForTour}
        onNext={() => (tourStep >= TOUR_STEPS.length - 1 ? endTour() : setTourStep(tourStep + 1))}
        onBack={() => setTourStep(Math.max(0, tourStep - 1))}
        onSkip={endTour}
      />
    ) : null;

  let body: React.ReactNode;
  if (selectedModel) {
    body = <ModelStudio model={selectedModel} user={session.user} onBack={() => setSelectedModel(null)} />;
  } else if (view === "canvas") {
    body = (
      <CanvasWorkspace
        user={session.user}
        onBack={() => setView("grid")}
        onOpenConnect={() => setView("connect")}
      />
    );
  } else if (view === "connect") {
    body = <McpCliPage user={session.user} onBack={() => setView("grid")} />;
  } else {
    body = (
      <ModelGrid
        user={session.user}
        onSelectModel={setSelectedModel}
        onOpenCanvas={() => setView("canvas")}
        onOpenConnect={() => setView("connect")}
        onReplayTour={() => setTourStep(0)}
      />
    );
  }

  return (
    <>
      {body}
      {tourOverlay}
      <Toaster theme="dark" position="top-center" richColors />
    </>
  );
}
