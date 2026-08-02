import { createLazyFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CreditCard,
  Gift,
  Settings,
  Shield,
  Store,
  TrendingUp,
  UserRound,
} from "lucide-react";

export const Route = createLazyFileRoute("/account")({ component: AccountHubPage });

const ACCOUNT_MODES = [
  {
    to: "/billing",
    label: "Plan & Billing",
    description: "Manage Aura, subscriptions, top-ups, and spending limits.",
    icon: CreditCard,
  },
  {
    to: "/settings",
    label: "Settings",
    description: "Account details, passkeys, and connected social accounts.",
    icon: Settings,
  },
  {
    to: "/creator/dashboard",
    label: "Creator Hub",
    description: "Publish templates and track creator earnings.",
    icon: TrendingUp,
  },
  {
    to: "/partners",
    label: "Earn Free Aura",
    description: "Invite friends and earn from the Aurora partner program.",
    icon: Gift,
  },
  {
    to: "/marketplace",
    label: "Marketplace",
    description: "Browse reusable creator workflows and templates.",
    icon: Store,
  },
] as const;

function AccountHubPage() {
  return (
    <main className="aurora-page-shell aurora-content-shell min-h-screen text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <div className="relative z-10 mx-auto max-w-4xl px-4 pb-28 pt-8 sm:px-8 sm:pt-12">
        <header className="mb-8">
          <p className="aurora-kicker">Account</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Your Aurora account</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Everything that manages your plan, profile, and creator activity in one place.
          </p>
        </header>

        <section className="mb-8 rounded-3xl border border-border bg-card/70 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UserRound className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold">Looking for your work?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your generated images, videos, and saved assets live in Gallery.
              </p>
              <Link
                to="/gallery"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary no-underline hover:underline"
              >
                Open Gallery <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>

        <div className="aurora-hub-grid grid gap-3">
          {ACCOUNT_MODES.map((mode) => {
            const Icon = mode.icon;
            return (
              <Link
                key={mode.to}
                to={mode.to}
                className="group rounded-2xl border border-border bg-card/60 p-5 no-underline transition hover:-translate-y-0.5 hover:border-primary/40"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" />
                </div>
                <h2 className="mt-6 font-semibold text-foreground">{mode.label}</h2>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{mode.description}</p>
              </Link>
            );
          })}
        </div>

        <Link
          to="/admin"
          className="mt-8 inline-flex items-center gap-2 text-xs text-muted-foreground no-underline hover:text-foreground"
        >
          <Shield className="size-3.5" /> Operator admin
        </Link>
      </div>
    </main>
  );
}