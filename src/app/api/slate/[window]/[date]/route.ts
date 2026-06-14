import { NextResponse } from "next/server";
import { getSlateApiResponse } from "@/lib/data/start-service";
import { isSlateWindow } from "@/lib/routes";

type SlateRouteApiContext = {
  params: Promise<{
    window: string;
    date: string;
  }>;
};

export async function GET(_request: Request, { params }: SlateRouteApiContext) {
  const { window, date } = await params;

  if (!isSlateWindow(window)) {
    return NextResponse.json({ error: "Unknown slate window" }, { status: 404 });
  }

  return NextResponse.json(await getSlateApiResponse({ window, date }));
}
