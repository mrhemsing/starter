import { getDefaultUpcomingDate } from "@/lib/data/start-service";
import Image from "./[startDate]/opengraph-image";

export const alt = "Toe the Slab weekly upcoming starter watch card";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function UpcomingWeekIndexImage() {
  const upcomingDate = await getDefaultUpcomingDate();
  return Image({ params: Promise.resolve({ startDate: upcomingDate }) });
}
