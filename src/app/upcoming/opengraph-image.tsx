import { getHomeSlateDate } from "@/lib/data/start-service";
import Image from "./[date]/opengraph-image";

export const alt = "The Bump upcoming starter watch card";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default function UpcomingIndexImage() {
  return Image({ params: Promise.resolve({ date: getHomeSlateDate() }) });
}
