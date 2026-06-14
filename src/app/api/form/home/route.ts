import { NextResponse } from "next/server";
import { getFormHome } from "@/lib/data/form-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const home = await getFormHome({ window: searchParams.get("window") ?? undefined });

  return NextResponse.json(home);
}
