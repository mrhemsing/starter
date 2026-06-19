"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type HeatTeamDrawerProps = {
  teams: string[];
  activeTeam: string;
  params: Record<string, string | undefined>;
};

export function HeatTeamDrawer({ teams, activeTeam, params }: HeatTeamDrawerProps) {
  const [open, setOpen] = useState(false);
  const closeDrawer = () => setOpen(false);
  const clearTeamHref = heatCheckHref({ ...params, team: "" });

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="sm:hidden" data-responsive-check="heat-team-bottom-drawer">
      <div className="flex items-center gap-2" data-responsive-check="heat-team-picker-row">
        <button
          type="button"
          className="flex min-h-11 min-w-0 flex-1 items-center justify-between rounded border border-amber-300/70 bg-black/20 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-amber-300"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className="flex min-w-0 items-center gap-2">
            <TeamLogo team={activeTeam} />
            <span className="truncate">{activeTeam ? teamDisplayName(activeTeam) : "All teams"}</span>
          </span>
          <span>Open</span>
        </button>
        {activeTeam ? (
          <Link
            href={clearTeamHref}
            className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded border border-white/10 bg-black/20 font-mono text-xs uppercase tracking-[0.14em] text-amber-300"
            aria-label="Clear team filter"
            data-responsive-check="heat-team-clear"
          >
            {"✕"}
          </Link>
        ) : null}
      </div>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[90] flex items-end bg-black/65 px-3 pb-3 pt-16 backdrop-blur-sm" data-team-drawer-overlay>
              <button className="absolute inset-0 cursor-default" type="button" aria-label="Close team filter" onClick={closeDrawer} />
              <div className="relative max-h-[78vh] w-full overflow-hidden rounded-t border border-white/10 bg-[#101014] shadow-2xl" role="dialog" aria-label="Heat Check team filter">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Teams filter</p>
                    <p className="mt-1 font-serif text-2xl font-bold text-zinc-50">{activeTeam ? teamDisplayName(activeTeam) : "All teams"}</p>
                  </div>
                  <button type="button" className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber-300" onClick={closeDrawer}>
                    Close
                  </button>
                </div>
                <div className="grid max-h-[62vh] grid-cols-1 gap-2 overflow-y-auto p-3">
                  <TeamDrawerLink active={!activeTeam} href={heatCheckHref({ ...params, team: "" })} team="" label="All teams" onSelect={closeDrawer} />
                  {teams.map((candidate) => (
                    <TeamDrawerLink key={candidate} active={activeTeam === candidate} href={heatCheckHref({ ...params, team: candidate })} team={candidate} label={teamDisplayName(candidate)} onSelect={closeDrawer} />
                  ))}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function TeamDrawerLink({ active, href, team, label, onSelect }: { active: boolean; href: string; team: string; label: string; onSelect: () => void }) {
  return (
    <Link
      href={href}
      className={`flex min-h-12 items-center gap-3 rounded border px-3 py-2 ${active ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 bg-black/20 text-zinc-200"}`}
      data-team-drawer-link
      data-team={team || "all"}
      aria-current={active ? "page" : undefined}
      onClick={onSelect}
    >
      <TeamLogo team={team} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-xs uppercase tracking-[0.14em]">{label}</span>
        {team ? <span className={`mt-0.5 block font-mono text-[10px] uppercase tracking-[0.14em] ${active ? "text-zinc-800" : "text-zinc-500"}`}>{team}</span> : null}
      </span>
    </Link>
  );
}

function TeamLogo({ team }: { team: string }) {
  const meta = teamMeta(team);
  if (!meta) return null;

  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white p-1">
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
