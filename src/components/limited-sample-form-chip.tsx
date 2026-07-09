import { HEAT_BANDS, FORM_CONFIG } from "@/lib/form-tokens";
import { WATCH_SCORE_CONFIDENCE_MIN_QUALIFIED } from "@/lib/watch-score-confidence";
import type { FormSummary, FormTier, TonightStarter } from "@/lib/types";

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

export function formBandWhisperLabel(tier: FormTier | null | undefined, qualifiedSample: boolean) {
  if (!qualifiedSample) return LIMITED_SAMPLE_FORM_LABEL;
  return HEAT_BANDS.find((candidate) => candidate.key === tier)?.label ?? "FORM";
}

export function formBandValueColor(tier: FormTier | null | undefined, qualifiedSample: boolean) {
  if (!qualifiedSample) return LIMITED_SAMPLE_FORM_COLOR;
  return HEAT_BANDS.find((candidate) => candidate.key === tier)?.color ?? "#888780";
}

export function formLineEraText(era: number | null | undefined, window: number = FORM_CONFIG.windowDefault) {
  return `${typeof era === "number" ? era.toFixed(2) : "--"} L${window} ERA`;
}

export function FormValueWhisperLine({
  value,
  tier,
  qualifiedSample,
  era,
  window = FORM_CONFIG.windowDefault,
  className = "",
  valueClassName = "",
  whisperClassName = "",
  compact = false,
  stacked = false,
}: {
  value?: number | null;
  tier?: FormTier | null;
  qualifiedSample: boolean;
  era?: number | null;
  window?: number;
  className?: string;
  valueClassName?: string;
  whisperClassName?: string;
  compact?: boolean;
  stacked?: boolean;
}) {
  const valueColor = formBandValueColor(tier, qualifiedSample);
  const whisper = formBandWhisperLabel(tier, qualifiedSample);
  if (stacked) {
    return (
      <span
        className={`inline-flex flex-col items-start font-mono uppercase tracking-[0.12em] ${compact ? "text-[9px]" : "text-[11px]"} ${className}`}
        data-form-value-whisper-line
        data-form-value-whisper-layout="stacked"
        data-form-value-color={valueColor}
        data-form-whisper={whisper}
        data-form-window={window}
      >
        <span className={`font-semibold tabular-nums ${valueClassName}`} style={{ color: valueColor }} data-form-colored-value>
          {typeof value === "number" ? value.toFixed(1) : "--"}
        </span>
        <span className={`mt-0.5 text-zinc-500 ${whisperClassName}`} data-form-band-whisper>
          {whisper}
        </span>
        <span className="mt-0.5 text-zinc-500" data-form-line-era>
          {formLineEraText(era, window)}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex flex-wrap items-baseline gap-x-1.5 font-mono uppercase tracking-[0.12em] ${compact ? "text-[9px]" : "text-[11px]"} ${className}`}
      data-form-value-whisper-line
      data-form-value-color={valueColor}
      data-form-whisper={whisper}
      data-form-window={window}
    >
      <span className={`font-semibold tabular-nums ${valueClassName}`} style={{ color: valueColor }} data-form-colored-value>
        {typeof value === "number" ? value.toFixed(1) : "--"}
      </span>
      <span className={`text-zinc-500 ${whisperClassName}`} data-form-band-whisper>
        {whisper}
      </span>
      <span className="text-zinc-500" data-form-line-era>
        · {formLineEraText(era, window)}
      </span>
    </span>
  );
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
