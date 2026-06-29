"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

type HeatTeamJumpMenuProps = {
  teams: string[];
  activeTeam: string;
  params: Record<string, string | undefined>;
};

export function HeatTeamJumpMenu({ teams, activeTeam, params }: HeatTeamJumpMenuProps) {
  const activeLabel = activeTeam ? teamDisplayName(activeTeam) : "All teams";
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => {
    if (detailsRef.current) detailsRef.current.open = false;
  };

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (!details?.open) return;
      if (event.target instanceof Node && details.contains(event.target)) return;
      details.open = false;
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div className="inline-block max-w-full" data-responsive-check="heat-team-jump-menu">
      <div className="block max-w-full">
        <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Team</span>
        <details ref={detailsRef} className="group relative z-[70] w-full sm:w-auto sm:max-w-full" data-team-jump-details>
          <summary
            className="flex min-h-11 w-full cursor-pointer list-none items-center justify-between gap-4 rounded border border-amber-300/70 bg-black/20 px-3 py-2 font-mono text-xs uppercase tracking-[0.12em] text-amber-300 outline-none transition hover:border-amber-300 hover:bg-amber-300/10 focus-visible:ring-2 focus-visible:ring-amber-300/40 sm:w-auto [&::-webkit-details-marker]:hidden"
            aria-label="Jump to Heat Check team"
          >
            <span className="flex min-w-0 items-center gap-2">
              <TeamLogo team={activeTeam} />
              <span className="truncate">{activeLabel}</span>
            </span>
            <span className="shrink-0 text-[10px]">▾</span>
          </summary>
          <div
            className="absolute left-0 top-[calc(100%+6px)] z-[80] grid max-h-[360px] w-[min(32rem,calc(100vw-2rem))] gap-1 overflow-y-auto rounded border border-amber-300 bg-[#101014] p-2 shadow-2xl shadow-black/40"
            role="menu"
            aria-label="Heat Check teams"
            data-team-jump-list
          >
            <TeamMenuLink active={!activeTeam} href={heatCheckHref({ ...params, team: "" })} team="" label="All teams" onSelect={closeMenu} />
            {teams.map((team) => (
              <TeamMenuLink key={team} active={activeTeam === team} href={heatCheckHref({ ...params, team })} team={team} label={teamDisplayName(team)} onSelect={closeMenu} />
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

function TeamMenuLink({ active, href, team, label, onSelect }: { active: boolean; href: string; team: string; label: string; onSelect: () => void }) {
  return (
    <Link
      href={href}
      className={`flex min-h-11 items-center gap-3 rounded border px-3 py-2 text-left transition ${
        active ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 bg-black/30 text-zinc-200 hover:border-amber-300/60 hover:text-amber-200"
      }`}
      role="menuitem"
      data-team-jump-link
      data-team={team || "all"}
      aria-current={active ? "page" : undefined}
      onClick={onSelect}
    >
      <TeamLogo team={team} active={active} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-xs uppercase tracking-[0.12em]">{label}</span>
        {team ? <span className={`mt-0.5 block font-mono text-[10px] uppercase tracking-[0.14em] ${active ? "text-zinc-800" : "text-zinc-500"}`}>{team}</span> : null}
      </span>
    </Link>
  );
}

function TeamLogo({ team, active = false }: { team: string; active?: boolean }) {
  const meta = teamMeta(team);
  if (!meta) return null;

  return (
    <span className={`grid size-7 shrink-0 place-items-center rounded-full border p-1 ${active ? "border-zinc-950/20 bg-white" : "border-white/10 bg-white"}`}>
      <span className="block size-6 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(https://www.mlbstatic.com/team-logos/${meta.id}.svg)` }} aria-hidden="true" />
    </span>
  );
}

function heatCheckHref(values: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value && !(key === "window" && value === "5")) searchParams.set(key, value);
  }
  const query = searchParams.toString();
  return `/heat-check${query ? `?${query}` : ""}`;
}

function teamDisplayName(team: string) {
  return teamMeta(team)?.name ?? team;
}

function teamMeta(team: string) {
  return MLB_TEAMS[team.toUpperCase()] ?? null;
}

const MLB_TEAMS: Record<string, { id: number; name: string }> = {
  ARI: { id: 109, name: "Arizona Diamondbacks" },
  AZ: { id: 109, name: "Arizona Diamondbacks" },
  ATL: { id: 144, name: "Atlanta Braves" },
  BAL: { id: 110, name: "Baltimore Orioles" },
  BOS: { id: 111, name: "Boston Red Sox" },
  CHC: { id: 112, name: "Chicago Cubs" },
  CWS: { id: 145, name: "Chicago White Sox" },
  CHW: { id: 145, name: "Chicago White Sox" },
  CIN: { id: 113, name: "Cincinnati Reds" },
  CLE: { id: 114, name: "Cleveland Guardians" },
  COL: { id: 115, name: "Colorado Rockies" },
  DET: { id: 116, name: "Detroit Tigers" },
  HOU: { id: 117, name: "Houston Astros" },
  KC: { id: 118, name: "Kansas City Royals" },
  KCR: { id: 118, name: "Kansas City Royals" },
  LAA: { id: 108, name: "Los Angeles Angels" },
  LAD: { id: 119, name: "Los Angeles Dodgers" },
  MIA: { id: 146, name: "Miami Marlins" },
  MIL: { id: 158, name: "Milwaukee Brewers" },
  MIN: { id: 142, name: "Minnesota Twins" },
  NYM: { id: 121, name: "New York Mets" },
  NYY: { id: 147, name: "New York Yankees" },
  OAK: { id: 133, name: "Oakland Athletics" },
  ATH: { id: 133, name: "Athletics" },
  PHI: { id: 143, name: "Philadelphia Phillies" },
  PIT: { id: 134, name: "Pittsburgh Pirates" },
  SD: { id: 135, name: "San Diego Padres" },
  SDP: { id: 135, name: "San Diego Padres" },
  SEA: { id: 136, name: "Seattle Mariners" },
  SF: { id: 137, name: "San Francisco Giants" },
  SFG: { id: 137, name: "San Francisco Giants" },
  STL: { id: 138, name: "St. Louis Cardinals" },
  TB: { id: 139, name: "Tampa Bay Rays" },
  TBR: { id: 139, name: "Tampa Bay Rays" },
  TEX: { id: 140, name: "Texas Rangers" },
  TOR: { id: 141, name: "Toronto Blue Jays" },
  WSH: { id: 120, name: "Washington Nationals" },
  WSN: { id: 120, name: "Washington Nationals" },
};
