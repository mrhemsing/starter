import type { Metadata } from "next";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { getUpcomingMustWatch } from "@/lib/data/tonight-service";
import { upcomingWeekDescription, upcomingWeekTitle } from "@/lib/upcoming-metadata";
import UpcomingWeekPage from "./[startDate]/page";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const startDate = getHomeSlateDate();
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

export default function UpcomingWeekIndexPage() {
  return <UpcomingWeekPage params={Promise.resolve({ startDate: getHomeSlateDate() })} />;
}
