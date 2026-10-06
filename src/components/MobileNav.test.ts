import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { getGlobalMobileNavBranches } from "./MobileNav";

const DIRECTOR_ROOM_LABEL = "Director's Room";
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

function labelsFor(
  sections: ReturnType<typeof getGlobalMobileNavBranches>["desktop"],
) {
  return sections.flatMap((section) => section.features.map((feature) => feature.label));
}

function expectGlobalBranchContract(
  sections: ReturnType<typeof getGlobalMobileNavBranches>["desktop"],
) {
  const features = sections.flatMap((section) => section.features);
  const labels = labelsFor(sections);
  const directorRoomLinks = features.filter(
    (feature) => feature.label === DIRECTOR_ROOM_LABEL,
  );

  expect(directorRoomLinks).toHaveLength(1);
  expect(directorRoomLinks[0]?.to).toBe("/director-room");
  expect(sections.map((section) => section.label)).not.toContain(DIRECTOR_ROOM_LABEL);

  for (const internalTool of INTERNAL_DIRECTOR_ROOM_TOOLS) {
    expect(labels).not.toContain(internalTool);
  }
}

describe("MobileNav global Director's Room boundary", () => {
  test("desktop sidebar exposes one Director's Room destination and no internal tools", () => {
    const { desktop } = getGlobalMobileNavBranches();
    expectGlobalBranchContract(desktop);
  });

  test("mobile drawer exposes one Director's Room destination and no internal tools", () => {
    const { mobileDrawer } = getGlobalMobileNavBranches();
    expectGlobalBranchContract(mobileDrawer);
  });

  test("mobile bottom tabs never promote Director's Room internal tools", () => {
    const { mobileTabs } = getGlobalMobileNavBranches();
    const labels = mobileTabs.map((feature) => feature.label);

    expect(labels).not.toContain(DIRECTOR_ROOM_LABEL);
    for (const internalTool of INTERNAL_DIRECTOR_ROOM_TOOLS) {
      expect(labels).not.toContain(internalTool);
    }
  });

  test("admin-only visibility does not change the Director's Room boundary", () => {
    const regularUser = getGlobalMobileNavBranches({
      isAdmin: false,
      showFeature: () => true,
    });
    const admin = getGlobalMobileNavBranches({
      isAdmin: true,
      showFeature: () => true,
    });

    expect(labelsFor(regularUser.desktop)).not.toContain("Admin");
    expect(labelsFor(regularUser.mobileDrawer)).not.toContain("Admin");
    expect(labelsFor(admin.desktop)).toContain("Admin");
    expect(labelsFor(admin.mobileDrawer)).toContain("Admin");
    expectGlobalBranchContract(regularUser.desktop);
    expectGlobalBranchContract(regularUser.mobileDrawer);
    expectGlobalBranchContract(admin.desktop);
    expectGlobalBranchContract(admin.mobileDrawer);
  });

  test("renders one all-viewport Sheet branch without a persistent sidebar", async () => {
    const fixture = fileURLToPath(
      new URL("../../scripts/test-fixtures/mobile-nav-render.tsx", import.meta.url),
    );
    const child = Bun.spawn([process.execPath, fixture], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdout: "pipe",
      stderr: "pipe",
    });
    const killTimer = setTimeout(() => child.kill(), 10_000);
    let exitCode: number;
    let stdout: string;
    let stderr: string;
    try {
      [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
    } finally {
      clearTimeout(killTimer);
      child.kill();
    }

    expect(exitCode, `${stdout}\n${stderr}`).toBe(0);
    expect(stdout).toContain('"allViewportDrawerRendered":true');
    expect(stdout).toContain('"persistentDesktopSidebarRendered":false');

    // The fixture's incomplete router stub exists only in the child process.
    // If mock.module leaked, this real export would be missing here.
    const router = await import("@tanstack/react-router");
    expect(typeof router.createRouter).toBe("function");
  }, 15_000);
});