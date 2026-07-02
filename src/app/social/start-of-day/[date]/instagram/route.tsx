import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { DailySocialCard, dailySocialSizes } from "@/lib/daily-social-card";
import { getDailySocialPostDraft } from "@/lib/data/daily-social-post-service";
import { invalidDateRouteResponse } from "@/lib/route-date-response";
import { isValidDateRouteParam } from "@/lib/route-date-validation";

type SocialImageRouteProps = {
  params: Promise<{
    date: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: SocialImageRouteProps) {
  const { date } = await params;
  if (!isValidDateRouteParam(date)) return invalidDateRouteResponse();
  const draft = await getDailySocialPostDraft(date);
  if (draft.status !== "ready") {
    return NextResponse.json(draft, { status: 404 });
  }

  return new ImageResponse(<DailySocialCard start={draft.start} variant="instagram" />, dailySocialSizes.instagram);
}
