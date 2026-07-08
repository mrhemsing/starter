import { WATCH_SCORE_CONFIDENCE_MIN_QUALIFIED } from "@/lib/watch-score-confidence";
import type { FormSummary, TonightStarter } from "@/lib/types";

export const LIMITED_SAMPLE_FORM_LABEL = "LTD";
export const LIMITED_SAMPLE_FORM_COLOR = "#71717a";

export function qualifiedFormSampleCount(starter: Pick<TonightStarter, "formCompleteness" | "flags" | "windowCount">) {
  return starter.formCompleteness?.matched ?? starter.windowCount ?? (starter.flags?.limitedSample ? 0 : WATCH_SCORE_CONFIDENCE_MIN_QUALIFIED);
}

export function hasQualifiedStarterFormSample(starter: Pick<TonightStarter, "formStatus" | "formCompleteness" | "flags" | "windowCount">) {
  return starter.formStatus === "ok" && !starter.flags?.limitedSample && qualifiedFormSampleCount(starter) >= WATCH_SCORE_CONFIDENCE_MIN_QUALIFIED;
}

export function hasQualifiedFormSummarySample(summary: Pick<FormSummary, "windowCount">) {
  return summary.windowCount >= WATCH_SCORE_CONFIDENCE_MIN_QUALIFIED;
}

export function limitedSampleFormText(value: number | null | undefined) {
  return typeof value === "number" ? `${LIMITED_SAMPLE_FORM_LABEL} ${value.toFixed(1)}` : LIMITED_SAMPLE_FORM_LABEL;
}

export function LimitedSampleFormChip({
  value,
  className = "",
  compact = false,
}: {
  value?: number | null;
  className?: string;
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded border border-zinc-500/40 bg-zinc-500/15 font-mono uppercase tracking-[0.12em] text-zinc-200 ${compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]"} ${className}`}
      data-limited-sample-form-chip
      data-limited-sample-form-color={LIMITED_SAMPLE_FORM_COLOR}
    >
      {limitedSampleFormText(value)}
    </span>
  );
}
