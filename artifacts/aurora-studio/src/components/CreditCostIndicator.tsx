import { Zap } from "lucide-react";
import { Link } from "wouter";

interface CreditCostIndicatorProps {
  cost: number;
  balance: number | undefined;
  accentColor?: string;
}

export function CreditCostIndicator({
  cost,
  balance,
  accentColor = "#007AFF",
}: CreditCostIndicatorProps) {
  const hasBalance = balance !== undefined;
  const insufficient = hasBalance && balance < cost;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Zap
          size={13}
          style={{ color: insufficient ? "#FF453A" : accentColor }}
        />
        <span className="text-xs font-bold uppercase tracking-wider text-[#888888]">
          Cost
        </span>
        <span
          className="text-sm font-bold"
          style={{ color: insufficient ? "#FF453A" : "white" }}
        >
          {cost} Aura
        </span>
      </div>

      {hasBalance && (
        <span
          className="text-xs"
          style={{ color: insufficient ? "#FF453A" : "#555555" }}
        >
          {insufficient ? (
            <>
              Balance: {balance} —{" "}
              <Link
                href="/settings"
                className="underline font-bold"
                style={{ color: "#FF453A" }}
              >
                Top up
              </Link>
            </>
          ) : (
            <>Balance: {balance.toLocaleString()}</>
          )}
        </span>
      )}
    </div>
  );
}
