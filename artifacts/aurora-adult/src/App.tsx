import { useState, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Auth } from "@/components/Auth";
import { AdminGate, isAdminUnlocked } from "@/components/AdminGate";
import { AdultStudio } from "@/components/AdultStudio";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(isAdminUnlocked);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;
  if (!session) return <Auth />;
  if (!unlocked) return <AdminGate onUnlocked={() => setUnlocked(true)} />;
  return <AdultStudio accessToken={session.access_token} />;
}
