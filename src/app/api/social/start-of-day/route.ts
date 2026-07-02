import { NextResponse } from "next/server";
import { getDailySocialPostDraft } from "@/lib/data/daily-social-post-service";
import { invalidDateRouteResponse } from "@/lib/route-date-response";
import { isValidDateRouteParam } from "@/lib/route-date-validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? undefined;
  if (date && !isValidDateRouteParam(date)) return invalidDateRouteResponse();
  const draft = await getDailySocialPostDraft(date);
  const status = draft.status === "ready" ? 200 : 200;

  return NextResponse.json(draft, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
