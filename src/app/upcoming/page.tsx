import type { Metadata } from "next";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { getTonightMustWatch } from "@/lib/data/tonight-service";
import { upcomingDayDescription, upcomingDayTitle } from "@/lib/upcoming-metadata";
import UpcomingDatePage from "./[date]/page";

export async function generateMetadata(): Promise<Metadata> {
  const date = getHomeSlateDate();
  const upcoming = await getTonightMustWatch({ date, window: 5 });
  const title = upcomingDayTitle(upcoming.date);
  const description = upcomingDayDescription(upcoming);
  const url = "/upcoming";
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

export default function UpcomingPage() {
  return <UpcomingDatePage params={Promise.resolve({ date: getHomeSlateDate() })} />;
}
