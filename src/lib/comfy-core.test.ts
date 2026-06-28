import { describe, it, expect } from "bun:test";
import {
  validateDeclaredInputs,
  validateInputValues,
  buildComfyInputs,
  classifyComfyOutput,
  validateWorkflowJson,
  isComfyWorker,
  workerHasCapability,
  pickComfyWorkers,
  coarseProgress,
  MAX_DECLARED_INPUTS,
  type DeclaredInput,
  type ComfyWorkerLite,
} from "./comfy-core";

describe("validateDeclaredInputs", () => {
  it("accepts a well-formed schema", () => {
    const r = validateDeclaredInputs([
      { key: "6.text", label: "Prompt", type: "text" },
      { key: "3.seed", label: "Seed", type: "seed" },
      { key: "9.sampler", label: "Sampler", type: "select", options: ["euler", "dpmpp_2m"] },
    ]);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("rejects non-array input", () => {
    expect(validateDeclaredInputs({} as unknown).ok).toBe(false);
  });

  it("rejects bad keys, missing labels, bad types, and selects without options", () => {
    const r = validateDeclaredInputs([
      { key: "no-dot", label: "x", type: "text" },
      { key: "6.text", label: "", type: "text" },
      { key: "7.text", label: "ok", type: "color" },
      { key: "8.x", label: "Sampler", type: "select" },
    ]);
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(4);
  });

  it("flags duplicate keys", () => {
    const r = validateDeclaredInputs([
      { key: "6.text", label: "A", type: "text" },
      { key: "6.text", label: "B", type: "text" },
    ]);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("duplicate"))).toBe(true);
  });

  it("enforces the declared-input cap", () => {
    const many = Array.from({ length: MAX_DECLARED_INPUTS + 1 }, (_, i) => ({
      key: `${i}.text`,
      label: `L${i}`,
      type: "text" as const,
    }));
    expect(validateDeclaredInputs(many).ok).toBe(false);
  });
});

describe("validateInputValues", () => {
  const declared: DeclaredInput[] = [
    { key: "6.text", label: "Prompt", type: "text", required: true },
    { key: "3.seed", label: "Seed", type: "seed", min: 0 },
    { key: "5.cfg", label: "CFG", type: "number", min: 1, max: 20 },
    { key: "9.sampler", label: "Sampler", type: "select", options: ["euler", "dpmpp_2m"] },
    { key: "10.image", label: "Init image", type: "image" },
    { key: "11.flag", label: "HiRes", type: "boolean" },
  ];

  it("requires required fields", () => {
    const r = validateInputValues(declared, {});
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("Prompt"))).toBe(true);
  });

  it("coerces seeds to integers and numbers to floats", () => {
    const r = validateInputValues(declared, { "6.text": "hi", "3.seed": "42.9", "5.cfg": "7.5" });
    expect(r.ok).toBe(true);
    expect(r.values["3.seed"]).toBe(42);
    expect(r.values["5.cfg"]).toBe(7.5);
  });

  it("enforces numeric bounds", () => {
    const r = validateInputValues(declared, { "6.text": "hi", "5.cfg": 99 });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("CFG"))).toBe(true);
  });

  it("rejects select values outside options and non-url images", () => {
    const r = validateInputValues(declared, { "6.text": "hi", "9.sampler": "bogus", "10.image": "not-a-url" });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("Sampler"))).toBe(true);
    expect(r.errors.some((e) => e.includes("Init image"))).toBe(true);
  });

  it("accepts valid select + image url + boolean coercion", () => {
    const r = validateInputValues(declared, {
      "6.text": "hi",
      "9.sampler": "euler",
      "10.image": "https://x/y.png",
      "11.flag": "true",
    });
    expect(r.ok).toBe(true);
    expect(r.values["11.flag"]).toBe(true);
  });
});

describe("buildComfyInputs", () => {
  const declared: DeclaredInput[] = [
    { key: "6.text", label: "Prompt", type: "text", default: "a cat" },
    { key: "3.seed", label: "Seed", type: "seed" },
  ];

  it("layers declared defaults < template defaults < user values, dropping undeclared keys", () => {
    const out = buildComfyInputs(
      declared,
      { "3.seed": 7, "99.evil": "drop me" },
      { "6.text": "template override" },
    );
    expect(out).toEqual({ "6.text": "template override", "3.seed": 7 });
  });

  it("user values win over template defaults", () => {
    const out = buildComfyInputs(declared, { "6.text": "user wins" }, { "6.text": "tpl" });
    expect(out["6.text"]).toBe("user wins");
  });
});

describe("classifyComfyOutput", () => {
  it("classifies /view image and video urls", () => {
    expect(classifyComfyOutput("http://h/view?filename=out.png&type=output")).toBe("image");
    expect(classifyComfyOutput("http://h/view?filename=clip.mp4")).toBe("video");
    expect(classifyComfyOutput("http://h/view?filename=anim.webm")).toBe("video");
  });
  it("returns unknown for missing/odd urls", () => {
    expect(classifyComfyOutput(undefined)).toBe("unknown");
    expect(classifyComfyOutput("http://h/view?filename=data.bin")).toBe("unknown");
  });
});

describe("validateWorkflowJson", () => {
  it("accepts a non-empty object graph", () => {
    const r = validateWorkflowJson({ "3": { class_type: "KSampler", inputs: {} } });
    expect(r.ok).toBe(true);
    expect(r.nodeCount).toBe(1);
  });
  it("rejects arrays, empties, and oversize graphs", () => {
    expect(validateWorkflowJson([]).ok).toBe(false);
    expect(validateWorkflowJson({}).ok).toBe(false);
    expect(validateWorkflowJson(null).ok).toBe(false);
    const big = { "1": { blob: "x".repeat(300 * 1024) } };
    expect(validateWorkflowJson(big).ok).toBe(false);
  });
});

describe("worker capability helpers", () => {
  const workers: ComfyWorkerLite[] = [
    { id: "a", name: "comfy-img", protocol: "comfyui", status: "active", capabilities: ["image"] },
    { id: "b", name: "comfy-vid", protocol: "comfyui", status: "active", capabilities: ["video"] },
    { id: "c", name: "comfy-paused", protocol: "comfyui", status: "paused", capabilities: ["image"] },
    { id: "d", name: "runpod", protocol: "runpod", status: "active", capabilities: ["image"] },
  ];

  it("identifies comfyui workers and capabilities", () => {
    expect(isComfyWorker(workers[0])).toBe(true);
    expect(isComfyWorker(workers[3])).toBe(false);
    expect(workerHasCapability(workers[0], "image")).toBe(true);
    expect(workerHasCapability(workers[0], "video")).toBe(false);
  });

  it("picks only active comfyui workers, filtered by kind", () => {
    expect(pickComfyWorkers(workers).map((w) => w.id)).toEqual(["a", "b"]);
    expect(pickComfyWorkers(workers, "video").map((w) => w.id)).toEqual(["b"]);
    expect(pickComfyWorkers(workers, "image").map((w) => w.id)).toEqual(["a"]);
  });
});

describe("coarseProgress", () => {
  it("maps statuses to coarse percentages", () => {
    expect(coarseProgress("queued")).toBe(5);
    expect(coarseProgress("running")).toBe(50);
    expect(coarseProgress("running", 80)).toBe(80);
    expect(coarseProgress("running", 99)).toBe(95);
    expect(coarseProgress("succeeded")).toBe(100);
  });
});
