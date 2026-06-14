import type { Metadata } from "next";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.frontfive.app").replace(/\/+$/, "");
export const SITE_NAME = "Front Five";
export const DEFAULT_OG_IMAGE = "/opengraph-image";

export function absoluteUrl(path = "/") {
  return new URL(path, `${SITE_URL}/`).toString();
}

export function canonicalPath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

export function largeImageTwitter(title: string, description: string, image = DEFAULT_OG_IMAGE): Metadata["twitter"] {
  return {
    card: "summary_large_image",
    title,
    description,
    images: [{ url: image, alt: title }],
  };
}

export function websiteOpenGraph(title: string, description: string, url: string, image = DEFAULT_OG_IMAGE): Metadata["openGraph"] {
  return {
    title,
    description,
    type: "website",
    url,
    siteName: SITE_NAME,
    images: [{ url: image, width: 1200, height: 630, alt: title }],
  };
}

export function noIndexFollow() {
  return {
    index: false,
    follow: true,
    googleBot: {
      index: false,
      follow: true,
    },
  } satisfies Metadata["robots"];
}

export function formatLongDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(parsed);
}

export function formatShortDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(parsed);
}

export function formatMonth(month: string) {
  const parsed = new Date(`${month}-01T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return month;
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(parsed);
}

export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
