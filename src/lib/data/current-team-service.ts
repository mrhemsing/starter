import { getSeasonState, type SeasonState } from "@/lib/season-state";
import { MLB_TEAMS } from "@/lib/team-metadata";
import { readCachedRuntimeState, readRuntimeState, writeRuntimeState } from "@/lib/data/runtime-state-store";

export const CURRENT_TEAMS_KEY = "pitcher-current-teams";
export type TeamAssignment = { team: string; checkedAt: string; note?: string; previousTeam?: string };
export type TeamTransaction = { pitcherId: string; from: string; to: string; detectedAt: string; note: string; headshotRefresh: "spring-refresh-pending" };
export type CurrentTeams = { version: 1; assignments: Record<string, TeamAssignment>; transactions: TeamTransaction[]; checkedAt: string };
export type PitcherIdentity = { pitcherId: string; team: string };
type Person = { id: number; currentTeam?: { id: number; name?: string; parentOrgId?: number } };

export async function readCurrentTeams(): Promise<CurrentTeams | null> {
  if ((await getSeasonState()).status !== "season_complete") return null;
  const value = await readCachedRuntimeState<CurrentTeams>(CURRENT_TEAMS_KEY, 300);
  return value?.version === 1 ? value : null;
}

// Presentation overlay only. Never mutate FormSummary or historical start teams.
export function withCurrentTeam<T extends PitcherIdentity>(pitcher: T, state: CurrentTeams | null): T & { teamChangeNote?: string } {
  const assignment = state?.assignments[pitcher.pitcherId];
  return assignment ? { ...pitcher, team: assignment.team, teamChangeNote: assignment.note } : { ...pitcher };
}

export async function fetchCurrentMlbTeams(ids: string[]): Promise<Person[]> {
  const people: Person[] = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    const url = new URL("https://statsapi.mlb.com/api/v1/people");
    url.searchParams.set("personIds", batch.join(","));
    url.searchParams.set("hydrate", "currentTeam");
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`MLB current teams HTTP ${response.status}`);
    const payload = await response.json() as { people?: Person[] };
    if (!Array.isArray(payload.people) || batch.some((id) => !payload.people!.some((p) => String(p.id) === id))) {
      throw new Error("MLB current teams incomplete batch");
    }
    people.push(...payload.people);
  }
  return people;
}

export async function syncOffseasonCurrentTeams(deps: {
  registry: () => Promise<PitcherIdentity[]>;
  season?: () => Promise<SeasonState>;
  read?: () => Promise<CurrentTeams | null>;
  write?: (state: CurrentTeams) => Promise<boolean>;
  fetchTeams?: (ids: string[]) => Promise<Person[]>;
  now?: () => string;
  log?: (line: string) => void;
}) {
  const log = deps.log ?? console.log;
  if ((await (deps.season ?? getSeasonState)()).status !== "season_complete") {
    log("[offseason-teams] skipped: season not complete");
    return { status: "skipped" as const, checked: 0, changes: [] as TeamTransaction[] };
  }
  try {
    const registry = await deps.registry();
    if (!registry.length) throw new Error("Empty pitcher registry");
    const previous = await (deps.read ?? (() => readRuntimeState<CurrentTeams>(CURRENT_TEAMS_KEY, true)))();
    const people = await (deps.fetchTeams ?? fetchCurrentMlbTeams)(registry.map((p) => p.pitcherId));
    const checkedAt = (deps.now ?? (() => new Date().toISOString()))();
    const assignments = { ...previous?.assignments };
    const changes: TeamTransaction[] = [];
    const unresolved: string[] = [];
    for (const pitcher of registry) {
      const person = people.find((p) => String(p.id) === pitcher.pitcherId);
      const sourceTeam = person?.currentTeam;
      const teamId = sourceTeam?.parentOrgId ?? sourceTeam?.id;
      const team = Object.entries(MLB_TEAMS).find(([, meta]) => meta.id === teamId)?.[0]
        ?? (teamId === 11 ? "FA" : sourceTeam?.name);
      // Missing/non-MLB assignment is not evidence of free agency or a trade.
      if (!team) { unresolved.push(pitcher.pitcherId); continue; }
      const prior = assignments[pitcher.pitcherId];
      const from = prior?.team ?? pitcher.team;
      const changed = (MLB_TEAMS[from]?.id ?? from) !== (MLB_TEAMS[team]?.id ?? team);
      const note = changed ? `Team updated to ${team}` : prior?.note;
      assignments[pitcher.pitcherId] = { team, checkedAt, ...(note ? { note } : {}), ...(changed ? { previousTeam: from } : prior?.previousTeam ? { previousTeam: prior.previousTeam } : {}) };
      if (changed) changes.push({ pitcherId: pitcher.pitcherId, from, to: team, detectedAt: checkedAt, note: note!, headshotRefresh: "spring-refresh-pending" });
    }
    const next: CurrentTeams = { version: 1, assignments, transactions: [...(previous?.transactions ?? []), ...changes], checkedAt };
    const saved = await (deps.write ?? ((value) => writeRuntimeState(CURRENT_TEAMS_KEY, value, true)))(next);
    if (!saved) throw new Error("Current-team state was not durably saved");
    log(`[offseason-teams] ${JSON.stringify({ checked: registry.length, changes, unresolved, checkedAt })}`);
    return { status: "synced" as const, checked: registry.length, changes, unresolved };
  } catch (error) {
    log(`[offseason-teams] unavailable: ${error instanceof Error ? error.message : "unknown error"}`);
    return { status: "unavailable" as const, checked: 0, changes: [] as TeamTransaction[] };
  }
}
