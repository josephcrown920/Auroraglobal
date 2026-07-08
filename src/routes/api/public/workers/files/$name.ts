// Serves the self-hosted worker's own source files (aurora_worker.py, setup.sh)
// as plain text over HTTP, so a Kaggle/Colab notebook can fetch them directly
// from Aurora instead of GitHub's raw.githubusercontent.com — which 404s for
// private repos (Kaggle has no way to authenticate to a private repo). These
// files contain no secrets; they're the same reference worker code that ships
// in this repo's workers/ directory, so serving them publicly is safe. Reads
// straight off disk (no build step) so the notebook always gets the current
// version without redeploying anything worker-side.

import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Allow-list: only these two files are ever served, by exact basename — never
// pass the URL param straight to the filesystem (path traversal).
const ALLOWED: Record<string, string> = {
  "aurora_worker.py": "workers/aurora_worker.py",
  "setup.sh": "workers/setup.sh",
  "kaggle_bootstrap.py": "workers/kaggle/aurora_worker_kaggle.py",
  "colab_bootstrap.py": "workers/colab/aurora_worker_colab.py",
  "comfyui_bootstrap.py": "workers/comfyui/aurora_comfyui_launcher.py",
  "vast_bootstrap.py": "workers/vast/aurora_worker_vast.py",
};

export const Route = createFileRoute("/api/public/workers/files/$name")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const rel = ALLOWED[params.name];
        if (!rel) {
          return new Response("Not found", { status: 404 });
        }
        try {
          const filePath = path.join(process.cwd(), rel);
          const content = await readFile(filePath, "utf-8");
          return new Response(content, {
            status: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});
