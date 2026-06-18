import { NextResponse } from "next/server";
import { getBestStartsHome, HOME_BEST_STARTS_REVALIDATE_SECONDS } from "@/lib/data/home-best-starts-service";

export async function GET() {
  return NextResponse.json(await getBestStartsHome(), {
    headers: {
      "Cache-Control": `public, s-maxage=${HOME_BEST_STARTS_REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
    },
  });
}
