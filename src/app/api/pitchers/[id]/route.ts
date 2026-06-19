import { NextResponse } from "next/server";
import { getPitcherApiResponse, PITCHER_PROFILE_REVALIDATE_SECONDS } from "@/lib/data/start-service";

type PitcherRouteApiContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, { params }: PitcherRouteApiContext) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const pitcher = await getPitcherApiResponse(id, {
    sort: searchParams.get("sort") ?? undefined,
    result: searchParams.get("result") ?? undefined,
  });

  if (!pitcher) {
    return NextResponse.json({ error: "Unknown pitcher" }, { status: 404 });
  }

  return NextResponse.json(pitcher, {
    headers: {
      "Cache-Control": `public, s-maxage=${PITCHER_PROFILE_REVALIDATE_SECONDS}, stale-while-revalidate=3600`,
    },
  });
}
