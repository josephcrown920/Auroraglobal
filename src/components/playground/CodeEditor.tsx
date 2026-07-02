// Client-only Monaco wrapper. Bundles monaco-editor locally through vite
// (?worker imports) instead of pulling it from a CDN at runtime, and points
// @monaco-editor/react's loader at the bundled instance. This file must only
// ever be imported via React.lazy from client-side code.
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import Editor, { loader } from "@monaco-editor/react";

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === "typescript" || label === "javascript") return new tsWorker();
    return new editorWorker();
  },
};

loader.config({ monaco });

export default Editor;
