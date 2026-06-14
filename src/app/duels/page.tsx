import { redirect } from "next/navigation";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { duelsPath } from "@/lib/routes";

export default function DuelsIndexPage() {
  redirect(duelsPath(getHomeSlateDate()));
}
