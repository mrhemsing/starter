import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { getRotationLeaderboard } from "@/lib/data/form-service";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { FORM_CONFIG, HEAT_BANDS, formWindowLabel } from "@/lib/form-tokens";
import { absoluteUrl, canonicalPath, jsonLdScript, largeImageTwitter, websiteOpenGraph } from "@/lib/seo";
import { teamDisplayName, teamLogoUrl } from "@/lib/team-metadata";

const TITLE = "2026 MLB Rotation Rankings";
const DESCRIPTION = "Every team's starting rotation, ranked by staff mean Form over the last 5 starts.";
const CANONICAL = canonicalPath("/rotations");

export const revalidate = 900;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: websiteOpenGraph(TITLE, DESCRIPTION, absoluteUrl(CANONICAL)),
  twitter: largeImageTwitter(TITLE, DESCRIPTION),
};

export default async function RotationsPage() {
  const leaderboard = await getRotationLeaderboard({ window: FORM_CONFIG.windowDefault });
  const today = getHomeSlateDate();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: TITLE,
    description: DESCRIPTION,
    url: absoluteUrl(CANONICAL),
    numberOfItems: leaderboard.rows.length,
    itemListElement: leaderboard.rows.map((row) => ({
      "@type": "ListItem",
      position: row.rank,
      item: {
        "@type": "SportsTeam",
        name: teamDisplayName(row.team),
        url: absoluteUrl(`/heat-check?team=${row.team}`),
      },
    })),
  };

  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-10 pt-6 text-zinc-100 sm:px-6 lg:px-8" data-rotation-leaderboard>
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <div className="mx-auto max-w-7xl">
        <SiteHeader active="heat" today={today} />

        <header className="mt-8 grid gap-4 border-b border-white/10 pb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">Rotation leaderboard</p>
            <h1 className="mt-2 font-serif text-4xl font-black leading-none text-zinc-50 sm:text-5xl">{TITLE}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">{DESCRIPTION}</p>
          </div>
          <div className="rounded border border-white/10 bg-[#101014] px-4 py-3 font-mono text-xs uppercase tracking-[0.14em] text-zinc-400">
            <p data-rotation-window>{formWindowLabel(leaderboard.window)}</p>
            <p className="mt-1 text-zinc-500">{leaderboard.formThroughDate ? `Form through ${leaderboard.formThroughDate}` : "Form data loading"}</p>
          </div>
        </header>

        <section className="mt-6 grid gap-3" aria-label="MLB rotation rankings">
          {leaderboard.rows.map((row) => (
            <Link
              key={row.team}
              id={`team-${row.team.toLowerCase()}`}
              href={`/heat-check?team=${row.team}`}
              className="grid scroll-mt-24 gap-4 rounded border border-white/10 bg-[#101014] p-4 transition hover:border-amber-300/40 hover:bg-white/[0.04] md:grid-cols-[76px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-center"
              data-rotation-row
              data-rotation-team={row.team}
              data-rotation-rank={row.rank}
              data-staff-mean-form={row.staffMeanForm ?? "pending"}
            >
              <div className="flex items-baseline gap-2 md:block">
                <span className="font-serif text-4xl font-black leading-none text-zinc-50">#{row.rank}</span>
                {row.smallSample ? <span className="font-mono text-xs uppercase tracking-[0.12em] text-zinc-500">*</span> : null}
              </div>

              <div className="flex min-w-0 items-center gap-3">
                <TeamLogo team={row.team} />
                <div className="min-w-0">
                  <h2 className="truncate font-serif text-2xl font-black leading-tight text-zinc-50">{teamDisplayName(row.team)}</h2>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{row.qualifiedCount} qualified arms</p>
                </div>
              </div>

              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Staff mean Form</p>
                <p className="mt-1 font-mono text-3xl font-black tabular-nums text-amber-200">
                  {row.staffMeanForm === null ? "--" : row.staffMeanForm.toFixed(1)}
                </p>
                {row.smallSample ? (
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">Small staff sample</p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <BandSummary counts={row.bandCounts} />
                <p className="font-mono text-[10px] uppercase leading-4 tracking-[0.12em] text-zinc-500">
                  <span className="block text-zinc-400">Hot arm: {row.hottest?.name ?? "Pending"}</span>
                  <span className="block">Cold arm: {row.coldest?.name ?? "Pending"}</span>
                </p>
              </div>
            </Link>
          ))}
        </section>

        {leaderboard.rows.some((row) => row.smallSample) ? (
          <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500" data-rotation-small-sample-footnote>
            * Small staff sample means fewer than {FORM_CONFIG.minStartsToQualify} qualified arms in the {formWindowLabel(leaderboard.window).toLowerCase()} window.
          </p>
        ) : null}
      </div>
    </main>
  );
}

function TeamLogo({ team }: { team: string }) {
  const logoUrl = teamLogoUrl(team);
  return (
    <span className="grid size-12 shrink-0 place-items-center rounded border border-white/10 bg-white/[0.03]">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="size-9 object-contain" loading="lazy" />
      ) : <span className="font-mono text-xs text-zinc-500">{team}</span>}
    </span>
  );
}

function BandSummary({ counts }: { counts: Record<string, number> }) {
  const visibleBands = HEAT_BANDS.filter((band) => (counts[band.key] ?? 0) > 0);
  if (visibleBands.length === 0) {
    return <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">Bands pending</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5" data-rotation-band-summary>
      {visibleBands.map((band) => (
        <span key={band.key} className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-black/20 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
          <span className="size-2 rounded-full" style={{ backgroundColor: band.color }} aria-hidden="true" />
          {counts[band.key]} {band.label.toLowerCase()}
        </span>
      ))}
    </div>
  );
}
