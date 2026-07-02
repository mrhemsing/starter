import { resolveTopPerformerImage, type TopPerformerImage } from "@/lib/data/top-performer-image-service";
import { getDailySlate, getHomeSlateDate, getRankedSlateCompletionState, getStartDetail } from "@/lib/data/start-service";
import { formatArsenalEventHeadline, formatArsenalEventSentence } from "@/lib/arsenal-event-copy";
import { formatStartLine } from "@/lib/format";
import { formatPitchEventQualityHeadline, formatPitchEventQualitySentence, summarizePitchEventQuality } from "@/lib/pitch-event-quality";
import { absoluteUrl, formatLongDate } from "@/lib/seo";
import { isRankedRegularStart } from "@/lib/start-classification";
import type { StartLine, StartSummary } from "@/lib/types";

export type DailySocialPlatform = "instagram" | "x";
export type DailySocialRenderVariant = DailySocialPlatform;

export type StartOfDay = {
  date: string;
  gamePk: number;
  pitcherId: number;
  startId: string;
  name: string;
  team: string;
  opponent: string;
  homeAway: "home" | "away";
  line: Pick<StartLine, "inningsPitched" | "hits" | "earnedRuns" | "walks" | "strikeouts">;
  result: "W" | "L" | "ND";
  gsPlus: number;
  arsenalEventHeadline?: string | null;
  arsenalEventSentence?: string | null;
  pitchQualityHeadline?: string | null;
  pitchQualitySentence?: string | null;
  headshotUrl: string;
  image: TopPerformerImage | null;
  renderUrls: Record<DailySocialRenderVariant, string>;
};

export type DailySocialCopy = {
  instagram: string;
  x: string;
  rankingsUrl: string;
};

export type DailySocialPostDraft = {
  status: "ready";
  start: StartOfDay;
  copy: DailySocialCopy;
};

export type DailySocialNoop = {
  status: "noop";
  date: string;
  reason: "invalid-date" | "no-games" | "not-final" | "no-final-starts" | "tie";
  message: string;
  topScore?: number;
  tiedPitchers?: string[];
};

export type DailySocialPostResult = DailySocialPostDraft | DailySocialNoop;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function getDailySocialPostDraft(date = previousDate(getHomeSlateDate())): Promise<DailySocialPostResult> {
  if (!DATE_PATTERN.test(date)) {
    return {
      status: "noop",
      date,
      reason: "invalid-date",
      message: "Date must use YYYY-MM-DD.",
    };
  }

  const completion = await getRankedSlateCompletionState(date);
  if (completion.totalStarts === 0) {
    return {
      status: "noop",
      date,
      reason: "no-games",
      message: "No MLB games were scheduled for this date.",
    };
  }

  if (!completion.isFinal) {
    return {
      status: "noop",
      date,
      reason: "not-final",
      message: `${completion.completedStarts} of ${completion.totalStarts} starts are done. Daily social posts wait for the full slate.`,
    };
  }

  const starts = (await getDailySlate({ window: "today", date })).filter(isRealFinalStart);
  if (starts.length === 0) {
    return {
      status: "noop",
      date,
      reason: "no-final-starts",
      message: "No completed starting-pitcher lines were available for this final slate.",
    };
  }

  const topScore = starts[0].gameScorePlus;
  const tiedStarts = starts.filter((start) => start.gameScorePlus === topScore);
  if (tiedStarts.length > 1) {
    return {
      status: "noop",
      date,
      reason: "tie",
      message: "Multiple starters share the top GS+ score. V1 skips tied days.",
      topScore,
      tiedPitchers: tiedStarts.map((start) => start.pitcher.name),
    };
  }

  const start = starts[0];
  const [detail, image] = await Promise.all([
    getStartDetail(start.id),
    resolveTopPerformerImage(start, null),
  ]);
  const homeAway = detail?.game.awayTeam.abbreviation === start.pitcher.team ? "away" : "home";
  const arsenalEventHeadline = formatArsenalEventHeadline(detail?.arsenalEventSummary);
  const arsenalEventSentence = formatArsenalEventSentence(detail?.arsenalEventSummary);
  const pitchQuality = summarizePitchEventQuality(detail?.pitchEvents ?? []);
  const pitchQualityHeadline = formatPitchEventQualityHeadline(pitchQuality);
  const pitchQualitySentence = formatPitchEventQualitySentence(pitchQuality);
  const startOfDay: StartOfDay = {
    date,
    gamePk: start.gamePk,
    pitcherId: start.pitcher.mlbId,
    startId: start.id,
    name: start.pitcher.name,
    team: start.pitcher.team,
    opponent: start.opponent,
    homeAway,
    line: {
      inningsPitched: start.line.inningsPitched,
      hits: start.line.hits,
      earnedRuns: start.line.earnedRuns,
      walks: start.line.walks,
      strikeouts: start.line.strikeouts,
    },
    result: normalizeResult(start.result),
    gsPlus: start.gameScorePlus,
    arsenalEventHeadline,
    arsenalEventSentence,
    pitchQualityHeadline,
    pitchQualitySentence,
    headshotUrl: start.pitcher.headshotUrl,
    image,
    renderUrls: {
      instagram: absoluteUrl(dailySocialImagePath(date, "instagram")),
      x: absoluteUrl(dailySocialImagePath(date, "x")),
    },
  };

  return {
    status: "ready",
    start: startOfDay,
    copy: buildDailySocialCopy(startOfDay),
  };
}

export function dailySocialImagePath(date: string, variant: DailySocialRenderVariant) {
  return `/social/start-of-day/${date}/${variant}`;
}

export function dailySocialPreviewPath(date: string) {
  return `/admin/daily-post?date=${date}`;
}

export function buildDailySocialCopy(start: StartOfDay): DailySocialCopy {
  const dateLabel = formatLongDate(start.date);
  const line = formatDailySocialLine(start.line);
  const matchup = `${start.team} vs ${start.opponent}`;
  const rankingsUrl = absoluteUrl(`/starts/${start.date}`);

  return {
    instagram: [
      `${start.name} is Toe the Slab's Start of the Day for ${dateLabel}.`,
      "",
      `${matchup} | ${line} | ${start.gsPlus} GS+`,
      start.arsenalEventSentence ?? null,
      start.pitchQualitySentence ?? null,
      "",
      "Full daily ranked starts board at toetheslab.com.",
      "",
      "#MLB #Baseball #StartingPitching #Pitching #ToeTheSlab #GSPlus",
    ].join("\n"),
    x: `${start.name}: Start of the Day. ${line}. ${start.gsPlus} GS+.${start.arsenalEventHeadline ? ` ${start.arsenalEventHeadline}.` : ""}${start.pitchQualityHeadline ? ` ${start.pitchQualityHeadline}.` : ""}`,
    rankingsUrl,
  };
}

export function formatDailySocialLine(line: Pick<StartLine, "inningsPitched" | "hits" | "earnedRuns" | "walks" | "strikeouts">) {
  return formatStartLine({ ...line, pitches: 0 });
}

function isRealFinalStart(start: StartSummary) {
  return start.source?.line !== "fixture" && isRankedRegularStart(start);
}

function normalizeResult(result: string): "W" | "L" | "ND" {
  return result === "W" || result === "L" ? result : "ND";
}

function previousDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
}
