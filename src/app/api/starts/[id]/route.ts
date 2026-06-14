import { NextResponse } from "next/server";
import { getStartApiResponse } from "@/lib/data/start-service";

type StartRouteApiContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: StartRouteApiContext) {
  const { id } = await params;
  const start = await getStartApiResponse(id);

  if (!start) {
    return NextResponse.json({ error: "Unknown start" }, { status: 404 });
  }

  return NextResponse.json(start);
}
