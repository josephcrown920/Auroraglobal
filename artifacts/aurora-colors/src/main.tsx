import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Toaster position="bottom-right" theme="dark" richColors />
  </StrictMode>,
);
