import { createLazyFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

const DIRECTORS_BOARD_ORIGIN = "https://id-preview--8792619a-eb3e-4ba6-b4a4-50c02786bc60.lovable.app";
const DIRECTORS_BOARD_URL = `${DIRECTORS_BOARD_ORIGIN}/?embed=1`;

export const Route = createLazyFileRoute("/directors-board")({
  component: DirectorsBoardEmbed,
});

function DirectorsBoardEmbed() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== DIRECTORS_BOARD_ORIGIN) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type !== "directors-board:height") return;

      const height = Number(event.data.height);
      if (!Number.isFinite(height) || height <= 0) return;

      iframeRef.current!.style.height = `${Math.ceil(height)}px`;
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <main className="min-h-screen w-full bg-background">
      <iframe
        ref={iframeRef}
        id="directors-board"
        src={DIRECTORS_BOARD_URL}
        title="Aurora Director's Board"
        className="block w-full border-0"
        style={{ minHeight: "100vh" }}
        allow="clipboard-write; fullscreen; camera; microphone"
      />
    </main>
  );
}
