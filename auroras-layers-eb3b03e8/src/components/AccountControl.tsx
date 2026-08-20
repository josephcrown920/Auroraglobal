import { useEffect, useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function AccountControl() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn() {
    await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
  }

  if (email) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => void supabase.auth.signOut()}>
        <LogOut aria-hidden="true" /> Sign out
      </Button>
    );
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => void signIn()}>
      <LogIn aria-hidden="true" /> Sync projects
    </Button>
  );
}