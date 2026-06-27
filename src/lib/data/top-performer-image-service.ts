import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FeaturedStartHighlight, StartSummary } from "@/lib/types";

const CACHE_DIR = path.join(process.cwd(), "public", "images", "top-performer-action-shots");
const PUBLIC_CACHE_PATH = "/images/top-performer-action-shots";
const SPORTRADAR_API_BASE = "https://api.sportradar.com";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MLB_CONTENT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SPORTRADAR_REVALIDATE_SECONDS = 24 * 60 * 60;
const MLB_CONTENT_REVALIDATE_SECONDS = 10 * 60;
const PROVIDERS = ["ap", "getty", "usat", "reuters"] as const;
const PLACEHOLDER_IMAGE_URL = "/images/top-performer-placeholder.jpg";
const NOLAN_MCLEAN_MLB_ID = 690997;
const NOLAN_MCLEAN_BASES_LOADED_JAM_IMAGE = "https://img.mlbstatic.com/mlb-images/image/upload/w_1920,h_1080,f_jpg,c_fill,g_auto/mlb/rljrivvswnciz9owcoem.jpg";
const CAM_SCHLITTLER_MLB_ID = 693645;
const CAM_SCHLITTLER_REDS_ACTION_IMAGE =
  "https://images2.minutemediacdn.com/image/upload/c_crop,x_0,y_0,w_3227,h_1815/c_fill,w_1440,ar_16:9,f_auto,q_auto,g_auto/images%2FImagnImages%2Fmmsport%2Finside_the_reds%2F01kvhb1zebrbrmepeemw.jpg";
const PAYTON_TOLLE_YANKEES_START_ID = "2026-06-26-bos-nyy-801139";
const PAYTON_TOLLE_YANKEES_AP_ACTION_IMAGE = "https://s.hdnux.com/photos/01/66/54/02/31113390/3/rawImage.jpg";
const JAKE_BENNETT_MLB_ID = 687562;
const JAKE_BENNETT_BLUE_JAYS_ACTION_IMAGE =
  "https://img.mlbstatic.com/mlb-images/image/upload/ar_16:9,g_auto,q_auto:good,w_2608,c_fill,f_jpg/mlb/pem1abrn3e0vkdnje4mc.jpg";

type TopPerformerImageSource = "action" | "placeholder";

export type TopPerformerImage = {
  source: TopPerformerImageSource;
  imageUrl: string;
  alt: string;
  attribution?: string;
  objectPosition?: string;
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

type CachedMlbGameContentActionImage = {
  startId: string;
  imageUrl: string;
  alt: string;
  objectPosition: string;
  playUrl?: string;
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

type MlbGameContentItem = {
  type?: string;
  title?: string;
  headline?: string;
  description?: string;
  blurb?: string;
  id?: string;
  slug?: string;
  image?: {
    title?: string;
    cuts?: Array<{
      aspectRatio?: string;
      width?: number;
      height?: number;
      src?: string;
    }>;
  };
};

type MlbGameContent = {
  highlights?: {
    highlights?: {
      items?: MlbGameContentItem[];
    };
  };
  media?: {
    epgAlternate?: Array<{
      items?: MlbGameContentItem[];
    }>;
  };
};

export async function resolveTopPerformerImage(start: StartSummary | null, _highlight: FeaturedStartHighlight | null): Promise<TopPerformerImage | null> {
  void _highlight;
  if (!start) return null;

  const preferredPitcherImage = resolvePreferredPitcherImage(start);
  if (preferredPitcherImage) return preferredPitcherImage;

  const actionShot = await resolveSportradarActionShot(start).catch(() => null);
  if (actionShot) return actionShot;

  const cachedMlbGameContentAction = await readCachedMlbGameContentActionImage(start.id);
  if (cachedMlbGameContentAction && cachedMlbGameContentAction.expiresAt > Date.now()) {
    return {
      source: "action",
      imageUrl: cachedMlbGameContentAction.imageUrl,
      alt: cachedMlbGameContentAction.alt,
      objectPosition: cachedMlbGameContentAction.objectPosition,
      playUrl: cachedMlbGameContentAction.playUrl,
    };
  }

  const mlbGameContentAction = await resolveMlbGameContentActionImage(start).catch(() => null);
  if (mlbGameContentAction) return mlbGameContentAction;

  return {
    source: "placeholder",
    imageUrl: PLACEHOLDER_IMAGE_URL,
    alt: "Pitcher's mound and rubber on a baseball field",
  };
}

function resolvePreferredPitcherImage(start: StartSummary): TopPerformerImage | null {
  if (start.id === PAYTON_TOLLE_YANKEES_START_ID) {
    return {
      source: "action",
      imageUrl: PAYTON_TOLLE_YANKEES_AP_ACTION_IMAGE,
      alt: "Payton Tolle reacts after getting the third out against the Yankees",
      attribution: "CREDIT: Mary Schwalm/AP Photo",
      objectPosition: "50% 45%",
    };
  }

  if (start.pitcher.mlbId === NOLAN_MCLEAN_MLB_ID) {
    return {
      source: "action",
      imageUrl: NOLAN_MCLEAN_BASES_LOADED_JAM_IMAGE,
      alt: "Nolan McLean escapes a bases-loaded jam",
    };
  }

  if (start.pitcher.mlbId === CAM_SCHLITTLER_MLB_ID) {
    return {
      source: "action",
      imageUrl: CAM_SCHLITTLER_REDS_ACTION_IMAGE,
      alt: "Cam Schlittler delivers a pitch against Cincinnati",
      attribution: "CREDIT: Vincent Carchietta-Imagn Images",
      objectPosition: "48% 50%",
    };
  }

  if (start.pitcher.mlbId === JAKE_BENNETT_MLB_ID) {
    return {
      source: "action",
      imageUrl: JAKE_BENNETT_BLUE_JAYS_ACTION_IMAGE,
      alt: "Jake Bennett delivers a pitch for the Red Sox",
      attribution: "CREDIT: Getty Images",
      objectPosition: "50% 45%",
      playUrl: "https://www.mlb.com/redsox/video/jake-bennett-fans-five-against-blue-jays",
    };
  }

  return null;
}

async function resolveSportradarActionShot(start: StartSummary): Promise<TopPerformerImage | null> {
  const cached = await readCachedActionShot(start.id);
  if (cached && cached.expiresAt > Date.now()) {
    return { source: "action", imageUrl: cached.imageUrl, alt: cached.alt, attribution: cached.attribution, objectPosition: actionShotObjectPosition() };
  }

  const apiKey = process.env.SPORTRADAR_IMAGES_API_KEY ?? process.env.SPORTRADAR_API_KEY;
  if (!apiKey) return null;

  const eventId = await resolveSportradarGameId(start, apiKey);
  if (!eventId) return null;

  for (const provider of PROVIDERS) {
    const manifest = await fetchActionShotManifest(eventId, provider, apiKey).catch(() => null);
    const asset = selectActionShotAsset(manifest?.assetlist ?? [], start);
    const link = selectActionShotLink(asset);
    if (!asset?.id || !link?.href) continue;

    const cachedShot = await cacheActionShot(start, asset, link.href, provider, apiKey).catch(() => null);
    if (cachedShot) {
      return { source: "action", imageUrl: cachedShot.imageUrl, alt: cachedShot.alt, attribution: cachedShot.attribution, objectPosition: actionShotObjectPosition() };
    }
  }

  return null;
}

function actionShotObjectPosition() {
  return "50% 50%";
}

async function resolveMlbGameContentActionImage(start: StartSummary): Promise<TopPerformerImage | null> {
  const response = await fetch(`https://statsapi.mlb.com/api/v1/game/${start.gamePk}/content`, { next: { revalidate: MLB_CONTENT_REVALIDATE_SECONDS } });
  if (!response.ok) return null;

  const content = await response.json() as MlbGameContent;
  const item = selectMlbGameContentActionItem(content, start);
  const cut = selectMlbImageCut(item);
  if (!item || !cut?.src) return null;

  const image = {
    source: "action",
    imageUrl: normalizeMlbImageUrl(cut.src),
    alt: item.headline ?? item.title ?? `${start.pitcher.name} action photo`,
    objectPosition: "50% 50%",
    playUrl: item.slug ? `https://www.mlb.com/video/${item.slug}` : undefined,
  } satisfies TopPerformerImage;

  await writeCachedMlbGameContentActionImage(start.id, image).catch(() => undefined);
  return image;
}

function selectMlbGameContentActionItem(content: MlbGameContent, start: StartSummary) {
  const items = [
    ...(content.highlights?.highlights?.items ?? []),
    ...content.media?.epgAlternate?.flatMap((group) => group.items ?? []) ?? [],
  ];
  const seen = new Set<string>();

  return items
    .filter((item) => {
      const key = item.id ?? item.slug ?? item.title ?? "";
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item) => ({ item, score: mlbGameContentActionScore(item, start) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.item ?? null;
}

function mlbGameContentActionScore(item: MlbGameContentItem, start: StartSummary) {
  const titleText = `${item.title ?? ""} ${item.headline ?? ""} ${item.blurb ?? ""} ${item.image?.title ?? ""}`.toLowerCase();
  const text = `${titleText} ${item.description ?? ""} ${item.id ?? ""} ${item.slug ?? ""}`.toLowerCase();
  if (item.type !== "video") return 0;
  if (!selectMlbImageCut(item)) return 0;
  if (!text.includes(lastName(start.pitcher.name).toLowerCase())) return 0;
  if (!isMlbActionImageCandidate(item, start)) return 0;
  if (nonActionMlbContentPattern().test(text)) return 0;
  if (nonActionMlbTitlePattern().test(titleText)) return 0;

  let score = 0;
  if (text.includes(start.pitcher.name.toLowerCase())) score += 100;
  if (pitcherActionHighlightPattern().test(text)) score += 75;
  if (text.includes("strikes out") || text.includes("fans")) score += 50;
  if (text.includes("outing") || text.includes("start")) score += 20;
  if (text.includes("throws") || text.includes("pitch")) score += 25;
  if (text.includes(start.opponent.toLowerCase())) score += 10;
  if (text.includes(start.pitcher.team.toLowerCase())) score += 5;
  if (isPhotoCreditImageTitle(item.image?.title ?? "")) score += 35;
  if (isPitcherActionHighlight(item, start)) score += 30;
  return score;
}

function nonActionMlbContentPattern() {
  return /\b(all games? highlights?|starting lineups?|fielding alignment|bench availability|bullpen availability|probable pitchers?|breaking down|challenge|overturned|preview|recap)\b/i;
}

function nonActionMlbTitlePattern() {
  return /\b(condensed game|animated look|statcast analysis|measuring the stats|fuel(?:s|ed)?\b.*\bwin|win\b.*\bfuel(?:s|ed)?)\b/i;
}

function photoCreditImageTitlePattern() {
  return /\b(gettyimages|imagn|usa today|reuters)\b|^ap\d+/i;
}

function isPhotoCreditImageTitle(title: string) {
  return photoCreditImageTitlePattern().test(title);
}

function isMlbActionImageCandidate(item: MlbGameContentItem, start: StartSummary) {
  return isPhotoCreditImageTitle(item.image?.title ?? "") || isSinglePitchMlbActionFrame(item, start) || isPitcherActionHighlight(item, start);
}

function isPitcherActionHighlight(item: MlbGameContentItem, start: StartSummary) {
  const text = `${item.title ?? ""} ${item.headline ?? ""} ${item.description ?? ""} ${item.blurb ?? ""} ${item.image?.title ?? ""} ${item.slug ?? ""}`.toLowerCase();
  const last = lastName(start.pitcher.name).toLowerCase();
  return text.includes(last) && pitcherActionHighlightPattern().test(text) && !nonActionMlbTitlePattern().test(text);
}

function isSinglePitchMlbActionFrame(item: MlbGameContentItem, start: StartSummary) {
  const text = `${item.title ?? ""} ${item.headline ?? ""} ${item.description ?? ""} ${item.blurb ?? ""} ${item.slug ?? ""}`.toLowerCase();
  const last = lastName(start.pitcher.name).toLowerCase();
  return text.includes(last) && singlePitchActionFramePattern().test(text) && !broadSummaryMlbTitlePattern().test(text);
}

function pitcherActionHighlightPattern() {
  return /\b(k'?s|fans?|strikes? out|called out on strikes|swinging strike|throws?|pitches?|first k|dominant start|quality start|outing)\b/i;
}

function singlePitchActionFramePattern() {
  return /\b(first k|first strikeout|called out on strikes|strikes out swinging|swinging strike)\b/i;
}

function broadSummaryMlbTitlePattern() {
  return /\b(dominant start|quality start|outing|game highlights?|win|strikes? out \d+|fans? \d+)\b|\d+\s*-\s*\d+/i;
}

function selectMlbImageCut(item: MlbGameContentItem | null) {
  const cuts = item?.image?.cuts ?? [];
  return cuts
    .filter((cut) => cut.src?.startsWith("https://img.mlbstatic.com/mlb-images/image/upload/") && cut.aspectRatio === "16:9")
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0] ?? null;
}

function normalizeMlbImageUrl(src: string) {
  return src.replace(/\/w_\d+,h_\d+,f_jpg,c_fill,g_auto\//, "/ar_16:9,g_auto,q_auto:good,w_2608,c_fill,f_jpg/");
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

async function writeCachedMlbGameContentActionImage(startId: string, image: TopPerformerImage) {
  await mkdir(CACHE_DIR, { recursive: true });
  const value: CachedMlbGameContentActionImage = {
    startId,
    imageUrl: image.imageUrl,
    alt: image.alt,
    objectPosition: image.objectPosition ?? "50% 50%",
    playUrl: image.playUrl,
    expiresAt: Date.now() + MLB_CONTENT_CACHE_TTL_MS,
  };
  await writeFile(mlbGameContentActionImageCachePath(startId), JSON.stringify(value, null, 2));
}

async function readCachedMlbGameContentActionImage(startId: string): Promise<CachedMlbGameContentActionImage | null> {
  const body = await readFile(mlbGameContentActionImageCachePath(startId), "utf8").catch(() => null);
  if (!body) return null;
  const value = JSON.parse(body) as CachedMlbGameContentActionImage;
  if (!value.imageUrl.startsWith("https://img.mlbstatic.com/mlb-images/image/upload/")) return null;
  return value.imageUrl && value.alt && value.objectPosition ? value : null;
}

function cacheManifestPath(startId: string) {
  return path.join(CACHE_DIR, `${safeFilePart(startId)}.json`);
}

function mlbGameContentActionImageCachePath(startId: string) {
  return path.join(CACHE_DIR, `${safeFilePart(startId)}-mlb-action-v4.json`);
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
