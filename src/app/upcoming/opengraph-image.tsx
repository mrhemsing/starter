import { getDefaultSlateDates } from "@/lib/data/start-service";
import Image from "./[date]/opengraph-image";

export const alt = "Front Five upcoming starter watch card";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function UpcomingIndexImage() {
  const { upcomingDate } = await getDefaultSlateDates();
  return Image({ params: Promise.resolve({ date: upcomingDate }) });
}
