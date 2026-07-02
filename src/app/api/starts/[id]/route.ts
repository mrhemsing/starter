import { NextResponse } from "next/server";
import { getStartApiResponse } from "@/lib/data/start-service";
import { invalidDateRouteResponse } from "@/lib/route-date-response";
import { isIsoDateRouteParam, isValidDateRouteParam } from "@/lib/route-date-validation";

type StartRouteApiContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: StartRouteApiContext) {
  const { id } = await params;
  if (isIsoDateRouteParam(id) && !isValidDateRouteParam(id)) return invalidDateRouteResponse();
  const start = await getStartApiResponse(id);

  if (!start) {
    return NextResponse.json({ error: "Unknown start" }, { status: 404 });
  }

  return NextResponse.json(start);
}
