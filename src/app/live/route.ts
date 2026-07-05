import { NextResponse } from "next/server";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { liveDateHref } from "@/lib/routes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const location = new URL(liveDateHref(getHomeSlateDate()), request.url);
  const response = NextResponse.redirect(location, 307);
  response.headers.set("X-Robots-Tag", "noindex, follow");
  return response;
}
