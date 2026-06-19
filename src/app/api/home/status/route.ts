import { NextResponse } from "next/server";
import { getHomeSlateDate, getSlateSchedule } from "@/lib/data/start-service";
import { getSlateProgressState } from "@/lib/slate-state";

const HOME_STATUS_REVALIDATE_SECONDS = 60;

export async function GET(request: Request) {
  const requestedDate = new URL(request.url).searchParams.get("date");
  const date = normalizeDateKey(requestedDate) ?? getHomeSlateDate();
  const schedule = await getSlateSchedule({ window: "today", date });

  return NextResponse.json(getSlateProgressState(schedule), {
    headers: {
      "Cache-Control": `public, s-maxage=${HOME_STATUS_REVALIDATE_SECONDS}, stale-while-revalidate=300`,
    },
  });
}

function normalizeDateKey(date: string | null) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return null;
  return parsed.toISOString().slice(0, 10) === date ? date : null;
}
