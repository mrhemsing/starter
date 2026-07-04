import type { FormDriverChip } from "@/lib/types";
import type React from "react";

export function FormDriverChips({
  chips,
  limit = 3,
  compact = false,
  leading,
  className = "",
  flushTop = false,
}: {
  chips?: FormDriverChip[];
  limit?: number;
  compact?: boolean;
  leading?: React.ReactNode;
  className?: string;
  flushTop?: boolean;
}) {
  const shown = (chips ?? []).slice(0, limit);
  if (shown.length === 0 && !leading) return null;
  const topMargin = flushTop ? "" : compact ? "mt-2" : "mt-3";

  return (
    <div className={`flex min-w-0 max-w-full flex-wrap gap-1.5 ${topMargin} ${className}`} aria-label="Form drivers">
      {leading}
      {shown.map((chip) => (
        <span
          key={`${chip.key}-${chip.direction}-${chip.label}`}
          className={`inline-flex min-h-8 max-w-full items-center whitespace-nowrap rounded border px-2 py-1 font-mono text-[10px] uppercase leading-tight tracking-[0.1em] ${
            chip.direction === "good"
              ? "border-amber-300/30 bg-amber-300/10 text-amber-200"
              : "border-sky-300/30 bg-sky-300/10 text-sky-200"
          }`}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}
