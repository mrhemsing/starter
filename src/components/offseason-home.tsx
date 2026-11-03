import Link from "next/link";
import { getSeasonArchive } from "@/lib/data/season-archive-service";
import { SeasonReviewHeader, SeasonReviewHero, SeasonReviewTopStarts, SeasonReviewFinalForm } from "@/components/season-review";
import { seasonReview2026 as review } from "@/lib/season-review-data";
import type { SeasonState } from "@/lib/season-state";

export async function OffseasonHome({ state }: { state: SeasonState }) {
  const archive = await getSeasonArchive(state.year);
  return <main className="min-h-screen bg-[#08080a] px-4 py-6 text-zinc-100 sm:px-6 lg:px-8" data-season-complete="home" data-season={state.year}>
    <div className="mx-auto max-w-7xl"><SeasonReviewHeader review={review} /><p className="mt-4 text-sm text-zinc-400" data-final-slate>{archive.label}: <Link className="text-amber-300 underline" href={`/starts/${archive.finalSlateDate}`}>{archive.finalSlateDate}</Link> · Includes postseason</p><SeasonReviewHero review={review} landing /><SeasonReviewTopStarts review={review} limit={5} /><SeasonReviewFinalForm review={review} /></div>
  </main>;
}
