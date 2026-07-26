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
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(262, 83%, 58%)",
    colorForeground: "hsl(0, 0%, 98%)",
    colorMutedForeground: "hsl(240, 5%, 65%)",
    colorDanger: "hsl(0, 84%, 60%)",
    colorBackground: "hsl(240, 10%, 7%)",
    colorInput: "hsl(240, 10%, 12%)",
    colorInputForeground: "hsl(0, 0%, 98%)",
    colorNeutral: "hsl(240, 10%, 12%)",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#111116] border border-[#1e1e24] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-white font-serif text-2xl tracking-tight",
    headerSubtitle: "text-[#a1a1aa]",
    socialButtonsBlockButtonText: "text-white font-medium",
    formFieldLabel: "text-white font-medium",
    footerActionLink: "text-[#7c3aed] hover:text-[#9353d3]",
    footerActionText: "text-[#a1a1aa]",
    dividerText: "text-[#a1a1aa] bg-[#111116]",
    identityPreviewEditButton: "text-[#7c3aed]",
    formFieldSuccessText: "text-emerald-500",
    alertText: "text-white",
    logoBox: "h-12 w-auto flex justify-center",
    logoImage: "h-full object-contain",
    socialButtonsBlockButton: "border-[#1e1e24] bg-[#1a1a21] hover:bg-[#272730]",
    formButtonPrimary: "bg-[#7c3aed] hover:bg-[#6d28d9] text-white shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all",
    formFieldInput: "bg-[#1a1a21] border-[#272730] text-white focus:ring-[#7c3aed]",
    footerAction: "bg-transparent",
    dividerLine: "bg-[#272730]",
    alert: "bg-[#1a1a21] border-[#272730]",
    otpCodeFieldInput: "bg-[#1a1a21] border-[#272730] text-white",
    formFieldRow: "mb-4",
    main: "px-6 py-8",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 bg-cover bg-center" style={{ backgroundImage: 'linear-gradient(to bottom, rgba(10,10,15,0.9), rgba(10,10,15,0.95)), url(/hero-bg.jpg)' }}>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 bg-cover bg-center" style={{ backgroundImage: 'linear-gradient(to bottom, rgba(10,10,15,0.9), rgba(10,10,15,0.95)), url(/hero-bg.jpg)' }}>
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
            
            <Route>
              <div className="flex min-h-screen items-center justify-center flex-col gap-4 text-center">
                <h1 className="text-4xl font-serif font-bold text-white">404</h1>
                <p className="text-muted-foreground">This scene doesn't exist.</p>
              </div>
            </Route>
          </Switch>
          <Toaster theme="dark" position="bottom-right" />
        </TooltipProvider>
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
