import { NextResponse, type NextRequest } from "next/server";
import { isIsoDateRouteParam, isValidDateRouteParam } from "@/lib/route-date-validation";

export function proxy(request: NextRequest) {
  const invalidPathDate = hasInvalidPathDate(request.nextUrl.pathname);
  if (invalidPathDate || hasInvalidQueryDate(request.nextUrl)) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      if (!invalidPathDate) return NextResponse.next();
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/duels",
    "/api/live/:path*",
    "/api/slate/:path*",
    "/api/social/start-of-day",
    "/api/starts/:path*",
    "/api/tonight",
    "/api/upcoming",
    "/duels/:path*",
    "/live/:path*",
    "/slate/:path*",
    "/social/start-of-day/:path*",
    "/starts/:path*",
    "/upcoming/:path*",
  ],
};

function hasInvalidPathDate(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const [root, second, third, fourth] = segments;

  if (root === "upcoming") {
    if (isUpcomingStaticSegment(second)) return false;
    if (second === "week") {
      if (isUpcomingStaticSegment(third)) return false;
      return isInvalidRequiredDateSegment(third);
    }
    return isInvalidRequiredDateSegment(second);
  }

  if (root === "live" || root === "duels") {
    return isInvalidRequiredDateSegment(second);
  }

  if (root === "starts") {
    return isInvalidDateSegment(second);
  }

  if (root === "slate") {
    return isInvalidRequiredDateSegment(third);
  }

  if (root === "social" && second === "start-of-day") {
    return isInvalidRequiredDateSegment(third);
  }

  if (root !== "api") return false;

  if (second === "live") {
    return isInvalidRequiredDateSegment(third);
  }

  if (second === "starts") {
    return isInvalidDateSegment(third);
  }

  if (second === "slate") {
    return isInvalidRequiredDateSegment(fourth);
  }

  return false;
}

function hasInvalidQueryDate(url: URL) {
  const date = url.searchParams.get("date");
  const start = url.searchParams.get("start");
  return (date !== null && !isValidDateRouteParam(date)) || (start !== null && !isValidDateRouteParam(start));
}

function isInvalidDateSegment(value: string | undefined) {
  return Boolean(value && isIsoDateRouteParam(value) && !isValidDateRouteParam(value));
}

function isInvalidRequiredDateSegment(value: string | undefined) {
  return Boolean(value && !isValidDateRouteParam(value));
}

const UPCOMING_STATIC_SEGMENTS: ReadonlySet<string> = new Set([
  "opengraph-image",
  "streamers",
]);

function isUpcomingStaticSegment(value: string | undefined) {
  // Reserved named Upcoming views must be listed here before the [date] guard.
  return Boolean(value && UPCOMING_STATIC_SEGMENTS.has(value));
}
