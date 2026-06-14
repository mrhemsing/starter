import { NextResponse } from "next/server";
import { getFormCalibration, parseFormWindow } from "@/lib/data/form-service";

export async function GET(request: Request) {
  if (!isFormDebugEnabled()) {
    return NextResponse.json({ error: "Form debug is disabled" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const calibration = await getFormCalibration({ window: parseFormWindow(searchParams.get("window") ?? undefined) });

  return NextResponse.json(calibration);
}

function isFormDebugEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.THE_BUMP_FORM_DEBUG === "1";
}
