export const ROUTE_DATE_WINDOW = {
  timeZone: "America/Los_Angeles",
  seasonStartMonthIndex: 2,
  seasonStartDay: 1,
  seasonStartGraceDays: 7,
  futureDays: 14,
} as const;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDateRouteParam(value: string) {
  return ISO_DATE_PATTERN.test(value);
}

export function isValidDateRouteParam(value: string, now = new Date()) {
  if (!isRealIsoDate(value)) return false;
  const currentRouteDate = formatRouteDate(now);
  const currentYear = Number(currentRouteDate.slice(0, 4));
  const currentMonth = Number(currentRouteDate.slice(5, 7));
  const seasonYear = currentMonth <= ROUTE_DATE_WINDOW.seasonStartMonthIndex ? currentYear - 1 : currentYear;
  const windowStart = addUtcDays(
    `${seasonYear}-${String(ROUTE_DATE_WINDOW.seasonStartMonthIndex + 1).padStart(2, "0")}-${String(ROUTE_DATE_WINDOW.seasonStartDay).padStart(2, "0")}`,
    -ROUTE_DATE_WINDOW.seasonStartGraceDays,
  );
  const windowEnd = addUtcDays(currentRouteDate, ROUTE_DATE_WINDOW.futureDays);
  return value >= windowStart && value <= windowEnd;
}

function isRealIsoDate(value: string) {
  if (!isIsoDateRouteParam(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function formatRouteDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: ROUTE_DATE_WINDOW.timeZone,
    year: "numeric",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addUtcDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
