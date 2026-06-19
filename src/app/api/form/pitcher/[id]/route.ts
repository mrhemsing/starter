import { NextResponse } from "next/server";
import { getPitcherForm } from "@/lib/data/form-service";

const PITCHER_FORM_REVALIDATE_SECONDS = 15 * 60;

type PitcherFormApiProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, { params }: PitcherFormApiProps) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const form = await getPitcherForm(id, { window: searchParams.get("window") ?? undefined });

  if (!form) {
    return NextResponse.json({ error: "Pitcher form not found" }, { status: 404 });
  }

  return NextResponse.json(form, {
    headers: {
      "Cache-Control": `public, s-maxage=${PITCHER_FORM_REVALIDATE_SECONDS}, stale-while-revalidate=3600`,
    },
  });
}
