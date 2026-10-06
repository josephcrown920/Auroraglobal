import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";

describe("motion registration and async GPU dispatch integration", () => {
  it("runs the isolated real-route → smoke helper → RunPod polling fixture", async () => {
    const fixture = fileURLToPath(
      new URL("../../scripts/test-fixtures/motion-smoke.integration.ts", import.meta.url),
    );
    const child = Bun.spawn([process.execPath, fixture], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdout: "pipe",
      stderr: "pipe",
    });
    const killTimer = setTimeout(() => child.kill(), 25_000);
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
    expect(stdout).toContain('"asyncStatusPollsCovered":true');
  }, 30_000);
});
