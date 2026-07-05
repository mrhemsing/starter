import { NextResponse } from "next/server";
import { getHomeSlateDate, getRankedStartsDefaultDate } from "@/lib/data/start-service";
import { rankedStartsPath } from "@/lib/routes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const today = getHomeSlateDate();
  const location = new URL(rankedStartsPath(await getRankedStartsDefaultDate(today)), request.url);
  const response = NextResponse.redirect(location, 307);
  response.headers.set("X-Robots-Tag", "noindex, follow");
  return response;
}
