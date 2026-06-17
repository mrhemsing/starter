import Link from "next/link";
import type { Metadata } from "next";
import type React from "react";
import { ScoreExplainer } from "@/components/score-explainer";
import { SiteNav } from "@/components/site-nav";
import { getDailySlate, getHomeSlateDate, summarizeSlateScoreScale } from "@/lib/data/start-service";
import { rankedStartsPath } from "@/lib/routes";
import { jsonLdScript, websiteOpenGraph, largeImageTwitter } from "@/lib/seo";

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
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-white/10 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="font-mono text-2xl uppercase tracking-[0.18em] text-amber-300">Toe the Slab</Link>
            <SiteNav active="starts" today={today} rankedDate={rankedDate} />
          </div>
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
            Raw GS+ starts at 45, adds length and strikeouts, subtracts runs, hits, and walks, then applies context and a 20-80 display transform.
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
            <FormulaItem label="Park context" value="(1.00 - run factor) x 12" />
            <FormulaItem label="Display transform" value="50 + (raw - 59) x 0.72, capped 20-80" />
          </dl>
          <p className="mt-3 text-xs leading-5 text-zinc-500">Completed starts use line, park, opponent, and verified pitch-event context when available. Upcoming cards use MLB team hitting splits vs the starter&apos;s handedness for OPS, K%, BB%, and ISO matchup context.</p>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <MethodCard title="GS+" id="gs-plus">
            GS+ scores a single completed start on a 0-100 style scale, with league-average work around 50. It starts with the pitcher&apos;s line, then adjusts for workload, traffic, runs, strikeouts, walks, park, opponent, and slate context. Daily boards rank qualified starts of at least 3.0 IP; openers and short outings are listed separately.
          </MethodCard>
          <MethodCard title="Form" id="form">
            Form is a rolling view of recent GS+ across a pitcher&apos;s qualified starts. Heat Check bands highlight starters who are running above, near, or below their recent baseline.
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
