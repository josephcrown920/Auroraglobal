/**
 * GPU compositor — composes the storyboard into a single contact sheet on the
 * local GPU via WebGPU, falling back to canvas 2D when WebGPU is unavailable.
 */

export type GpuStatus = "webgpu" | "cpu";

export function gpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export function gpuStatus(): GpuStatus {
  return gpuAvailable() ? "webgpu" : "cpu";
}

const CELL = 512;

const G = globalThis as unknown as {
  GPUTextureUsage: { TEXTURE_BINDING: number; COPY_DST: number; RENDER_ATTACHMENT: number };
  GPUBufferUsage: { UNIFORM: number; COPY_DST: number };
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode a layer frame"));
    img.src = src;
  });
}

function grid(count: number) {
  const cols = Math.min(count, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);
  return { cols, rows, width: cols * CELL, height: rows * CELL };
}

const SHADER = /* wgsl */ `
struct VSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
struct Rect { offset: vec2f, scale: vec2f };
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var<uniform> rect: Rect;

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VSOut {
  var quad = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0)
  );
  let p = quad[i];
  let ndc = (rect.offset + p * rect.scale) * vec2f(2.0, -2.0) + vec2f(-1.0, 1.0);
  var out: VSOut;
  out.pos = vec4f(ndc, 0.0, 1.0);
  out.uv = p;
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  return textureSample(tex, samp, in.uv);
}
`;

async function composeWebGPU(images: HTMLImageElement[]): Promise<string> {
  const gpu = (navigator as unknown as { gpu: GPUAdapterProvider }).gpu;
  const adapter = await gpu.requestAdapter();
  if (!adapter) throw new Error("No GPU adapter");
  const device = await adapter.requestDevice();

  const { cols, width, height } = grid(images.length);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("webgpu") as GPUCanvasContext | null;
  if (!ctx) throw new Error("No WebGPU canvas context");
  const format = gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: "premultiplied" });

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module: device.createShaderModule({ code: SHADER }), entryPoint: "vs" },
    fragment: {
      module: device.createShaderModule({ code: SHADER }),
      entryPoint: "fs",
      targets: [{ format }],
    },
    primitive: { topology: "triangle-list" },
  });

  const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: ctx.getCurrentTexture().createView(),
        clearValue: { r: 0.04, g: 0.02, b: 0.07, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });
  pass.setPipeline(pipeline);

  images.forEach((img, i) => {
    const texture = device.createTexture({
      size: [img.naturalWidth, img.naturalHeight],
      format: "rgba8unorm",
      usage:
        G.GPUTextureUsage.TEXTURE_BINDING | G.GPUTextureUsage.COPY_DST | G.GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture(
      { source: img },
      { texture },
      [img.naturalWidth, img.naturalHeight],
    );

    const col = i % cols;
    const row = Math.floor(i / cols);
    const uniform = device.createBuffer({ size: 16, usage: G.GPUBufferUsage.UNIFORM | G.GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(
      uniform,
      0,
      new Float32Array([(col * CELL) / width, (row * CELL) / height, CELL / width, CELL / height]),
    );

    pass.setBindGroup(
      0,
      device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: texture.createView() },
          { binding: 2, resource: { buffer: uniform } },
        ],
      }),
    );
    pass.draw(6);
  });

  pass.end();
  device.queue.submit([encoder.finish()]);
  await device.queue.onSubmittedWorkDone();
  return canvas.toDataURL("image/png");
}

function composeCanvas(images: HTMLImageElement[]): string {
  const { cols, width, height } = grid(images.length);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#0b0512";
  ctx.fillRect(0, 0, width, height);
  images.forEach((img, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    ctx.drawImage(img, col * CELL, row * CELL, CELL, CELL);
  });
  return canvas.toDataURL("image/png");
}

/** Compose frames into one PNG data URL. Returns which path actually ran. */
export async function composeSheet(
  frames: string[],
): Promise<{ dataUrl: string; status: GpuStatus }> {
  const usable = frames.filter(Boolean);
  if (usable.length === 0) throw new Error("Nothing to compose yet");
  const images = await Promise.all(usable.map(loadImage));
  if (gpuAvailable()) {
    try {
      return { dataUrl: await composeWebGPU(images), status: "webgpu" };
    } catch {
      // fall through to CPU
    }
  }
  return { dataUrl: composeCanvas(images), status: "cpu" };
}

type GPUAdapterProvider = {
  requestAdapter: () => Promise<GPUAdapter | null>;
  getPreferredCanvasFormat: () => GPUTextureFormat;
};
