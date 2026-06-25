import type { PitcherAvailability } from "@/lib/types";

type PitcherAvailabilityNoteProps = {
  availability?: PitcherAvailability | null;
  compact?: boolean;
  className?: string;
};

export function PitcherAvailabilityNote({ availability, compact = false, className = "" }: PitcherAvailabilityNoteProps) {
  if (!availability) return null;

  if (compact) {
    return (
      <span
        className={`inline-flex max-w-full items-center gap-1.5 rounded border border-rose-400/35 bg-rose-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-rose-200 ${className}`}
        title={availability.blurb}
        data-responsive-check="pitcher-availability-note"
      >
        <span className="font-bold text-rose-100">IL</span>
        <span className="truncate">{availability.blurb}</span>
      </span>
    );
  }

  return (
    <p
      className={`inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded border border-rose-400/35 bg-rose-500/10 px-3 py-2 font-mono text-xs uppercase leading-relaxed tracking-[0.12em] text-rose-100 ${className}`}
      data-responsive-check="pitcher-availability-note"
    >
      <span className="font-bold">IL</span>
      <span>{availability.blurb}</span>
    </p>
  );
}
