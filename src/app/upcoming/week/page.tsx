import type { Metadata } from "next";
import { getDefaultUpcomingDate } from "@/lib/data/start-service";
import { getUpcomingMustWatch } from "@/lib/data/tonight-service";
import { noIndexFollow } from "@/lib/seo";
import { upcomingWeekDescription, upcomingWeekTitle } from "@/lib/upcoming-metadata";
import UpcomingWeekPage from "./[startDate]/page";

export const dynamic = "force-dynamic";

type UpcomingWeekIndexPageProps = {
  searchParams?: Promise<{
    pregame?: string;
    sort?: string;
    team?: string;
  }>;
};

export async function generateMetadata({ searchParams }: UpcomingWeekIndexPageProps): Promise<Metadata> {
  const query = await searchParams;
  const startDate = await getDefaultUpcomingDate();
  const upcoming = await getUpcomingMustWatch({ start: startDate, days: 7, window: 5 });
  const title = upcomingWeekTitle(upcoming.range.start);
  const description = upcomingWeekDescription(upcoming);
  const url = "/upcoming/week";
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

export default async function UpcomingWeekIndexPage({ searchParams }: UpcomingWeekIndexPageProps) {
  const upcomingDate = await getDefaultUpcomingDate();
  return <UpcomingWeekPage params={Promise.resolve({ startDate: upcomingDate })} searchParams={searchParams} />;
}
