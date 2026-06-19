import { NextResponse } from "next/server";
import { getDailySocialPostDraft } from "@/lib/data/daily-social-post-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const draft = await getDailySocialPostDraft(searchParams.get("date") ?? undefined);
  const status = draft.status === "ready" ? 200 : 200;

  return NextResponse.json(draft, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
