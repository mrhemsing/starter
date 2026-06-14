import type { StartLine } from "@/lib/types";

export function formatStartLine(line: StartLine) {
  return `${line.inningsPitched.toFixed(1)} IP, ${line.hits} H, ${line.earnedRuns} ER, ${line.walks} BB, ${line.strikeouts} K`;
}

export function formatSigned(value: number, suffix = "") {
  const rounded = Math.round(value * 10) / 10;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  const sign = normalized > 0 ? "+" : "";
  const formatted = Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1);
  return `${sign}${formatted}${suffix}`;
}

export function formatPct(value: number) {
  return formatSigned(value, "%");
}
