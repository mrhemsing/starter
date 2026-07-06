import Link from "next/link";
import type { Metadata } from "next";
import type React from "react";
import { ScoreExplainer } from "@/components/score-explainer";
import { SiteHeader } from "@/components/site-header";
import { getDailySlate, getHomeSlateDate, summarizeSlateScoreScale } from "@/lib/data/start-service";
import { rankedStartsPath } from "@/lib/routes";
import { jsonLdScript, websiteOpenGraph, largeImageTwitter } from "@/lib/seo";
import { WATCH_SCORE_CONFIDENCE_MIN_QUALIFIED, WATCH_SCORE_FALLBACK_FORM_HAIRCUT } from "@/lib/watch-score-confidence";

const title = "Methodology - GS+, Form & Watch Scores";
const description = "How Toe the Slab ranks MLB starting pitcher performances, recent form, probable matchups, Heat Check bands, and pitching duels.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/methodology" },
  openGraph: websiteOpenGraph(title, description, "/methodology"),
  twitter: largeImageTwitter(title, description),
};

export default async function MethodologyPage() {
  const today = getHomeSlateDate();
  const rankedDate = addDays(today, -1);
  const starts = (await getDailySlate({ window: "yesterday", date: rankedDate })).filter((start) => start.source?.line !== "fixture");
  const scoreScale = summarizeSlateScoreScale(starts);
  const jsonLd = faqJsonLd();

  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <div className="mx-auto max-w-5xl">
        <header className="pb-6">
          <SiteHeader active="starts" today={today} rankedDate={rankedDate} />
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.22em] text-zinc-500">Methodology</p>
          <h1 className="mt-2 font-serif text-5xl font-black text-zinc-50">GS+, Form, and watch scores</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Toe the Slab turns every start into one comparable score, then uses recent form and matchup context to rank probable starters before first pitch.
          </p>
        </header>

        <section className="mt-6">
          <ScoreExplainer scoreScale={scoreScale} />
        </section>

        <section className="mt-6 rounded border border-white/10 bg-[#101014] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Formula transparency</p>
          <h2 className="mt-1 font-serif text-3xl font-bold text-zinc-50">GS+ component weights</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Raw GS+ starts at 45, adds length and strikeouts, subtracts runs, hits, and walks, then applies context and a public display transform.
          </p>
          <dl className="mt-4 grid gap-2 font-mono text-xs sm:grid-cols-2">
            <FormulaItem label="Baseline" value="+45" />
            <FormulaItem label="Length" value="+3.0 per IP" />
            <FormulaItem label="Strikeouts" value="+2.2 per K" />
            <FormulaItem label="Earned runs" value="-5.0 per ER" />
            <FormulaItem label="Hits" value="-1.2 per H" />
            <FormulaItem label="Walks" value="-1.5 per BB" />
            <FormulaItem label="Whiff context" value="+0.35 per pct point" />
            <FormulaItem label="Velocity context" value="+1.75 per mph" />
            <FormulaItem label="Park context" value="(run factor - 1.00) x 12" />
            <FormulaItem label="Opponent quality" value="team quality run value" />
            <FormulaItem label="Opponent offense" value="offense run value" />
            <FormulaItem label="Display transform" value="50 + (raw - 54.3) x 0.72, capped 20-80" />
            <p className="text-sm leading-6 text-zinc-400">
              The display cap keeps GS+ on the familiar 20-80 scouting scale. When a start reaches the cap, large score surfaces show the frozen raw value beside the displayed 80 so capped starts can still be compared.
            </p>
          </dl>
          <p className="mt-3 text-xs leading-5 text-zinc-500">Completed starts use line, park, opponent, and verified pitch-event context when available. Hitter-friendly parks add context credit for equivalent lines, and pitcher-friendly parks trim it. When a start settles, GS+ freezes with the context available at settle; later league-context updates do not move that final score. Upcoming cards use MLB team hitting splits vs the starter&apos;s handedness for OPS, K%, BB%, and ISO matchup context.</p>
        </section>

        <section className="mt-6 rounded border border-white/10 bg-[#101014] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Change note</p>
          <h2 className="mt-1 font-serif text-3xl font-bold text-zinc-50">July 2 baseline and freeze repair</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Jul 2: exhibition games were removed from the dataset, regular-season archive rows were rebuilt, and league baselines were recalculated. Some recent GS+ scores moved slightly because the regular-season pool is now centered around league average.
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Jul 2: settled starts now freeze GS+ and adjustment context at post-game reconciliation. A one-time season sweep applies that rule to completed starts so final scores stay fixed between polls.
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Jul 4: completed-start GS+ moved to context-v8. Park adjustment now credits equivalent lines in higher run environments and trims equivalent lines in lower run environments. The x12 weight is unchanged; broader calibration remains a separate season-store review.
          </p>
        </section>

        <section className="mt-6 rounded border border-white/10 bg-[#101014] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Calibration bridge</p>
          <h2 className="mt-1 font-serif text-3xl font-bold text-zinc-50">GSv2 beside GS+</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Game Score v2 is the familiar box-score benchmark. It starts at 40, rewards outs and strikeouts, and subtracts hits, walks, and earned runs from the pitcher line. Toe the Slab stores GSv2 on the same canonical start record as GS+ so every page can show the same comparison.
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            The adjustment label is shown as GS+ minus GSv2. Positive adjustment means GS+ liked the start more than the box-score baseline after context; negative adjustment means the context and GS+ components pulled it down. GSv2 uses earned runs from the pitcher line so unearned runs do not corrupt the box-score benchmark.
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            On the homepage ticker, ▲ means a live provisional GS+ is at or above that starter&apos;s pregame projected GS+. ▼ means it is below the projection. If no projection is available, the comparison falls back to league-average 50.
          </p>
          <dl className="mt-4 grid gap-2 font-mono text-xs sm:grid-cols-2">
            <FormulaItem label="GSv2 baseline" value="40" />
            <FormulaItem label="Outs" value="+2 per out" />
            <FormulaItem label="Strikeouts" value="+1 per K" />
            <FormulaItem label="Hits" value="-2 per H" />
            <FormulaItem label="Walks" value="-2 per BB" />
            <FormulaItem label="Earned runs" value="-3 per ER" />
            <FormulaItem label="Adjustment" value="GS+ minus GSv2" />
          </dl>
        </section>

        <section className="mt-6 rounded border border-white/10 bg-[#101014] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Decision context</p>
          <h2 className="mt-1 font-serif text-3xl font-bold text-zinc-50">Hard luck and vulture flags</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Decisions are context, not ranking inputs. A hard-luck flag marks a loss or no-decision with GS+ 60 or better. A vulture flag marks a win with GS+ 35 or worse. The chips exist to explain the story around the line, while the ranked order stays driven by GS+ and its visible line tiebreakers.
          </p>
        </section>

        <section className="mt-6 rounded border border-white/10 bg-[#101014] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Data sources</p>
          <h2 className="mt-1 font-serif text-3xl font-bold text-zinc-50">Strikeout projections and market lines</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Upcoming strikeout projection starts with the pitcher&apos;s season K/9, multiplies it by projected innings, and rounds to one decimal. Projected innings use recent workload when available, fall back to season innings per start, and are capped from 3.5 to 7.5 innings. Likely openers use a 2.0 inning profile.
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            K prop lines come from PropLine or The Odds API snapshots written by cron and read during render. Once a starter&apos;s game begins, the line stops updating and remains the last pre-first-pitch capture. Edges are projection minus line, shown at one decimal, with no pick language or recommendation.
          </p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">
            Lines PropLine or The Odds API · 21+ only. For help call 1-800-GAMBLER
          </p>
        </section>

        <section className="mt-6 rounded border border-white/10 bg-[#101014] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Watch Score Confidence</p>
          <h2 className="mt-1 font-serif text-3xl font-bold text-zinc-50">Limited samples carry a visible tag</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Watch score confidence uses the same recent-start window as form. HIGH means both probable starters have at least {WATCH_SCORE_CONFIDENCE_MIN_QUALIFIED} qualified starts in the payload. MEDIUM means one side is below {WATCH_SCORE_CONFIDENCE_MIN_QUALIFIED}; LOW means both sides are below {WATCH_SCORE_CONFIDENCE_MIN_QUALIFIED}.
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            When a side is below the threshold, that side&apos;s form-derived watch component is multiplied by {WATCH_SCORE_FALLBACK_FORM_HAIRCUT.toFixed(2)} before the game score is composed. The card then shows LIMITED DATA or LOW CONFIDENCE beside the watch score. Baseline projected GS+ values are tagged BASELINE so placeholder-derived values do not read like measured form.
          </p>
          <dl className="mt-4 grid gap-2 font-mono text-xs sm:grid-cols-2">
            <FormulaItem label="Minimum qualified starts" value={String(WATCH_SCORE_CONFIDENCE_MIN_QUALIFIED)} />
            <FormulaItem label="Fallback form multiplier" value={WATCH_SCORE_FALLBACK_FORM_HAIRCUT.toFixed(2)} />
          </dl>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <MethodCard title="GS+" id="gs-plus">
            GS+ scores a single completed start on a 0-100 style scale, with league-average work around 50. It starts with the pitcher&apos;s line, then adjusts for workload, traffic, runs, strikeouts, walks, park, opponent, and slate context. Daily boards rank qualified starts of at least 2.0 IP; openers and short outings are listed separately.
          </MethodCard>
          <MethodCard title="Form" id="form">
            Form is a rolling view of recent GS+ across a pitcher&apos;s qualified starts. Heat Check bands highlight starters who are running above, near, or below their recent baseline.
          </MethodCard>
          <MethodCard title="Season qualification" id="season-qualification">
            Heat Check season rankings require roughly one start per 16 team games played. Arms below that bar remain visible below the leaderboard but do not receive ranked positions.
          </MethodCard>
          <MethodCard title="Watch Score" id="watch-score">
            Watch score ranks probable matchups before the game. It combines the strongest arm in the game, the quality of the pairing, and the matchup context so the best games rise first.
          </MethodCard>
          <MethodCard title="Pitching Duels" id="duels">
            Duel scoring rewards games where both starters bring strong current form. Mismatch scoring highlights games with the largest gap between the two probable starters.
          </MethodCard>
        </section>

        <section className="mt-6 rounded border border-white/10 bg-[#101014] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Start here</p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-zinc-50">Latest ranked starts</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            The daily leaderboard is the canonical archive for completed starts and links each ranked line to its start log, pitcher page, and score breakdown.
          </p>
          <Link href={rankedStartsPath(rankedDate)} className="mt-4 inline-flex min-h-11 items-center rounded border border-amber-300/40 px-3 font-mono text-xs uppercase tracking-[0.16em] text-amber-300">
            View ranked starts
          </Link>
        </section>
      </div>
    </main>
  );
}

function FormulaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded border border-white/10 bg-black/25 px-3 py-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right text-zinc-100">{value}</dd>
    </div>
  );
}

function MethodCard({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="rounded border border-white/10 bg-[#101014] p-5">
      <h2 className="font-serif text-3xl font-bold text-zinc-50">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-zinc-400">{children}</p>
    </section>
  );
}

function faqJsonLd() {
  const questions = [
    {
      name: "What is GS+?",
      acceptedAnswer: "GS+ is Toe the Slab's single-start score for MLB starting pitchers. It combines line quality, workload, run prevention, strikeouts, walks, park, opponent, and slate context.",
    },
    {
      name: "What does Heat Check measure?",
      acceptedAnswer: "Heat Check ranks qualified starters by recent rolling GS+ form and separates them into bands from on fire to ice.",
    },
    {
      name: "How are probable matchups ranked?",
      acceptedAnswer: "Upcoming games are ranked by watch score, which combines the top arm, starter pairing quality, and matchup context.",
    },
  ];

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((question) => ({
      "@type": "Question",
      name: question.name,
      acceptedAnswer: {
        "@type": "Answer",
        text: question.acceptedAnswer,
      },
    })),
  };
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
