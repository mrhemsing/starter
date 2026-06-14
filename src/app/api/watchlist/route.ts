import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { WATCHLIST_COOKIE, createWatchlistAccountId, followPitcher, getWatchlistView, unfollowPitcher } from "@/lib/data/watchlist-service";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function GET() {
  const accountId = await getAccountId(false);
  const view = await getWatchlistView(accountId);
  return NextResponse.json(view);
}

export async function POST(request: Request) {
  const accountId = await getAccountId(true);
  if (!accountId) return NextResponse.json({ error: "could not create watchlist account" }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  if (!body.pitcherId || typeof body.pitcherId !== "string") {
    return NextResponse.json({ error: "pitcherId is required" }, { status: 400 });
  }

  try {
    await followPitcher(accountId, body.pitcherId);
  } catch {
    return NextResponse.json({ error: "invalid pitcherId" }, { status: 400 });
  }

  const view = await getWatchlistView(accountId);
  return NextResponse.json(view);
}

export async function DELETE(request: Request) {
  const accountId = await getAccountId(false);
  if (!accountId) return NextResponse.json(await getWatchlistView(null));

  const body = await request.json().catch(() => ({}));
  if (!body.pitcherId || typeof body.pitcherId !== "string") {
    return NextResponse.json({ error: "pitcherId is required" }, { status: 400 });
  }

  try {
    await unfollowPitcher(accountId, body.pitcherId);
  } catch {
    return NextResponse.json({ error: "invalid pitcherId" }, { status: 400 });
  }

  return NextResponse.json(await getWatchlistView(accountId));
}

async function getAccountId(create: boolean) {
  const cookieStore = await cookies();
  const existing = cookieStore.get(WATCHLIST_COOKIE)?.value;
  if (existing) return existing;
  if (!create) return null;

  const accountId = createWatchlistAccountId();
  cookieStore.set(WATCHLIST_COOKIE, accountId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return accountId;
}
