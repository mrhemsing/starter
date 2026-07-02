import { NextResponse, type NextRequest } from "next/server";
import { isIsoDateRouteParam, isValidDateRouteParam } from "@/lib/route-date-validation";

export function proxy(request: NextRequest) {
  if (hasInvalidDateParam(request.nextUrl)) {
    return new NextResponse(null, { status: 404 });
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

function hasInvalidDateParam(url: URL) {
  return hasInvalidPathDate(url.pathname) || hasInvalidQueryDate(url);
}

function hasInvalidPathDate(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const [root, second, third, fourth] = segments;

  if (root === "upcoming") {
    if (second === "week") return isInvalidDateSegment(third);
    return isInvalidDateSegment(second);
  }

  if (root === "starts" || root === "live" || root === "duels") {
    return isInvalidDateSegment(second);
  }

  if (root === "slate") {
    return isInvalidDateSegment(third);
  }

  if (root === "social" && second === "start-of-day") {
    return isInvalidDateSegment(third);
  }

  if (root !== "api") return false;

  if (second === "live" || second === "starts") {
    return isInvalidDateSegment(third);
  }

  if (second === "slate") {
    return isInvalidDateSegment(fourth);
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
