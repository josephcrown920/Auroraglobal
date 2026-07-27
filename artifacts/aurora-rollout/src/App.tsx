import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import NotFound from '@/pages/not-found';
import { supabase } from '@/lib/supabase';
import { LandingHero } from '@/components/LandingHero';
import { AuthGate } from '@/components/AuthGate';
import { StudioWorkspace } from '@/components/StudioWorkspace';
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient();

function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);

  useEffect(() => {
    // Check initial auth state
    supabase?.auth.getSession().then(({ data: { session } }) => {
      setIsSignedIn(!!session);
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase?.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(!!session);
      if (session) {
        setShowAuthGate(false);
      }
    }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--background)]">
        <Loader2 className="size-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (isSignedIn) {
    return <StudioWorkspace />;
  }

  if (showAuthGate) {
    return <AuthGate onSuccess={() => setIsSignedIn(true)} />;
  }

  return (
    <LandingHero 
      onStart={() => setShowAuthGate(true)} 
      isSignedIn={isSignedIn} 
    />
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
