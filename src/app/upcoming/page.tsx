import type { Metadata } from "next";
import { getDefaultSlateDates } from "@/lib/data/start-service";
import { noIndexFollow } from "@/lib/seo";
import { upcomingDayTitle } from "@/lib/upcoming-metadata";
import UpcomingDatePage from "./[date]/page";

export const dynamic = "force-dynamic";

type UpcomingIndexPageProps = {
  searchParams?: Promise<{
    pregame?: string;
    sort?: string;
  }>;
};

export async function generateMetadata({ searchParams }: UpcomingIndexPageProps): Promise<Metadata> {
  const query = await searchParams;
  const { upcomingDate: date } = await getDefaultSlateDates();
  const title = upcomingDayTitle(date);
  const description = `Probable starting pitchers and pitching matchups for ${date}, ranked by watch score, starter form, pairing quality, and matchup context.`;
  const url = "/upcoming";
  const image = `${url}/opengraph-image`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    robots: query && Object.keys(query).length > 0 ? noIndexFollow() : undefined,
    openGraph: {
      title,
      description,
      type: "website",
      url,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: image, alt: title }],
    },
  };
}

export default async function UpcomingPage({ searchParams }: UpcomingIndexPageProps) {
  const { upcomingDate } = await getDefaultSlateDates();
  return <UpcomingDatePage params={Promise.resolve({ date: upcomingDate })} searchParams={searchParams} />;
}
