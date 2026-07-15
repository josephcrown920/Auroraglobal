import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  caught: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { caught: false, message: "" };
  }

  static getDerivedStateFromError(err: unknown): State {
    const message =
      err instanceof Error ? err.message : String(err ?? "Unknown error");
    return { caught: true, message };
  }

  override componentDidCatch(err: unknown, info: ErrorInfo) {
    const message = err instanceof Error ? err.message : String(err ?? "");
    const stack = err instanceof Error ? (err.stack ?? "") : "";
    void supabase.from("events").insert({
      name: "react_error_boundary",
      path: typeof window !== "undefined" ? window.location.pathname : "/",
      user_id: null,
      session_id: null,
      properties: {
        message: message.slice(0, 500),
        stack: stack.slice(0, 1000),
        componentStack: (info.componentStack ?? "").slice(0, 1000),
      },
    });
  }

  override render() {
    if (this.state.caught) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
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
          <div style={{ fontSize: 36 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text, #f1f5f9)" }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, maxWidth: 480, textAlign: "center" }}>
            {this.state.message || "An unexpected error occurred. Refresh the page to try again."}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: "9px 22px",
              borderRadius: 8,
              border: "1px solid var(--border, #374151)",
              background: "transparent",
              color: "var(--text, #f1f5f9)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
