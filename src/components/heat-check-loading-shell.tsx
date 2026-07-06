"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type React from "react";

type HeatCheckLoadingShellProps = {
  view: "trend" | "season";
};

const WINDOW_OPTIONS = [3, 5, 10] as const;
const TREND_SORT_OPTIONS = [
  { key: "form", label: "Direction" },
  { key: "risers", label: "Risers" },
  { key: "fallers", label: "Fallers" },
] as const;
const SEASON_SORT_OPTIONS = [
  { key: "season-gs", label: "Season GS+" },
  { key: "gem-rate", label: "Gem rate" },
  { key: "consistency", label: "Consistency" },
  { key: "best-start", label: "Best start" },
] as const;
const DEFAULT_TEAMS = [
  "ARI", "ATL", "BAL", "BOS", "CHC", "CWS", "CIN", "CLE", "COL", "DET",
  "HOU", "KC", "LAA", "LAD", "MIA", "MIL", "MIN", "NYM", "NYY", "ATH",
  "PHI", "PIT", "SD", "SEA", "SF", "STL", "TB", "TEX", "TOR", "WSH",
];

export function HeatCheckLoadingDescription({ view }: HeatCheckLoadingShellProps) {
  const searchParams = useSearchParams();
  const window = readWindow(searchParams);

  if (view === "season") return <>Starting pitchers ranked by season GS+.</>;
  return <>How starting pitchers are trending over up to last {window} qualified starts.</>;
}

export function HeatCheckLoadingControls({ view }: HeatCheckLoadingShellProps) {
  const searchParams = useSearchParams();
  const params = readParams(searchParams, view);
  const window = readWindow(searchParams);
  const team = params.team ?? "";
  const activeSort = view === "season" ? params.sort || "season-gs" : params.sort || "form";

  return (
    <section className="relative z-40 mb-5 mt-4 rounded border border-white/10 bg-[#101014]/95 p-4 backdrop-blur" data-responsive-check="heat-primary-controls" data-navigation-shell-controls="heat-real">
      <div className="grid gap-4" data-responsive-check="heat-team-filter">
        <div className="border-b border-white/10 pb-3">
          <p className="font-mono text-xs uppercase leading-4 tracking-[0.16em] text-zinc-400">
            {view === "season" ? "Season data loading" : "Form data loading"}
          </p>
        </div>
        <div className="hidden sm:flex sm:flex-wrap sm:items-end sm:gap-3">
          <ControlGroup label="View">
            <ControlLink active={view === "trend"} href={heatHref({ ...params, view: "trend", sort: "", show: "", unranked: "" })}>Trend</ControlLink>
            <ControlLink active={view === "season"} href={heatHref({ ...params, view: "season", band: "", motion: "", sort: "", even: "", fire: "", hot: "", cooling: "", ice: "", show: "", unranked: "" })}>Season</ControlLink>
          </ControlGroup>
          <TeamMenu activeTeam={team} params={params} view={view} />
          {team ? <ControlLink active={false} href={heatHref({ ...params, view, team: "" })}>Clear team</ControlLink> : null}
          {view === "trend" ? (
            <div data-responsive-check="heat-desktop-window-controls">
              <ControlGroup label="Window">
                <WindowLinks window={window} params={params} view={view} />
              </ControlGroup>
            </div>
          ) : null}
        </div>
        <div className="grid gap-3 sm:hidden" data-responsive-check="heat-team-mobile-window-controls">
          <ControlGroup label="View">
            <ControlLink active={view === "trend"} href={heatHref({ ...params, view: "trend", sort: "", show: "", unranked: "" })}>Trend</ControlLink>
            <ControlLink active={view === "season"} href={heatHref({ ...params, view: "season", band: "", motion: "", sort: "", even: "", fire: "", hot: "", cooling: "", ice: "", show: "", unranked: "" })}>Season</ControlLink>
          </ControlGroup>
          <MobileTeamMenu activeTeam={team} params={params} view={view} />
          {view === "trend" ? <WindowLinks window={window} params={params} view={view} /> : null}
        </div>
      </div>
      {view === "season" ? (
        <div className="mt-4 flex flex-wrap gap-2" data-responsive-check="heat-season-sort-controls">
          {SEASON_SORT_OPTIONS.map((option) => <ControlLink key={option.key} active={activeSort === option.key} href={heatHref({ ...params, view, sort: option.key, show: "", qualified: "" })}>{option.label}</ControlLink>)}
        </div>
      ) : (
        <details className="mt-4">
          <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.16em] text-amber-300 marker:text-amber-300">
            Filters / {TREND_SORT_OPTIONS.find((option) => option.key === activeSort)?.label ?? "Direction"} / All bands
          </summary>
          <div className="mt-4 grid gap-3">
            <ControlGroup label="Sort">
              {TREND_SORT_OPTIONS.map((option) => <ControlLink key={option.key} active={activeSort === option.key} href={heatHref({ ...params, view, sort: option.key })}>{option.label}</ControlLink>)}
            </ControlGroup>
          </div>
        </details>
      )}
    </section>
  );
}

function WindowLinks({ window, params, view }: { window: number; params: Record<string, string | undefined>; view: "trend" | "season" }) {
  return (
    <div className="flex flex-wrap gap-2" data-responsive-check="heat-window-controls">
      {WINDOW_OPTIONS.map((value) => (
        <ControlLink key={value} active={window === value} href={heatHref({ ...params, view, window: String(value) })}>Last {value}</ControlLink>
      ))}
    </div>
  );
}

function TeamMenu({ activeTeam, params, view }: { activeTeam: string; params: Record<string, string | undefined>; view: "trend" | "season" }) {
  return (
    <div className="inline-block max-w-full" data-responsive-check="heat-team-jump-menu">
      <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Team</span>
      <details className="group relative z-[70] w-full sm:w-auto sm:max-w-full">
        <summary className="flex min-h-11 w-full cursor-pointer list-none items-center justify-between gap-4 rounded border border-amber-300/70 bg-black/20 px-3 py-2 font-mono text-xs uppercase tracking-[0.12em] text-amber-300 outline-none transition hover:border-amber-300 hover:bg-amber-300/10 focus-visible:ring-2 focus-visible:ring-amber-300/40 sm:w-auto [&::-webkit-details-marker]:hidden" aria-label="Jump to Heat Check team">
          <span className="truncate">{activeTeam || "All teams"}</span>
          <span className="shrink-0 text-[10px]">v</span>
        </summary>
        <div className="absolute left-0 top-[calc(100%+6px)] z-[80] grid max-h-[360px] w-[min(32rem,calc(100vw-2rem))] gap-1 overflow-y-auto rounded border border-amber-300 bg-[#101014] p-2 shadow-2xl shadow-black/40" role="menu" aria-label="Heat Check teams">
          <TeamLink active={!activeTeam} href={heatHref({ ...params, view, team: "" })} label="All teams" team="" />
          {DEFAULT_TEAMS.map((team) => <TeamLink key={team} active={activeTeam === team} href={heatHref({ ...params, view, team })} label={team} team={team} />)}
        </div>
      </details>
    </div>
  );
}

function MobileTeamMenu({ activeTeam, params, view }: { activeTeam: string; params: Record<string, string | undefined>; view: "trend" | "season" }) {
  return (
    <details className="sm:hidden" data-responsive-check="heat-team-bottom-drawer">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded border border-amber-300/70 bg-black/20 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-amber-300 [&::-webkit-details-marker]:hidden">
        <span className="truncate">{activeTeam || "All teams"}</span>
        <span>Open</span>
      </summary>
      <div className="mt-2 grid max-h-80 gap-2 overflow-y-auto rounded border border-white/10 bg-black/20 p-2">
        <TeamLink active={!activeTeam} href={heatHref({ ...params, view, team: "" })} label="All teams" team="" />
        {DEFAULT_TEAMS.map((team) => <TeamLink key={team} active={activeTeam === team} href={heatHref({ ...params, view, team })} label={team} team={team} />)}
      </div>
    </details>
  );
}

function TeamLink({ active, href, team, label }: { active: boolean; href: string; team: string; label: string }) {
  return (
    <Link href={href} className={`flex min-h-11 items-center gap-3 rounded border px-3 py-2 text-left transition ${active ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 bg-black/30 text-zinc-200 hover:border-amber-300/60 hover:text-amber-200"}`} role="menuitem" data-team={team || "all"} aria-current={active ? "page" : undefined}>
      <span className="block truncate font-mono text-xs uppercase tracking-[0.12em]">{label}</span>
    </Link>
  );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ControlLink({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={`inline-flex min-h-11 items-center rounded border px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] ${active ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300"}`} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}

function readParams(searchParams: URLSearchParams, view: "trend" | "season") {
  return {
    window: searchParams.get("window") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    team: searchParams.get("team") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    qualified: searchParams.get("qualified") ?? undefined,
    band: searchParams.get("band") ?? undefined,
    motion: searchParams.get("motion") ?? undefined,
    even: searchParams.get("even") ?? undefined,
    fire: searchParams.get("fire") ?? undefined,
    hot: searchParams.get("hot") ?? undefined,
    cooling: searchParams.get("cooling") ?? undefined,
    ice: searchParams.get("ice") ?? undefined,
    show: searchParams.get("show") ?? undefined,
    unranked: searchParams.get("unranked") ?? undefined,
    view,
  };
}

function readWindow(searchParams: URLSearchParams) {
  const value = Number(searchParams.get("window"));
  return WINDOW_OPTIONS.includes(value as (typeof WINDOW_OPTIONS)[number]) ? value : 5;
}

function heatHref(values: Record<string, string | undefined>) {
  const path = values.view === "season" ? "/heat-check/season" : "/heat-check";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (key === "view") continue;
    if (path === "/heat-check/season" && key === "sort" && value === "season-gs") continue;
    if (path === "/heat-check/season" && key === "qualified") continue;
    if (value && !(key === "window" && value === "5")) params.set(key, value);
  }
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`;
}
