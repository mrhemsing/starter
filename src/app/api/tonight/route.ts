import { NextResponse } from "next/server";
import { getTonightMustWatch, TONIGHT_REVALIDATE_SECONDS } from "@/lib/data/tonight-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? undefined;
  const window = Number(searchParams.get("window") ?? 5);
  const data = await getTonightMustWatch({ date, window: window === 3 || window === 10 ? window : 5 });

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${TONIGHT_REVALIDATE_SECONDS}, stale-while-revalidate=300`,
    },
  });
}
