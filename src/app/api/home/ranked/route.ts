import { NextResponse } from "next/server";
import { getRankedHome } from "@/lib/data/home-ranked-service";

export async function GET() {
  return NextResponse.json(await getRankedHome());
}
