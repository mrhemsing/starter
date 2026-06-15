import { NextResponse } from "next/server";
import { getArchivedSeasonStartSummaries, getDefaultSlateDates, getHomeSlateDate } from "@/lib/data/start-service";
import { duelsPath, heatCheckPath, rankedStartsPath, startPath, upcomingDateHref, upcomingWeekHref } from "@/lib/routes";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

type SitemapKind = "static" | "starts" | "pitchers" | "rankings";
type SitemapUrl = {
  loc: string;
  lastmod: string;
  changefreq: "hourly" | "daily" | "weekly" | "monthly";
  priority: string;
};

export async function GET(_request: Request, context: { params: Promise<{ kind: string }> }) {
  const { kind: rawKind } = await context.params;
  const kind = rawKind.replace(/\.xml$/, "");
  if (!isSitemapKind(kind)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const urls = await urlsForKind(kind);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(urlToXml).join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

async function urlsForKind(kind: SitemapKind): Promise<SitemapUrl[]> {
  const today = getHomeSlateDate();
  const season = today.slice(0, 4);
  const [starts, defaults] = await Promise.all([
    getArchivedSeasonStartSummaries(season),
    getDefaultSlateDates(today),
  ]);
  const now = new Date().toISOString();
  const uniqueDates = [...new Set(starts.map((start) => start.date))].sort().reverse();

  if (kind === "static") {
    return [
      url("/", now, "daily", 1),
      url(heatCheckPath(), now, "hourly", 0.9),
      url("/leaderboard", now, "daily", 0.8),
      url(`/leaderboard/${season}`, now, "daily", 0.8),
      url("/leaderboard/consistency", now, "daily", 0.7),
      url("/leaderboard/ceiling", now, "daily", 0.7),
      url("/pitchers", now, "daily", 0.8),
      url("/parks", now, "monthly", 0.7),
      url("/glossary", now, "monthly", 0.7),
      url("/methodology", now, "monthly", 0.8),
      url(rankedStartsPath(defaults.rankedDate), now, "hourly", 0.9),
      url(upcomingDateHref(defaults.upcomingDate), now, "hourly", 0.9),
      url(upcomingWeekHref(defaults.upcomingDate), now, "hourly", 0.8),
    ];
  }

  if (kind === "starts") {
    return starts.slice(0, 50000).map((start) => url(startPath(start.id), dateLastmod(start.date), "monthly", 0.6));
  }

  if (kind === "pitchers") {
    const pitcherIds = [...new Set(starts.map((start) => start.pitcher.id))];
    const teams = [...new Set(starts.map((start) => start.pitcher.team).filter(Boolean))];
    return [
      ...pitcherIds.map((pitcherId) => url(`/pitchers/${pitcherId}/form`, now, "weekly", 0.7)),
      ...teams.map((team) => url(`/teams/${team.toLowerCase()}`, now, "weekly", 0.6)),
    ];
  }

  const months = [...new Set(starts.map((start) => start.date.slice(0, 7)))].sort().reverse();
  return [
    ...uniqueDates.flatMap((date) => [
      url(rankedStartsPath(date), dateLastmod(date), date === defaults.rankedDate ? "hourly" : "monthly", date === defaults.rankedDate ? 0.9 : 0.7),
      url(duelsPath(date), dateLastmod(date), date >= today ? "hourly" : "monthly", 0.6),
    ]),
    ...months.map((month) => url(`/best-starts/${month}`, `${month}-01T12:00:00.000Z`, "monthly", 0.6)),
  ];
}

function isSitemapKind(kind: string): kind is SitemapKind {
  return kind === "static" || kind === "starts" || kind === "pitchers" || kind === "rankings";
}

function url(loc: string, lastmod: string, changefreq: SitemapUrl["changefreq"], priority: number): SitemapUrl {
  return {
    loc: absoluteUrl(loc),
    lastmod,
    changefreq,
    priority: priority.toFixed(1),
  };
}

function dateLastmod(date: string) {
  return `${date}T12:00:00.000Z`;
}

function urlToXml(item: SitemapUrl) {
  return `  <url><loc>${escapeXml(item.loc)}</loc><lastmod>${item.lastmod}</lastmod><changefreq>${item.changefreq}</changefreq><priority>${item.priority}</priority></url>`;
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
