import { NextResponse } from "next/server";
import { getRankedHome, HOME_RANKED_REVALIDATE_SECONDS } from "@/lib/data/home-ranked-service";

export async function GET() {
  return NextResponse.json(await getRankedHome(), {
    headers: {
      "Cache-Control": `public, s-maxage=${HOME_RANKED_REVALIDATE_SECONDS}, stale-while-revalidate=300`,
    },
  });
}
