import { NextResponse } from "next/server";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { generateHomeGsPlusProofs } from "@/lib/data/home-gs-plus-proof-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const date = normalizeDateKey(url.searchParams.get("date")) ?? getHomeSlateDate();
  const result = await generateHomeGsPlusProofs(date);
  return NextResponse.json({ ok: true, result });
}

function isAuthorizedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

function normalizeDateKey(date: string | null) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return null;
  return parsed.toISOString().slice(0, 10) === date ? date : null;
}
