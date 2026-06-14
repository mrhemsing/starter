import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

const sitemapKinds = ["static", "starts", "pitchers", "rankings"] as const;

export function GET() {
  const now = new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapKinds.map((kind) => `  <sitemap><loc>${absoluteUrl(`/sitemaps/${kind}.xml`)}</loc><lastmod>${now}</lastmod></sitemap>`).join("\n")}
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
