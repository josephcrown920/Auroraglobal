import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { AgeGate } from "@/components/AgeGate";
import { Auth } from "@/components/Auth";
import { AdultStudio } from "@/components/AdultStudio";
import { Loader2 } from "lucide-react";

function isAgeConfirmed() {
  return localStorage.getItem("aurora_adult_age_confirmed") === "1";
}

export default function App() {
  const [ageOk, setAgeOk] = useState(isAgeConfirmed());
  const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // 1. Age gate — must confirm once per device
  if (!ageOk) {
    return <AgeGate onConfirm={() => setAgeOk(true)} />;
  }

  // 2. Auth loading
  if (session === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050207]">
        <Loader2 size={24} className="animate-spin text-rose-400" />
      </div>
    );
  }

  // 3. Must be signed in to access the studio
  if (!session) {
    return <Auth />;
  }

  // 4. Authenticated + age confirmed → studio
  return <AdultStudio session={session} />;
}
