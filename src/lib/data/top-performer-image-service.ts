import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FeaturedStartHighlight, StartSummary } from "@/lib/types";

const CACHE_DIR = path.join(process.cwd(), "public", "images", "top-performer-action-shots");
const PUBLIC_CACHE_PATH = "/images/top-performer-action-shots";
const SPORTRADAR_API_BASE = "https://api.sportradar.com";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PROVIDERS = ["usat", "getty", "ap", "reuters"] as const;

type TopPerformerImageSource = "action" | "highlight" | "headshot";

export type TopPerformerImage = {
  source: TopPerformerImageSource;
  imageUrl: string;
  alt: string;
  attribution?: string;
  playUrl?: string;
};

type CachedActionShot = {
  startId: string;
  assetId: string;
  imageUrl: string;
  alt: string;
  attribution: string;
  expiresAt: number;
};

type SportradarSchedule = {
  games?: Array<{
    id?: string;
    home?: { abbr?: string };
    away?: { abbr?: string };
  }>;
};

type SportradarAsset = {
  id?: string;
  title?: string;
  description?: string;
  copyright?: string;
  provider?: { name?: string };
  links?: Array<{
    href?: string;
    width?: number;
    height?: number;
    type?: string;
  }>;
};

type SportradarManifest = {
  assetlist?: SportradarAsset[];
};

export async function resolveTopPerformerImage(start: StartSummary | null, highlight: FeaturedStartHighlight | null): Promise<TopPerformerImage | null> {
  if (!start) return null;

  const actionShot = await resolveSportradarActionShot(start).catch(() => null);
  if (actionShot) return actionShot;

  if (highlight) {
    return {
      source: "highlight",
      imageUrl: highlight.thumbnailUrl,
      alt: `${start.pitcher.name} MLB highlight thumbnail`,
      playUrl: highlight.watchUrl,
    };
  }

  return {
    source: "headshot",
    imageUrl: start.pitcher.headshotUrl,
    alt: `${start.pitcher.name}, ${start.pitcher.team}`,
  };
}

async function resolveSportradarActionShot(start: StartSummary): Promise<TopPerformerImage | null> {
  const apiKey = process.env.SPORTRADAR_IMAGES_API_KEY ?? process.env.SPORTRADAR_API_KEY;
  if (!apiKey) return null;

  const cached = await readCachedActionShot(start.id);
  if (cached && cached.expiresAt > Date.now()) {
    return { source: "action", imageUrl: cached.imageUrl, alt: cached.alt, attribution: cached.attribution };
  }

  const eventId = await resolveSportradarGameId(start, apiKey);
  if (!eventId) return null;

  for (const provider of PROVIDERS) {
    const manifest = await fetchActionShotManifest(eventId, provider, apiKey).catch(() => null);
    const asset = selectActionShotAsset(manifest?.assetlist ?? [], start);
    const link = selectActionShotLink(asset);
    if (!asset?.id || !link?.href) continue;

    const cachedShot = await cacheActionShot(start, asset, link.href, provider, apiKey).catch(() => null);
    if (cachedShot) {
      return { source: "action", imageUrl: cachedShot.imageUrl, alt: cachedShot.alt, attribution: cachedShot.attribution };
    }
  }

  return null;
}

async function resolveSportradarGameId(start: StartSummary, apiKey: string) {
  const [year, month, day] = start.date.split("-");
  const url = `${SPORTRADAR_API_BASE}/mlb/trial/v8/en/games/${year}/${month}/${day}/schedule.json?${new URLSearchParams({ api_key: apiKey })}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;

  const schedule = await response.json() as SportradarSchedule;
  const game = schedule.games?.find((candidate) => {
    const home = candidate.home?.abbr;
    const away = candidate.away?.abbr;
    return (home === start.pitcher.team && away === start.opponent) || (away === start.pitcher.team && home === start.opponent);
  });

  return game?.id ?? null;
}

async function fetchActionShotManifest(eventId: string, provider: (typeof PROVIDERS)[number], apiKey: string) {
  const url = `${SPORTRADAR_API_BASE}/mlb-images-p3/${provider}/actionshots/events/game/${eventId}/manifest.json?${new URLSearchParams({ api_key: apiKey })}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  return await response.json() as SportradarManifest;
}

function selectActionShotAsset(assets: SportradarAsset[], start: StartSummary) {
  const last = lastName(start.pitcher.name).toLowerCase();
  const full = start.pitcher.name.toLowerCase();

  return [...assets]
    .map((asset) => ({ asset, score: actionShotScore(asset, full, last) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.asset ?? assets[0] ?? null;
}

function actionShotScore(asset: SportradarAsset, fullName: string, last: string) {
  const haystack = `${asset.title ?? ""} ${asset.description ?? ""}`.toLowerCase();
  let score = 0;
  if (haystack.includes(fullName)) score += 100;
  if (haystack.includes(last)) score += 50;
  if (haystack.includes("pitcher")) score += 20;
  if (haystack.includes("throws")) score += 10;
  return score;
}

function selectActionShotLink(asset: SportradarAsset | null) {
  if (!asset?.links?.length) return null;
  return [...asset.links].sort((a, b) => linkScore(b) - linkScore(a))[0] ?? null;
}

function linkScore(link: NonNullable<SportradarAsset["links"]>[number]) {
  if (link.href?.includes("h1000")) return 1000;
  if (link.type === "original") return 900;
  return link.width ?? 0;
}

async function cacheActionShot(start: StartSummary, asset: SportradarAsset, href: string, provider: string, apiKey: string): Promise<CachedActionShot | null> {
  if (!asset.id) return null;
  const downloadUrl = `${SPORTRADAR_API_BASE}/mlb-images-p3/${provider}${href}?${new URLSearchParams({ api_key: apiKey })}`;
  const response = await fetch(downloadUrl, { cache: "no-store" });
  if (!response.ok) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("image/")) return null;

  await mkdir(CACHE_DIR, { recursive: true });

  const extension = href.toLowerCase().endsWith(".png") ? "png" : "jpg";
  const imageName = `${safeFilePart(start.id)}-${asset.id}.${extension}`;
  const imagePath = path.join(CACHE_DIR, imageName);
  const imageBuffer = Buffer.from(await response.arrayBuffer());
  await writeFile(imagePath, imageBuffer);

  const value: CachedActionShot = {
    startId: start.id,
    assetId: asset.id,
    imageUrl: `${PUBLIC_CACHE_PATH}/${imageName}`,
    alt: displayCreditLabel(asset.description ?? `${start.pitcher.name} action photo`),
    attribution: requiredCredit(asset),
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  await writeFile(cacheManifestPath(start.id), JSON.stringify(value, null, 2));
  return value;
}

async function readCachedActionShot(startId: string): Promise<CachedActionShot | null> {
  const body = await readFile(cacheManifestPath(startId), "utf8").catch(() => null);
  if (!body) return null;
  const value = JSON.parse(body) as CachedActionShot;
  return value.imageUrl && value.attribution ? value : null;
}

function cacheManifestPath(startId: string) {
  return path.join(CACHE_DIR, `${safeFilePart(startId)}.json`);
}

function requiredCredit(asset: SportradarAsset) {
  const copyright = asset.copyright?.trim();
  const descriptionCredit = asset.description?.match(/Mandatory Credit:\s*([^.;]+)/i)?.[1]?.trim();
  return descriptionCredit ? `CREDIT: ${descriptionCredit}` : copyright ? `CREDIT: ${copyright}` : "CREDIT: SportRadar Images";
}

function displayCreditLabel(value: string) {
  return value.replace(/Mandatory Credit:/gi, "CREDIT:");
}

function safeFilePart(value: string) {
  return value.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
}

function lastName(name: string) {
  return name.trim().split(/\s+/).at(-1) ?? name;
}
