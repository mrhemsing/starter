import { getHomeSlateDate } from "@/lib/data/start-service";
import Image from "./[startDate]/opengraph-image";

export const alt = "Front Five weekly upcoming starter watch card";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default function UpcomingWeekIndexImage() {
  return Image({ params: Promise.resolve({ startDate: getHomeSlateDate() }) });
}
