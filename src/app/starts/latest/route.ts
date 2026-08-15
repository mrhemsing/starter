import { NextResponse } from "next/server";
import { addDays, getHomeSlateDate, getRankedStartsDefaultDate } from "@/lib/data/start-service";
import { rankedStartsPath } from "@/lib/routes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const today = getHomeSlateDate();
  let rankedDate: string;

  try {
    rankedDate = await getRankedStartsDefaultDate(today);
  } catch (error) {
    rankedDate = addDays(today, -1);
    console.error(`[ranked-starts-latest] default-date lookup failed; falling back to ${rankedDate}`, error);
  }

  const location = new URL(rankedStartsPath(rankedDate), request.url);
  const response = NextResponse.redirect(location, 307);
  response.headers.set("X-Robots-Tag", "noindex, follow");
  return response;
}
