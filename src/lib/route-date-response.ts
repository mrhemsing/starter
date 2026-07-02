import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { isValidDateRouteParam } from "@/lib/route-date-validation";

export function assertValidDateRouteParam(value: string) {
  if (!isValidDateRouteParam(value)) notFound();
}

export function invalidDateRouteResponse() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
