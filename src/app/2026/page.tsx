import { FrozenSeasonGsPlus } from "@/components/frozen-season-gs-plus";
import type { Metadata } from "next";
import { SeasonReviewHeader, SeasonReviewHero, SeasonReviewTopStarts, SeasonReviewAwards } from "@/components/season-review";
import { seasonReview2026 as review } from "@/lib/season-review-data";
import { jsonLdScript } from "@/lib/seo";
import { startRecapPath } from "@/lib/routes";

export const dynamic = "force-static";
export const revalidate = false;
export const metadata: Metadata = {
  title: "2026 Season in Review: Best MLB Starts and Pitching Awards",
  description: "The best MLB starts of 2026, season pitching awards, no-hitter bids and the final GS+ leaderboard.",
  alternates: { canonical: "/2026" },
  openGraph: { type: "article", title: "2026 Season in Review", url: "/2026", description: "Revisit the starts and arms that defined 2026." },
};

export default function SeasonReviewPage() {
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "Article", headline: "2026 Season in Review", datePublished: review.publishedAt, dateModified: review.publishedAt, author: { "@type": "Organization", name: "Toe the Slab" }, publisher: { "@type": "Organization", name: "Toe the Slab" }, mainEntityOfPage: "https://www.toetheslab.com/2026", description: review.copy.intro.text },
    { "@context": "https://schema.org", "@type": "ItemList", name: "Top 25 MLB Starts of 2026", numberOfItems: review.topStarts.length, itemListElement: review.topStarts.map((start, index) => ({ "@type": "ListItem", position: index + 1, name: `${start.pitcher.name}, ${start.date}, ${start.gameScorePlus} GS+`, url: `https://www.toetheslab.com${startRecapPath(start)}` })) },
  ];
  return <main className="min-h-screen bg-[#08080a] px-4 py-6 text-zinc-100 sm:px-6 lg:px-8" data-season-review="2026" data-source-sha256={review.sourceSha256}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
    <div className="mx-auto max-w-7xl">
      <SeasonReviewHeader review={review} /><SeasonReviewHero review={review} /><SeasonReviewTopStarts review={review} /><FrozenSeasonGsPlus /><SeasonReviewAwards review={review} />
      <section className="my-8 text-sm leading-6 text-zinc-400" aria-label="Award methodology">
        <h2 className="font-serif text-2xl text-zinc-100">How the awards work</h2>
        <p>Starts use the site's GS+ ranking and line-based tiebreakers, with a two-inning minimum. Arm of the Year uses the highest unrounded mean GS+ among qualified starters. The shared qualification rule requires one start per {review.qualificationDivisor} team games, rounded up.</p>
        <p className="mt-3">Rotation of the Year uses the existing final rotation calculation: mean five-start Form among eligible arms. Gems are starts at 70-plus GS+. Hottest Streak is the highest mean over five consecutive starts. No-hitter bids include exactly the stored bids reaching six hitless innings.</p>
        <p className="mt-3">All awards use final, frozen 2026 start records through {review.finalDate}. The prose and season snapshot are frozen with this edition.</p>
      </section>
    </div>
  </main>;
}
