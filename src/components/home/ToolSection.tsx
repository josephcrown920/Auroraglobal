import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

export type ToolCard = {
  to: string;
  label: string;
  desc: string;
  Icon: LucideIcon;
  cost: string;
  img: string;
};

interface ToolSectionProps {
  title: string;
  accentColor: string;
  iconBg: string;
  iconBorder: string;
  tools: ToolCard[];
}

export function ToolSection({ title, accentColor, iconBg, iconBorder, tools }: ToolSectionProps) {
  return (
    <section style={{ paddingBottom: 10 }}>
      {/* Section label */}
      <div style={{ padding: "0 20px 10px" }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            color: accentColor,
          }}
        >
          {title}
        </span>
      </div>

      {/* Horizontal scroll row */}
      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          padding: "0 20px 4px",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}
      >
        {tools.map((tool) => {
          // Alias to uppercase so the cartographer/JSX transform resolves it as a component
          const ToolIcon = tool.Icon;
          return (
          <Link
            key={tool.to}
            to={tool.to}
            className="no-underline"
            style={{ display: "block", flexShrink: 0, width: 132 }}
          >
            {/* Card */}
            <div
              style={{
                width: 132,
                height: 174,
                borderRadius: 14,
                overflow: "hidden",
                position: "relative",
                background: "oklch(0.12 0.018 272)",
                border: "1px solid oklch(1 0 0 / 0.08)",
              }}
            >
              {/* Background image */}
              <img
                src={tool.img}
                alt=""
                aria-hidden
                loading="lazy"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "top center",
                  opacity: 0.48,
                }}
              />

              {/* Dark gradient overlay */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(170deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.4) 48%, rgba(0,0,0,0.92) 100%)",
                }}
              />

              {/* Icon — top-left */}
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  left: 8,
                  width: 25,
                  height: 25,
                  borderRadius: 7,
                  background: iconBg,
                  border: `1px solid ${iconBorder}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ToolIcon size={12} color={accentColor} />
              </div>

              {/* Cost badge — top-right */}
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 7,
                  padding: "2px 6px",
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.62)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  fontSize: 9,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.75)",
                  letterSpacing: "0.03em",
                  lineHeight: 1.4,
                }}
              >
                {tool.cost}
              </div>

              {/* Label + desc — bottom */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: "8px 9px 10px",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.95)",
                    lineHeight: 1.2,
                    marginBottom: 2,
                  }}
                >
                  {tool.label}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.40)",
                    lineHeight: 1.3,
                  }}
                >
                  {tool.desc}
                </div>
              </div>
            </div>
          </Link>
          );
        })}
      </div>
    </section>
  );
}
