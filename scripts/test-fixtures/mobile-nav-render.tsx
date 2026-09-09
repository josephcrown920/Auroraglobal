import { mock } from "bun:test";
import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// This fixture intentionally runs in its own process because Bun module mocks
// are process-global and must never contaminate the main src/ test process.
mock.module("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { ...props, href: to }, children),
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => string;
  }) => select({ location: { pathname: "/" } }),
}));

mock.module("@/lib/theme-context", () => ({
  useTheme: () => ({ theme: "dark", toggle: () => {} }),
}));

mock.module("@/components/FeatureVisibilityProvider", () => ({
  HiddenBadge: () => null,
  useFeatureVisibility: () => ({
    showFeature: () => true,
    isHiddenFromUsers: () => false,
    isAdmin: false,
  }),
}));

mock.module("@/components/WhatsNew", () => ({
  WhatsNew: () => null,
}));

mock.module("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: ReactNode }) => (
    <section aria-label="Mobile navigation drawer">{children}</section>
  ),
  SheetHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const { MobileNav } = await import("../../src/components/MobileNav");

const INTERNAL_DIRECTOR_ROOM_TOOLS = [
  "Wardrobe",
  "Scenes",
  "Layers",
  "AutoCut",
  "Storyboard",
  "Moodboard",
  "Infinity Canvas",
  "Scene Weaver",
  "Style Transfer",
  "Soundweaver",
  "Flows",
  "Video Agent Projects",
  "Aurora AI Director",
] as const;

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function decodeText(html: string) {
  return html
    .replace(/<svg\b[\s\S]*?<\/svg>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function linkLabels(container: string) {
  return [...container.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map((match) =>
    decodeText(match[1] ?? ""),
  );
}

function assertRenderedGlobalNav(container: string, branch: string) {
  const labels = linkLabels(container);
  check(
    labels.filter((label) => label === "Director's Room").length === 1,
    `${branch} must render Director's Room exactly once`,
  );

  const headings = [...container.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map(
    (match) => decodeText(match[1] ?? ""),
  );
  check(
    !headings.includes("Director's Room"),
    `${branch} must not render a Director's Room subsection`,
  );

  for (const internalTool of INTERNAL_DIRECTOR_ROOM_TOOLS) {
    check(
      !labels.includes(internalTool),
      `${branch} unexpectedly rendered Director's Room tool: ${internalTool}`,
    );
  }
}

const html = renderToStaticMarkup(<MobileNav />);
const desktop = html.match(
  /<aside aria-label="Primary navigation"[\s\S]*?<\/aside>/,
)?.[0];
const drawer = html.match(
  /<section aria-label="Mobile navigation drawer"[\s\S]*?<\/section>/,
)?.[0];

check(desktop, "rendered desktop primary navigation was not found");
check(drawer, "rendered mobile Sheet drawer was not found");
assertRenderedGlobalNav(desktop, "desktop sidebar");
assertRenderedGlobalNav(drawer, "mobile Sheet drawer");

console.log(
  JSON.stringify({
    ok: true,
    desktopRendered: true,
    mobileDrawerRendered: true,
  }),
);