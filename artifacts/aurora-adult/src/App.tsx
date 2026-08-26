import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Landing } from "@/components/Landing";
import { Auth } from "@/components/Auth";
import { ModelGrid } from "@/components/ModelGrid";
import { ModelStudio } from "@/components/ModelStudio";
import { FeatureVisibilityGate } from "@/components/FeatureVisibilityGate";
import { AgeGate } from "@/components/AgeGate";
import { supabase } from "@/lib/supabase";
import type { Model } from "@/lib/models";

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
      if (!s) setSelectedModel(null);
      setSessionLoaded(true);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

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

  if (selectedModel) {
    return (
      <ModelStudio
        model={selectedModel}
        user={session.user}
        onBack={() => setSelectedModel(null)}
      />
    );
  }

  return <ModelGrid user={session.user} onSelectModel={setSelectedModel} />;
}
