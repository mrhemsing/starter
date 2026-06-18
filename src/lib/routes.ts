import type { SlateRouteParams, SlateWindow } from "@/lib/types";

export const slateWindows: SlateWindow[] = ["yesterday", "today", "tomorrow", "week"];

export function isSlateWindow(value: string): value is SlateWindow {
  return slateWindows.includes(value as SlateWindow);
}

export function startPath(startId: string) {
  return `/starts/${startId}`;
}

export function startShareImagePath(startId: string) {
  return `/starts/${startId}/opengraph-image`;
}

export function pitcherPath(pitcherId: string) {
  return `/pitchers/${pitcherId}`;
}

export type PitcherHrefInput = {
  pitcherId?: string | number | null;
  id?: string | number | null;
  name?: string | null;
  pitcherName?: string | null;
};

export function pitcherSlug(name: string | null | undefined, fallbackId: string | number) {
  const slug = (name ?? "")
    .toLowerCase()
    .replace(/['.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "pitcher"}-${fallbackId}`;
}

export function parsePitcherRouteParam(value: string) {
  const match = value.match(/(\d+)$/);
  return match?.[1] ?? value;
}

export function pitcherHref(pitcher: PitcherHrefInput, params?: Record<string, string | number | null | undefined>) {
  const pitcherId = pitcher.pitcherId ?? pitcher.id;
  if (pitcherId === null || pitcherId === undefined || pitcherId === "") return "/pitchers";

  const name = pitcher.name ?? pitcher.pitcherName;
  const path = `/pitchers/${pitcherSlug(name, pitcherId)}`;
  if (!params) return path;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function slatePath({ window, date }: SlateRouteParams) {
  return `/slate/${window}/${date}`;
}

export function rankedStartsPath(date: string) {
  return `/starts/${date}`;
}

export function heatCheckPath(params?: Record<string, string>) {
  if (!params) return "/heat-check";
  const search = new URLSearchParams(params);
  const query = search.toString();
  return query ? `/heat-check?${query}` : "/heat-check";
}

export function watchlistPath() {
  return "/watchlist";
}

export function upcomingDateHref(date: string) {
  return `/upcoming/${date}`;
}

export function upcomingWeekHref(startDate: string) {
  return `/upcoming/week/${startDate}`;
}

export function duelsPath(date: string) {
  return `/duels/${date}`;
}

export function formatUpcomingDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(parsed);
}

export function apiSlatePath({ window, date }: SlateRouteParams) {
  return `/api/slate/${window}/${date}`;
}

export function apiStartPath(startId: string) {
  return `/api/starts/${startId}`;
}

export function apiPitcherPath(pitcherId: string) {
  return `/api/pitchers/${pitcherId}`;
}
