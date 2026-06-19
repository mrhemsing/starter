import { NextResponse } from "next/server";
import { getFormHome } from "@/lib/data/form-service";

export const revalidate = 900;
const FORM_HOME_REVALIDATE_SECONDS = 15 * 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const home = await getFormHome({ window: searchParams.get("window") ?? undefined });

  return NextResponse.json(home, {
    headers: {
      "Cache-Control": `public, s-maxage=${FORM_HOME_REVALIDATE_SECONDS}, stale-while-revalidate=3600`,
    },
  });
}
