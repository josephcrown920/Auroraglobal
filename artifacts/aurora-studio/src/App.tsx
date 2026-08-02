import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

// Layouts & Pages
import PublicLayout from "./components/layout/PublicLayout";
import AppLayout from "./components/layout/AppLayout";
import { GenerationWatcherProvider } from "./contexts/generationWatcher";
import LandingPage from "./pages/landing";
import PricingPage from "./pages/pricing";
import DashboardPage from "./pages/dashboard";
import ColorsStudioPage from "./pages/studio";
import MotionStudioPage from "./pages/motion";
import LipsyncStudioPage from "./pages/lipsync";
import MusicVideoStudioPage from "./pages/music-video";
import UgcFactoryPage from "./pages/ugc";
import GalleryPage from "./pages/gallery";
import SettingsPage from "./pages/settings";
import ComingSoonPage from "./pages/coming-soon";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "#007AFF",
    colorForeground: "#FFFFFF",
    colorMutedForeground: "#999999",
    colorDanger: "#FF3B30",
    colorBackground: "#1A1A1A",
    colorInput: "#1A1A1A",
    colorInputForeground: "#FFFFFF",
    colorNeutral: "#1A1A1A",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#2A2A2A] border border-[#333333] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-white font-display text-2xl tracking-tight",
    headerSubtitle: "text-[#999999]",
    socialButtonsBlockButtonText: "text-white font-medium",
    formFieldLabel: "text-white font-medium text-sm",
    footerActionLink: "text-brand hover:text-[#0051D5]",
    footerActionText: "text-[#999999]",
    dividerText: "text-[#999999] bg-[#2A2A2A]",
    identityPreviewEditButton: "text-brand",
    formFieldSuccessText: "text-[#34C759]",
    alertText: "text-white",
    socialButtonsBlockButton: "border-[#333333] bg-[#1A1A1A] hover:bg-[#333333]",
    formButtonPrimary: "bg-brand hover:bg-[#0051D5] text-white shadow-none transition-all",
    formFieldInput: "bg-[#1A1A1A] border-[#333333] text-white focus:ring-brand",
    footerAction: "bg-transparent",
    dividerLine: "bg-[#333333]",
    alert: "bg-[#1A1A1A] border-[#333333]",
    otpCodeFieldInput: "bg-[#1A1A1A] border-[#333333] text-white",
    formFieldRow: "mb-4",
    main: "px-6 py-8",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#1A1A1A] px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#1A1A1A] px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <AppLayout>
          <Component />
        </AppLayout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function HomeRoute() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <PublicLayout>
          <LandingPage />
        </PublicLayout>
      </Show>
    </>
  );
}

function PricingRoute() {
  return (
    <PublicLayout>
      <PricingPage />
    </PublicLayout>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Access the Studio",
            subtitle: "Enter your credentials to continue",
          },
        },
        signUp: {
          start: {
            title: "Join Aurora",
            subtitle: "Create your creative studio account",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <GenerationWatcherProvider>
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRoute} />
            <Route path="/pricing" component={PricingRoute} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            
            {/* Protected App Routes */}
            <Route path="/dashboard"><ProtectedRoute component={DashboardPage} /></Route>
            <Route path="/studio"><ProtectedRoute component={ColorsStudioPage} /></Route>
            <Route path="/motion"><ProtectedRoute component={MotionStudioPage} /></Route>
            <Route path="/lipsync"><ProtectedRoute component={LipsyncStudioPage} /></Route>
            <Route path="/music-video"><ProtectedRoute component={MusicVideoStudioPage} /></Route>
            <Route path="/ugc"><ProtectedRoute component={UgcFactoryPage} /></Route>
            <Route path="/gallery"><ProtectedRoute component={GalleryPage} /></Route>
            <Route path="/settings"><ProtectedRoute component={SettingsPage} /></Route>
            <Route path="/perform-anywhere"><ProtectedRoute component={ComingSoonPage} /></Route>
            <Route path="/video-agent"><ProtectedRoute component={ComingSoonPage} /></Route>
            <Route path="/directors-room"><ProtectedRoute component={ComingSoonPage} /></Route>
            <Route path="/grwm"><ProtectedRoute component={ComingSoonPage} /></Route>
            
            <Route>
              <div className="flex min-h-screen items-center justify-center flex-col gap-4 text-center bg-[#1A1A1A]">
                <h1 className="text-4xl font-display font-bold text-white">404</h1>
                <p className="text-[#999999]">This scene doesn't exist.</p>
              </div>
            </Route>
          </Switch>
          <Toaster theme="dark" position="bottom-right" />
        </TooltipProvider>
        </GenerationWatcherProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
