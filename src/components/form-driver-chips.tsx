import type { FormDriverChip } from "@/lib/types";

export function FormDriverChips({ chips, limit = 3, compact = false }: { chips?: FormDriverChip[]; limit?: number; compact?: boolean }) {
  const shown = (chips ?? []).slice(0, limit);
  if (shown.length === 0) return null;

  return (
    <div className={`flex min-w-0 max-w-full flex-wrap gap-1.5 ${compact ? "mt-2" : "mt-3"}`} aria-label="Form drivers">
      {shown.map((chip) => (
        <span
          key={`${chip.key}-${chip.direction}-${chip.label}`}
          className={`inline-block max-w-full whitespace-normal break-words [overflow-wrap:anywhere] rounded border px-2 py-1 font-mono text-[10px] uppercase leading-tight tracking-[0.1em] ${
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
