import Link from "next/link";
import { SeasonReviewHeader } from "@/components/season-review";
import { seasonReview2026 as review } from "@/lib/season-review-data";

export const dynamic = "force-static";
export const revalidate = false;
export const metadata = { title: "Final 2026 Rotation Standings", alternates: { canonical: "/2026/rotations" } };
export default function FinalRotationStandings() {
  return <main className="min-h-screen bg-[#08080a] px-4 py-6 text-zinc-100 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl">
    <SeasonReviewHeader review={review} />
    <h1 className="my-8 font-serif text-4xl font-black">Final 2026 Rotation Standings</h1>
    <p className="mb-6 text-zinc-400">Final five-start Form, frozen through {review.finalDate}.</p>
    <ol className="divide-y divide-white/10">{review.rotation.map((row) => <li key={row.team} className="grid grid-cols-[40px_1fr_80px] gap-3 py-4"><span>#{row.rank}</span><div><strong>{row.team}</strong><p className="text-xs text-zinc-400">{row.qualifiedCount} qualified arms</p></div><strong className="text-right text-amber-300">{row.staffMeanForm?.toFixed(1) ?? "No sample"}</strong></li>)}</ol>
    <Link href="/2026" className="my-8 inline-flex min-h-11 items-center text-amber-300 underline">Back to 2026 in review</Link>
  </div></main>;
}
