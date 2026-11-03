import { getSeasonState } from "@/lib/season-state";
import { SeasonComplete } from "@/components/season-complete";
import { redirect } from "next/navigation";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { duelsPath } from "@/lib/routes";

export default async function DuelsIndexPage() {
  const state = await getSeasonState();
  if (state.status === "season_complete") return <SeasonComplete state={state} surface="upcoming" />;
  redirect(duelsPath(getHomeSlateDate()));
}
