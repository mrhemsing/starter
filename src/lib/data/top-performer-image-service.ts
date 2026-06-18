import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FeaturedStartHighlight, StartSummary } from "@/lib/types";

const CACHE_DIR = path.join(process.cwd(), "public", "images", "top-performer-action-shots");
const PUBLIC_CACHE_PATH = "/images/top-performer-action-shots";
const MLB_STATS_API_BASE = "https://statsapi.mlb.com";
const SPORTRADAR_API_BASE = "https://api.sportradar.com";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MLB_CONTENT_REVALIDATE_SECONDS = 5 * 60;
const SPORTRADAR_REVALIDATE_SECONDS = 24 * 60 * 60;
const PROVIDERS = ["usat", "getty", "ap", "reuters"] as const;
const PLACEHOLDER_IMAGE_URL = "/images/top-performer-placeholder.jpg";
const NOLAN_MCLEAN_MLB_ID = 690997;
const NOLAN_MCLEAN_BASES_LOADED_JAM_IMAGE = "https://img.mlbstatic.com/mlb-images/image/upload/w_1920,h_1080,f_jpg,c_fill,g_auto/mlb/rljrivvswnciz9owcoem.jpg";
const PREFERRED_MLB_CONTENT_HEADLINES_BY_START_ID: Record<string, string> = {
  "2026-06-12-nym-atl-690997": "Nolan McLean escapes bases-loaded jam",
};

type TopPerformerImageSource = "action" | "game-content" | "highlight" | "placeholder";

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

type MlbContentKeyword = {
  type?: string;
  value?: string;
  displayName?: string;
};

type MlbContentImageCut = {
  aspectRatio?: string;
  width?: number;
  height?: number;
  src?: string;
};

type MlbContentItem = {
  type?: string;
  headline?: string;
  title?: string;
  description?: string;
  keywordsAll?: MlbContentKeyword[];
  image?: {
    title?: string;
    altText?: string | null;
    cuts?: MlbContentImageCut[];
  };
};

type MlbGameContent = {
  highlights?: {
    highlights?: {
      items?: MlbContentItem[];
    };
    gameCenter?: {
      items?: MlbContentItem[];
    };
    live?: {
      items?: MlbContentItem[];
    };
  };
  media?: {
    featuredMedia?: {
      items?: MlbContentItem[];
    };
  };
};

export async function resolveTopPerformerImage(start: StartSummary | null, highlight: FeaturedStartHighlight | null): Promise<TopPerformerImage | null> {
  if (!start) return null;

  const preferredPitcherImage = resolvePreferredPitcherImage(start);
  if (preferredPitcherImage) return preferredPitcherImage;

  const gameContentImage = await resolveMlbGameContentImage(start).catch(() => null);
  if (gameContentImage) return gameContentImage;

  if (highlight) {
    return {
      source: "highlight",
      imageUrl: highlight.thumbnailUrl,
      alt: `${start.pitcher.name} MLB highlight thumbnail`,
      playUrl: highlight.watchUrl,
    };
  }

  const actionShot = await resolveSportradarActionShot(start).catch(() => null);
  if (actionShot) return actionShot;

  return {
    source: "placeholder",
    imageUrl: PLACEHOLDER_IMAGE_URL,
    alt: "Pitcher's mound and rubber on a baseball field",
  };
}

function resolvePreferredPitcherImage(start: StartSummary): TopPerformerImage | null {
  if (start.pitcher.mlbId !== NOLAN_MCLEAN_MLB_ID) return null;

  return {
    source: "game-content",
    imageUrl: NOLAN_MCLEAN_BASES_LOADED_JAM_IMAGE,
    alt: "Nolan McLean escapes a bases-loaded jam",
  };
}

async function resolveMlbGameContentImage(start: StartSummary): Promise<TopPerformerImage | null> {
  const response = await fetch(`${MLB_STATS_API_BASE}/api/v1/game/${start.gamePk}/content`, {
    next: { revalidate: MLB_CONTENT_REVALIDATE_SECONDS },
  });
  if (!response.ok) return null;

  const content = await response.json() as MlbGameContent;
  const item = selectMlbContentItem(content, start);
  const imageUrl = selectMlbContentImageUrl(item);
  if (!item || !imageUrl) return null;

  const title = item.headline ?? item.title ?? item.image?.title ?? `${start.pitcher.name} game highlight`;
  return {
    source: "game-content",
    imageUrl,
    alt: item.image?.altText?.trim() || title,
  };
}

function selectMlbContentItem(content: MlbGameContent, start: StartSummary) {
  const items = [
    ...(content.highlights?.highlights?.items ?? []),
    ...(content.highlights?.gameCenter?.items ?? []),
    ...(content.highlights?.live?.items ?? []),
    ...(content.media?.featuredMedia?.items ?? []),
  ];
  const preferredHeadline = PREFERRED_MLB_CONTENT_HEADLINES_BY_START_ID[start.id];
  const preferredItem = preferredHeadline
    ? items.find((item) => item.headline === preferredHeadline || item.title === preferredHeadline)
    : null;
  if (preferredItem) return preferredItem;

  return items
    .map((item) => ({ item, score: mlbContentItemScore(item, start) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.item ?? null;
}

function mlbContentItemScore(item: MlbContentItem, start: StartSummary) {
  if (item.type && item.type !== "video") return 0;

  const keywords = item.keywordsAll ?? [];
  const values = keywords.map((keyword) => `${keyword.type ?? ""}:${keyword.value ?? ""}:${keyword.displayName ?? ""}`.toLowerCase());
  const haystack = `${item.headline ?? ""} ${item.title ?? ""} ${item.description ?? ""} ${item.image?.title ?? ""}`.toLowerCase();
  const fullName = start.pitcher.name.toLowerCase();
  const last = lastName(start.pitcher.name).toLowerCase();
  let score = 0;

  if (values.some((value) => value.includes(`player_id:${start.pitcher.mlbId}`) || value.includes(`playerid-${start.pitcher.mlbId}`))) score += 120;
  if (values.some((value) => value.includes(`game_pk:${start.gamePk}`) || value.includes(`gamepk-${start.gamePk}`))) score += 80;
  if (haystack.includes(fullName)) score += 80;
  if (haystack.includes(last)) score += 40;
  if (values.some((value) => value.includes("highlight-reel-starting-pitching") || value.includes("highlight-reel-pitching"))) score += 30;
  if (haystack.includes("strikeout") || haystack.includes("fans ")) score += 15;

  return score;
}

function selectMlbContentImageUrl(item: MlbContentItem | null) {
  const cuts = item?.image?.cuts ?? [];
  const cut = [...cuts]
    .filter((candidate) => candidate.aspectRatio === "16:9" && candidate.src)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]
    ?? [...cuts].filter((candidate) => candidate.src).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];

  return cut?.src ?? null;
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
  const response = await fetch(url, { next: { revalidate: SPORTRADAR_REVALIDATE_SECONDS } });
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
  const response = await fetch(url, { next: { revalidate: SPORTRADAR_REVALIDATE_SECONDS } });
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
  if (link.type === "original") return 10_000;
  if (link.href?.includes("h1000")) return 1000;
  return link.width ?? 0;
}

async function cacheActionShot(start: StartSummary, asset: SportradarAsset, href: string, provider: string, apiKey: string): Promise<CachedActionShot | null> {
  if (!asset.id) return null;
  const downloadUrl = `${SPORTRADAR_API_BASE}/mlb-images-p3/${provider}${href}?${new URLSearchParams({ api_key: apiKey })}`;
  const response = await fetch(downloadUrl, { next: { revalidate: SPORTRADAR_REVALIDATE_SECONDS } });
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
