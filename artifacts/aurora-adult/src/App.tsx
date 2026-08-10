import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Landing } from "@/components/Landing";
import { Auth } from "@/components/Auth";
import { ModelGrid } from "@/components/ModelGrid";
import { ModelStudio } from "@/components/ModelStudio";
import { supabase } from "@/lib/supabase";
import type { Model } from "@/lib/models";

// Access model (owner decision 2026-08-09):
//   - Model studios are SHARED — every signed-in creator sees the same roster.
//   - Each creator's gallery/generation history is PRIVATE — rows in
//     `generations` are scoped to their user_id by Supabase RLS.
export default function App() {
  const [entered, setEntered] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      if (!s) setSelectedModel(null); // clear user-scoped view state on sign-out
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!entered) return <Landing onEnter={() => setEntered(true)} />;
  if (!sessionLoaded) return null;
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
