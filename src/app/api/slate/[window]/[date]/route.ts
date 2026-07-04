import { NextResponse } from "next/server";
import { getSlateApiResponse } from "@/lib/data/start-service";
import { isSlateWindow } from "@/lib/routes";
import { invalidDateRouteResponse } from "@/lib/route-date-response";
import { isValidDateRouteParam } from "@/lib/route-date-validation";

type SlateRouteApiContext = {
  params: Promise<{
    window: string;
    date: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: SlateRouteApiContext) {
  const { window, date } = await params;

  if (!isSlateWindow(window)) {
    return NextResponse.json({ error: "Unknown slate window" }, { status: 404 });
  }
  if (!isValidDateRouteParam(date)) return invalidDateRouteResponse();

  return NextResponse.json(await getSlateApiResponse({ window, date }));
}
