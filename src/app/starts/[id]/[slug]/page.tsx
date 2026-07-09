import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RawGsPlusLine } from "@/components/gs-plus-score";
import { SiteHeader } from "@/components/site-header";
import { formatArsenalEventSentence } from "@/lib/arsenal-event-copy";
import { getRankedStartsPageData } from "@/lib/data/ranked-starts-page-service";
import { getHomeSlateDate, getStartDetail } from "@/lib/data/start-service";
import { formatStartLine } from "@/lib/format";
import { formatPitchEventQualitySentence, summarizePitchEventQuality } from "@/lib/pitch-event-quality";
import { pitcherHref, rankedStartsPath, sourceParams, startHref, startRecapPath, startRecapSlug } from "@/lib/routes";
import { assertValidDateRouteParam } from "@/lib/route-date-response";
import { isIsoDateRouteParam } from "@/lib/route-date-validation";
import { absoluteUrl, formatLongDate, formatShortDate, jsonLdScript } from "@/lib/seo";
import { startMatchupLabel } from "@/lib/start-matchup-label";
import type { StartDetail, StartSummary } from "@/lib/types";

type StartRecapPageProps = {
  params: Promise<{
    id: string;
    slug: string;
  }>;
};

export async function generateMetadata({ params }: StartRecapPageProps): Promise<Metadata> {
  const { id: date, slug } = await params;
  if (isIsoDateRouteParam(date)) assertValidDateRouteParam(date);
  const resolved = await resolveStartRecap(date, slug);

  if (!resolved) {
    return {
      title: "Start Recap",
      description: "Single-start MLB pitching recap from Toe the Slab.",
    };
  }

  const { start, canonicalPath } = resolved;
  const title = `${start.pitcher.name} start recap - ${formatShortDate(start.date)} GS+ ${start.gameScorePlus}`;
  const arsenalSentence = formatArsenalEventSentence(start.arsenalEventSummary);
  const qualitySentence = formatPitchEventQualitySentence(summarizePitchEventQuality(start.pitchEvents));
  const description = [
    `${start.pitcher.name} ${startMatchupLabel(start)}: ${formatStartLine(start.line)}. GS+ ${start.gameScorePlus}, GSv2 ${start.gameScoreV2 ?? "pending"}, decision ${formatDecision(start.result)}.`,
    arsenalSentence,
    qualitySentence,
  ].filter(Boolean).join(" ");

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: "article",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function StartRecapPage({ params }: StartRecapPageProps) {
  const { id: date, slug } = await params;
  if (isIsoDateRouteParam(date)) assertValidDateRouteParam(date);
  const resolved = await resolveStartRecap(date, slug);
  if (!resolved) notFound();

  const { start, canonicalPath, pairedStart } = resolved;
  const today = getHomeSlateDate();
  const summary = recapSummary(start);
  const jsonLd = jsonLdForStartRecap(start, canonicalPath);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-10 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <div className="mx-auto max-w-5xl">
        <SiteHeader active="starts" today={today} rankedDate={start.date} />
        <header className="mt-6 border-b border-white/10 pb-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Start recap · {formatLongDate(start.date)}</p>
          <div className="mt-3 grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div>
              <h1 className="font-serif text-5xl font-black leading-none text-zinc-50 sm:text-6xl">{start.pitcher.name}</h1>
              <p className="mt-3 font-mono text-sm uppercase tracking-[0.14em] text-zinc-400">
                {startMatchupLabel(start)} · {formatStartLine(start.line)}
              </p>
            </div>
            <div className="md:text-right">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Game Score+</p>
              <p className="font-serif text-7xl font-black leading-none text-amber-300">{start.gameScorePlus}</p>
              <RawGsPlusLine score={start.gameScorePlus} breakdown={start.gameScorePlusBreakdown} className="mt-2" />
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">GSv2 {start.gameScoreV2 ?? "pending"}</p>
            </div>
          </div>
        </header>

        <dl className="grid gap-4 border-b border-white/10 py-6 md:grid-cols-3">
          <Metric label="Decision" value={formatDecision(start.result)} />
          <Metric label="Slate rank" value={`#${start.rank}`} />
          <Metric label="Band" value={start.gameScorePlusBreakdown?.gradeBand.label ?? "GS+"} />
        </dl>

        <section className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <p className="max-w-3xl text-lg leading-8 text-zinc-300">{summary}</p>
            <div className="mt-6 flex flex-wrap gap-2 font-mono text-xs uppercase tracking-[0.14em]">
              <Link href={pitcherHref({ id: start.pitcher.id, name: start.pitcher.name }, sourceParams("starts"))} className="inline-flex min-h-11 items-center rounded border border-amber-300/40 px-3 text-amber-300 hover:bg-amber-300/10">Pitcher page</Link>
              <Link href={rankedStartsPath(start.date)} className="inline-flex min-h-11 items-center rounded border border-white/10 px-3 text-zinc-300 hover:border-white/30">That day ranked starts</Link>
              <Link href={startHref(start, sourceParams("starts"))} className="inline-flex min-h-11 items-center rounded border border-white/10 px-3 text-zinc-300 hover:border-white/30">Full start log</Link>
              {pairedStart ? (
                <Link href={startRecapPath(pairedStart, resolved.slateStarts)} className="inline-flex min-h-11 items-center rounded border border-white/10 px-3 text-zinc-300 hover:border-white/30">Opposing starter recap</Link>
              ) : null}
            </div>
          </div>

          <aside className="rounded border border-white/10 bg-[#101014] p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Canonical line</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 font-mono text-sm">
              <Metric label="IP" value={start.line.inningsPitched.toFixed(1)} compact />
              <Metric label="K" value={String(start.line.strikeouts)} compact />
              <Metric label="ER" value={String(start.line.earnedRuns)} compact />
              <Metric label="BB" value={String(start.line.walks)} compact />
              <Metric label="H" value={String(start.line.hits)} compact />
              <Metric label="Pitches" value={String(start.line.pitches)} compact />
            </dl>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</dt>
      <dd className={`${compact ? "mt-1 text-zinc-100" : "mt-2 font-serif text-2xl font-bold text-zinc-50"}`}>{value}</dd>
    </div>
  );
}

async function resolveStartRecap(date: string, slug: string) {
  if (!isIsoDateRouteParam(date)) return null;
  assertValidDateRouteParam(date);

  const pageData = await getRankedStartsPageData(date);
  const slateStarts = pageData.slateStarts.filter((start) => start.source?.line !== "fixture");
  const match = slateStarts.find((start) => startRecapSlug(start, slateStarts) === slug);
  if (!match) return null;

  const start = await getStartDetail(match.id);
  if (!start) return null;

  return {
    start,
    slateStarts,
    pairedStart: slateStarts.find((candidate) => candidate.gamePk === start.gamePk && candidate.id !== start.id) ?? null,
    canonicalPath: startRecapPath(start, slateStarts),
  };
}

function recapSummary(start: StartDetail) {
  const band = start.gameScorePlusBreakdown?.gradeBand.label.toLowerCase() ?? "graded";
  const decision = formatDecision(start.result).toLowerCase();
  const flags = start.eventFlags ?? [];
  const arsenalSentence = formatArsenalEventSentence(start.arsenalEventSummary);
  const qualitySentence = formatPitchEventQualitySentence(summarizePitchEventQuality(start.pitchEvents));
  const notableSentence = startNarrativeNotableSentence(start);
  const flagSentence = flags.includes("HARD_LUCK")
    ? "The hard-luck tag fits the score and decision."
    : flags.includes("VULTURE")
      ? "The vulture tag marks the decision as context, not ranking credit."
      : "The ranking stays driven by the canonical GS+ line.";

  return `${start.pitcher.name} posted a ${band} start against ${start.opponent}, working ${formatStartLine(start.line)} for GS+ ${start.gameScorePlus}. ${notableSentence ? `${notableSentence} ` : ""}The official decision was ${decision}. ${flagSentence}${arsenalSentence ? ` ${arsenalSentence}` : ""}${qualitySentence ? ` ${qualitySentence}` : ""}`;
}

function startNarrativeNotableSentence(start: StartDetail) {
  const noHit = start.narrativeNotables?.noHitDepth;
  if (noHit?.firstHitInning && noHit.innings >= 8) return `${start.pitcher.name} carried a no-hitter into the ${ordinal(noHit.firstHitInning)}.`;
  if (noHit?.hitlessStintComplete && noHit.innings >= 5) return `${start.pitcher.name} worked ${noHit.innings}.0 hitless innings.`;
  if (start.narrativeNotables?.strikeouts?.doubleDigit) return `${start.pitcher.name} reached double digits with ${start.line.strikeouts} strikeouts.`;
  return null;
}

function ordinal(value: number) {
  if (value === 8) return "eighth";
  if (value === 9) return "ninth";
  return `${value}th`;
}

function formatDecision(result: StartSummary["result"]) {
  if (result === "W") return "Win";
  if (result === "L") return "Loss";
  if (result === "ND") return "No decision";
  return "Pending";
}

function jsonLdForStartRecap(start: StartDetail, canonicalPath: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${start.pitcher.name} start recap, ${startMatchupLabel(start)}`,
    startDate: start.game.date,
    url: absoluteUrl(canonicalPath),
    competitor: [
      { "@type": "SportsTeam", name: start.game.awayTeam.name },
      { "@type": "SportsTeam", name: start.game.homeTeam.name },
    ],
    athlete: {
      "@type": "Person",
      name: start.pitcher.name,
    },
    location: {
      "@type": "Place",
      name: start.game.venue,
    },
  };
}
