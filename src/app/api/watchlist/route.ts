import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { WATCHLIST_COOKIE, addPitcherToWatchlistValue, getWatchlistView, removePitcherFromWatchlistValue, serializeWatchlistPitcherIds } from "@/lib/data/watchlist-service";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function GET() {
  const watchlistValue = await getWatchlistValue();
  const view = await getWatchlistView(watchlistValue);
  return NextResponse.json(view);
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const watchlistValue = cookieStore.get(WATCHLIST_COOKIE)?.value ?? null;
  const body = await request.json().catch(() => ({}));
  if (!body.pitcherId || typeof body.pitcherId !== "string") {
    return NextResponse.json({ error: "pitcherId is required" }, { status: 400 });
  }

  let pitcherIds: string[];
  try {
    pitcherIds = await addPitcherToWatchlistValue(watchlistValue, body.pitcherId);
  } catch {
    return NextResponse.json({ error: "invalid pitcherId" }, { status: 400 });
  }

  const nextWatchlistValue = serializeWatchlistPitcherIds(pitcherIds);
  const view = await getWatchlistView(nextWatchlistValue);
  const response = NextResponse.json(view);
  setWatchlistCookie(response, nextWatchlistValue, request);
  return response;
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const watchlistValue = cookieStore.get(WATCHLIST_COOKIE)?.value ?? null;
  if (!watchlistValue) return NextResponse.json(await getWatchlistView(null));

  const body = await request.json().catch(() => ({}));
  if (!body.pitcherId || typeof body.pitcherId !== "string") {
    return NextResponse.json({ error: "pitcherId is required" }, { status: 400 });
  }

  let pitcherIds: string[];
  try {
    pitcherIds = await removePitcherFromWatchlistValue(watchlistValue, body.pitcherId);
  } catch {
    return NextResponse.json({ error: "invalid pitcherId" }, { status: 400 });
  }

  const nextWatchlistValue = serializeWatchlistPitcherIds(pitcherIds);
  const response = NextResponse.json(await getWatchlistView(nextWatchlistValue));
  setWatchlistCookie(response, nextWatchlistValue, request);
  return response;
}

async function getWatchlistValue() {
  return (await cookies()).get(WATCHLIST_COOKIE)?.value ?? null;
}

function setWatchlistCookie(response: NextResponse, value: string, request: Request) {
  response.cookies.set(WATCHLIST_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

function isSecureRequest(request: Request) {
  if (process.env.NODE_ENV !== "production") return false;
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) return forwardedProto.split(",")[0]?.trim() === "https";
  return new URL(request.url).protocol === "https:";
}
