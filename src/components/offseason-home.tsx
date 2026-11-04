import { HomeBaseballBackground } from "@/components/home-baseball-background";
import Link from "next/link";
import { getSeasonArchive } from "@/lib/data/season-archive-service";
import { SeasonReviewHeader, SeasonReviewIntro, SeasonReviewHero, SeasonReviewTopStarts, SeasonReviewFinalForm } from "@/components/season-review";
import { seasonReview2026 as review } from "@/lib/season-review-data";
import type { SeasonState } from "@/lib/season-state";

export async function OffseasonHome({ state }: { state: SeasonState }) {
  const archive = await getSeasonArchive(state.year);
  return <main className="min-h-screen bg-[#08080a] text-zinc-100" data-season-complete="home" data-season={state.year}>
    <section className="relative overflow-hidden px-4 pb-6 pt-6 sm:px-6 lg:px-8" data-offseason-header>
      <HomeBaseballBackground />
      <div className="relative z-10 mx-auto max-w-7xl" data-offseason-header-content>
        <SeasonReviewHeader review={review} />
        <p className="mt-4 text-sm text-zinc-400" data-final-slate>{archive.label}: <Link className="text-amber-300 underline" href={`/starts/${archive.finalSlateDate}`}>{archive.finalSlateDate}</Link> · Includes postseason</p>
        <SeasonReviewIntro review={review} landing />
      </div>
    </section>
    <div className="px-4 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><SeasonReviewHero review={review} landing showIntro={false} /><SeasonReviewTopStarts review={review} limit={5} /><SeasonReviewFinalForm review={review} /></div></div>
  </main>;
}
