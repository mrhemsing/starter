import { SeasonReviewHeader, SeasonReviewHero, SeasonReviewTopStarts, SeasonReviewFinalForm } from "@/components/season-review";
import { seasonReview2026 as review } from "@/lib/season-review-data";
import type { SeasonState } from "@/lib/season-state";

export function OffseasonHome({ state }: { state: SeasonState }) {
  return <main className="min-h-screen bg-[#08080a] px-4 py-6 text-zinc-100 sm:px-6 lg:px-8" data-season-complete="home" data-season={state.year}>
    <div className="mx-auto max-w-7xl"><SeasonReviewHeader review={review} /><SeasonReviewHero review={review} landing /><SeasonReviewTopStarts review={review} limit={5} /><SeasonReviewFinalForm review={review} /></div>
  </main>;
}
