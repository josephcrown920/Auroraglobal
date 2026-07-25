// Client-only Monaco wrapper. Loads the editor at runtime via
// @monaco-editor/react's default CDN loader instead of bundling the full
// monaco-editor module graph — bundling ~4,500 monaco modules OOMs the
// production client build in this container, which blocked every publish.
// The /editor Playground is an archived, admin-only tool, so a runtime CDN
// dependency is an acceptable tradeoff for a working production build.
import Editor from "@monaco-editor/react";

export default Editor;
