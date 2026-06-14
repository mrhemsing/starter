import type { TonightGame, TonightResponse, UpcomingResponse } from "@/lib/types";
import { watchTierOf } from "@/lib/form-tokens";
import { formatUpcomingDate, upcomingDateHref, upcomingWeekHref } from "@/lib/routes";
import { absoluteUrl } from "@/lib/seo";

type StarterWithIdentity = TonightGame["starters"][number] & { name: string; pitcherId: string };

export function upcomingDayTitle(date: string) {
  return `MLB Probable Pitchers & Matchups - ${formatUpcomingDate(date)}`;
}

export function upcomingDayDescription(upcoming: Pick<TonightResponse, "date" | "scheduledGames" | "games">) {
  const topGame = upcoming.games[0];
  const lead = topGame ? `Top watch: ${topGame.label} with a ${topGame.gameWatchScore.toFixed(1)} watch score.` : "Probable starter watch list will update as starters are named.";
  return `Probable starting pitchers and pitching matchups for ${formatUpcomingDate(upcoming.date)}, ranked by watch score: top arms, pairing quality, and matchup context. ${lead}`;
}

export function upcomingWeekTitle(startDate: string) {
  return `MLB Probable Pitchers - Week of ${formatUpcomingDate(startDate)}`;
}

export function upcomingWeekDescription(upcoming: Pick<UpcomingResponse, "range" | "days">) {
  const games = upcoming.days.flatMap((day) => day.games);
  const topGame = games.reduce<TonightGame | null>(
    (best, game) => (!best || game.gameWatchScore > best.gameWatchScore ? game : best),
    null,
  );
  const lead = topGame ? `Top watch: ${topGame.label} at ${topGame.gameWatchScore.toFixed(1)}.` : "Updates as probable starters are named.";
  return `${games.length} upcoming MLB games from ${formatUpcomingDate(upcoming.range.start)} to ${formatUpcomingDate(upcoming.range.end)}, ranked by starter form and matchup context. ${lead}`;
}

export function jsonLdForUpcomingDay(upcoming: TonightResponse) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: upcomingDayTitle(upcoming.date),
    description: upcomingDayDescription(upcoming),
    numberOfItems: upcoming.games.length,
    itemListElement: upcoming.games.slice(0, 10).map((game, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteSiteUrl(upcomingDateHref(upcoming.date)),
      item: jsonLdForUpcomingGame(game),
    })),
  };
}

export function jsonLdForUpcomingWeek(upcoming: UpcomingResponse) {
  const games = upcoming.days.flatMap((day) => day.games.map((game) => ({ day: day.date, game })));

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: upcomingWeekTitle(upcoming.range.start),
    description: upcomingWeekDescription(upcoming),
    numberOfItems: games.length,
    itemListElement: games.slice(0, 20).map(({ day, game }, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteSiteUrl(upcomingWeekHref(upcoming.range.start)),
      item: jsonLdForUpcomingGame({ ...game, date: day }),
    })),
  };
}

function jsonLdForUpcomingGame(game: TonightGame) {
  const watchTier = watchTierOf(game.gameWatchScore);
  const starters = game.starters
    .filter(hasStarterIdentity)
    .map((starter) => ({
      "@type": "Person",
      name: starter.name,
      identifier: starter.pitcherId,
      url: absoluteSiteUrl(`/pitchers/${starter.pitcherId}/form`),
      image: starterHeadshotUrl(starter.pitcherId),
      memberOf: { "@type": "SportsTeam", name: starter.team },
    }));

  return {
    "@type": "SportsEvent",
    name: game.label,
    url: absoluteSiteUrl(upcomingDateHref(game.date)),
    startDate: game.firstPitch,
    eventStatus: eventStatusForGame(game.status),
    location: game.park ? { "@type": "Place", name: game.park } : undefined,
    competitor: [
      { "@type": "SportsTeam", name: game.away },
      { "@type": "SportsTeam", name: game.home },
      ...starters,
    ],
    additionalProperty: [
      { "@type": "PropertyValue", name: "Watch Score", value: game.gameWatchScore },
      { "@type": "PropertyValue", name: "Watch Tier", value: watchTier.label },
      { "@type": "PropertyValue", name: "Matchup Score", value: game.matchupScore },
      { "@type": "PropertyValue", name: "Matchup Rank", value: game.matchupRankTonight },
    ],
  };
}

function hasStarterIdentity(starter: TonightGame["starters"][number]): starter is StarterWithIdentity {
  return Boolean(starter.name && starter.pitcherId);
}

function absoluteSiteUrl(path: string) {
  return absoluteUrl(path);
}

function starterHeadshotUrl(pitcherId: string) {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_100,q_auto:best/v1/people/${pitcherId}/headshot/67/current`;
}

function eventStatusForGame(status: TonightGame["status"]) {
  if (status === "ppd") return "https://schema.org/EventPostponed";
  if (status === "live") return "https://schema.org/EventInProgress";
  return "https://schema.org/EventScheduled";
}
