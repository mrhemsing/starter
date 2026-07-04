import { NextResponse } from "next/server";
import { getHomeSlateDate, getSlateStartProgress } from "@/lib/data/start-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestedDate = new URL(request.url).searchParams.get("date");
  const date = normalizeDateKey(requestedDate) ?? getHomeSlateDate();

  return NextResponse.json(await getSlateStartProgress({ window: "today", date }), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function normalizeDateKey(date: string | null) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return null;
  return parsed.toISOString().slice(0, 10) === date ? date : null;
}
