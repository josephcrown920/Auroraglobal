import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isStaleChunkError, reloadOnceForStaleChunk } from "@/lib/stale-chunk";

const BTN: React.CSSProperties = {
  marginTop: 8,
  padding: "9px 22px",
  borderRadius: 8,
  border: "1px solid var(--border, #374151)",
  background: "transparent",
  color: "var(--text, #f1f5f9)",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  caught: boolean;
  generation: number;
  recovering: boolean;
}

/**
 * Last-resort client containment layer.
 *
 * This boundary deliberately sits around the authenticated application shell.
 * A component/render error therefore becomes a contained recovery state rather
 * than a white screen. Stale Vite chunks get the same guarded one-shot reload
 * used by the router; real runtime errors never enter an automatic reload loop.
 *
 * This is a UX safety net, not a substitute for release certification or
 * deployment rollback. The release pipeline must still keep a known-good build
 * available for infrastructure-level rollback.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { caught: false, generation: 0, recovering: false };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { caught: true, recovering: false };
  }

  override componentDidCatch(err: unknown, info: ErrorInfo) {
    const message = err instanceof Error ? err.message : String(err ?? "Unknown error");
    const stack = err instanceof Error ? (err.stack ?? "") : "";

    // A deploy can leave an open tab pointing at deleted hashed chunks. Recover
    // once, then stop: repeated reloads would turn a broken release into a loop.
    if (isStaleChunkError(err) && typeof window !== "undefined") {
      if (reloadOnceForStaleChunk(window.location.pathname)) {
        this.setState({ recovering: true });
        return;
      }
    }

    // Never render raw exception text to users. Provider URLs, SQL errors and
    // internal paths can contain implementation details or sensitive metadata.
    // Keep the diagnostic payload bounded and send it only to the existing
    // application event channel.
    void supabase.from("events").insert({
      name: "react_error_boundary",
      path: typeof window !== "undefined" ? window.location.pathname : "/",
      user_id: null,
      session_id: null,
      payload: {
        message: message.slice(0, 500),
        stack: stack.slice(0, 1000),
        componentStack: (info.componentStack ?? "").slice(0, 1000),
      } as import("@/integrations/supabase/types").Json,
    }).catch(() => {
      // Telemetry must never become another user-visible failure.
    });
  }

  private retry = () => {
    this.setState((state) => ({
      caught: false,
      recovering: false,
      generation: state.generation + 1,
    }));
  };

  private reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  override render() {
    if (this.state.recovering) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="text-center text-sm text-muted-foreground">Recovering Aurora…</div>
        </div>
      );
    }

    if (this.state.caught) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            gap: 12,
            padding: 32,
            color: "var(--text-muted, #9ca3af)",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text, #f1f5f9)" }}>
            Aurora recovered from an unexpected issue
          </div>
          <div style={{ fontSize: 13, maxWidth: 480, textAlign: "center" }}>
            This part of the app stopped safely. Your session is still protected. Try the page again or return home.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <button onClick={this.retry} style={BTN}>Try again</button>
            <button onClick={this.reload} style={BTN}>Reload page</button>
            <button onClick={() => { if (typeof window !== "undefined") window.location.href = "/"; }} style={BTN}>
              ← Back to home
            </button>
          </div>
        </div>
      );
    }

    return <div key={this.state.generation}>{this.props.children}</div>;
  }
}
