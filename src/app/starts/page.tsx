import { redirect } from "next/navigation";
import { getHomeSlateDate, getRankedStartsDefaultDate } from "@/lib/data/start-service";
import { rankedStartsPath } from "@/lib/routes";

export default async function RankedStartsIndexPage() {
  const today = getHomeSlateDate();
  redirect(rankedStartsPath(await getRankedStartsDefaultDate(today)));
}
