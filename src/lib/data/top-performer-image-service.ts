import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { clampActionPhotoObjectPosition, type ActionPhotoFocalPoint } from "@/lib/action-photo-focal";
import type { FeaturedStartHighlight, StartSummary } from "@/lib/types";

const CACHE_DIR = path.join(process.cwd(), "public", "images", "top-performer-action-shots");
const MLB_CONTENT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MLB_CONTENT_REVALIDATE_SECONDS = 10 * 60;
const PLACEHOLDER_IMAGE_URL = "/images/top-performer-placeholder.jpg";
const CADE_CAVALLI_JUNE_30_START_ID = "2026-06-30-wsh-bos-676917";

type TopPerformerImageSource = "action" | "placeholder";

export type TopPerformerImage = {
  source: TopPerformerImageSource;
  imageUrl: string;
  alt: string;
  attribution?: string;
  objectPosition?: string;
  mobileObjectPosition?: string;
  focalPoint?: ActionPhotoFocalPoint | null;
  playUrl?: string;
};

type CachedMlbGameContentActionImage = {
  startId: string;
  imageUrl: string;
  alt: string;
  attribution?: string;
  autoPromoted?: boolean;
  officialPitchingHighlight?: boolean;
  clean?: boolean;
  textFreeReviewed?: boolean;
  focalPoint?: {
    x: number;
    y: number;
  };
  focalX?: number | null;
  focalY?: number | null;
  focalXOverride?: number | null;
  focalYOverride?: number | null;
  objectPosition: string;
  mobileObjectPosition?: string;
  playUrl?: string;
  expiresAt: number;
};

type MlbGameContentItem = {
  type?: string;
  title?: string;
  headline?: string;
  description?: string;
  blurb?: string;
  id?: string;
  slug?: string;
  keywordsAll?: Array<{
    type?: string;
    value?: string;
    displayName?: string;
  }>;
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

type MlbGameContentActionCandidate = {
  item: MlbGameContentItem;
  score: number;
};

export async function resolveTopPerformerImage(start: StartSummary | null, _highlight: FeaturedStartHighlight | null): Promise<TopPerformerImage | null> {
  void _highlight;
  if (!start) return null;

  const cachedMlbGameContentAction = await readCachedMlbGameContentActionImage(start.id);
  if (cachedMlbGameContentAction && cachedMlbGameContentAction.expiresAt > Date.now()) {
    const focalPoint = cachedActionFocalPoint(cachedMlbGameContentAction);
    const objectPosition = clampActionPhotoObjectPosition({ focal: focalPoint });
    return {
      source: "action",
      imageUrl: cachedMlbGameContentAction.imageUrl,
      alt: cachedMlbGameContentAction.alt,
      attribution: displayPhotoAttribution(cachedMlbGameContentAction.attribution),
      objectPosition,
      mobileObjectPosition: mobileTopPerformerObjectPosition(start.id, objectPosition),
      focalPoint,
      playUrl: cachedMlbGameContentAction.playUrl,
    };
  }

  const latestApprovedPitcherAction = await readLatestApprovedPitcherActionImage(start);
  if (latestApprovedPitcherAction) {
    return topPerformerImageFromCachedAction(start.id, latestApprovedPitcherAction);
  }

  const mlbGameContentAction = await resolveMlbGameContentActionImage(start).catch(() => null);
  if (mlbGameContentAction) return mlbGameContentAction;

  return {
    source: "placeholder",
    imageUrl: PLACEHOLDER_IMAGE_URL,
    alt: "Pitcher's mound and rubber on a baseball field",
  };
}

function topPerformerImageFromCachedAction(startId: string, cachedAction: CachedMlbGameContentActionImage): TopPerformerImage {
  const focalPoint = cachedActionFocalPoint(cachedAction);
  const objectPosition = clampActionPhotoObjectPosition({ focal: focalPoint });
  return {
    source: "action",
    imageUrl: cachedAction.imageUrl,
    alt: cachedAction.alt,
    attribution: displayPhotoAttribution(cachedAction.attribution),
    objectPosition,
    mobileObjectPosition: mobileTopPerformerObjectPosition(startId, objectPosition),
    focalPoint,
    playUrl: cachedAction.playUrl,
  };
}

function mobileTopPerformerObjectPosition(startId: string, fallback: string) {
  if (startId === CADE_CAVALLI_JUNE_30_START_ID) return "68% 50%";
  return fallback;
}

async function resolveMlbGameContentActionImage(start: StartSummary): Promise<TopPerformerImage | null> {
  const response = await fetch(`https://statsapi.mlb.com/api/v1/game/${start.gamePk}/content`, { next: { revalidate: MLB_CONTENT_REVALIDATE_SECONDS } });
  if (!response.ok) return null;

  const content = await response.json() as MlbGameContent;
  const candidate = selectMlbGameContentActionCandidate(content, start);
  const item = candidate?.item ?? null;
  const cut = selectMlbImageCut(item);
  if (!candidate || !item || !cut?.src) return null;
  const autoPromoted = isAutoPromotableMlbGameContentAction(candidate, start);
  const objectPosition = clampActionPhotoObjectPosition({ focal: autoPromoted?.focalPoint });

  const image = {
    source: "action",
    imageUrl: normalizeMlbImageUrl(cut.src),
    alt: item.headline ?? item.title ?? `${start.pitcher.name} action photo`,
    attribution: displayPhotoAttribution(item.image?.title),
    objectPosition,
    mobileObjectPosition: mobileTopPerformerObjectPosition(start.id, objectPosition),
    focalPoint: autoPromoted?.focalPoint ?? null,
    playUrl: item.slug ? `https://www.mlb.com/video/${item.slug}` : undefined,
  } satisfies TopPerformerImage;

  await writeCachedMlbGameContentActionImage(start.id, image, autoPromoted).catch(() => undefined);
  return null;
}

function selectMlbGameContentActionCandidate(content: MlbGameContent, start: StartSummary): MlbGameContentActionCandidate | null {
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
    .sort((a, b) => b.score - a.score)[0] ?? null;
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

function displayPhotoAttribution(value?: string) {
  const attribution = value?.trim();
  if (!attribution) return undefined;

  const looksLikeInternalAssetMetadata =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(attribution) ||
    /^ap\d{10,}$/i.test(attribution) ||
    /^gettyimages-\d+(?:-\d+x\d+)?$/i.test(attribution) ||
    /^\d{8}[_-]/.test(attribution) ||
    /\.still\d+/i.test(attribution);
  if (looksLikeInternalAssetMetadata) return undefined;

  const looksLikeHumanCredit =
    /\b(?:credit|photo|images?|photography|reuters|associated press|imagn|usa today)\b/i.test(attribution) ||
    /\s\/\s/.test(attribution);
  return looksLikeHumanCredit ? attribution.replace(/^credit:\s*/i, "") : undefined;
}

function isMlbActionImageCandidate(item: MlbGameContentItem, start: StartSummary) {
  const text = `${item.title ?? ""} ${item.headline ?? ""} ${item.blurb ?? ""}`.toLowerCase();
  const pitcherNamed = text.includes(start.pitcher.name.toLowerCase()) || text.includes(lastName(start.pitcher.name).toLowerCase());
  return isPhotoCreditImageTitle(item.image?.title ?? "") || (pitcherNamed && isOfficialMlbPitchingHighlight(item));
}

function isOfficialMlbPitchingHighlight(item: MlbGameContentItem) {
  const tags = item.keywordsAll?.map((keyword) => `${keyword.value ?? ""} ${keyword.displayName ?? ""}`.toLowerCase()) ?? [];
  return tags.some((tag) => tag.includes("highlight-reel-pitching") || tag === "pitching pitching");
}

function isPitcherActionHighlight(item: MlbGameContentItem, start: StartSummary) {
  const text = `${item.title ?? ""} ${item.headline ?? ""} ${item.description ?? ""} ${item.blurb ?? ""} ${item.image?.title ?? ""} ${item.slug ?? ""}`.toLowerCase();
  const last = lastName(start.pitcher.name).toLowerCase();
  return text.includes(last) && pitcherActionHighlightPattern().test(text) && !nonActionMlbTitlePattern().test(text);
}

function pitcherActionHighlightPattern() {
  return /\b(k'?s|fans?|strikes? out|called out on strikes|swinging strike|throws?|pitches?|first k|dominant start|quality start|outing)\b/i;
}

function singlePitchActionFramePattern() {
  return /\b(first k|first strikeout|called out on strikes|strikes out swinging|swinging strike)\b/i;
}

function isAutoPromotableMlbGameContentAction(candidate: MlbGameContentActionCandidate, start: StartSummary): { focalPoint: { x: number; y: number }; officialPitchingHighlight: boolean } | null {
  const { item, score } = candidate;
  const text = `${item.title ?? ""} ${item.headline ?? ""} ${item.blurb ?? ""} ${item.image?.title ?? ""} ${item.slug ?? ""}`.toLowerCase();
  const fullName = start.pitcher.name.toLowerCase();
  const last = lastName(start.pitcher.name).toLowerCase();
  const isPitcherNamed = text.includes(fullName) || text.includes(last);
  const hasTrustedPhotoCredit = isPhotoCreditImageTitle(item.image?.title ?? "");
  const officialPitchingHighlight = isOfficialMlbPitchingHighlight(item);
  const hasPitchingActionCopy = pitcherActionHighlightPattern().test(text) || singlePitchActionFramePattern().test(text);
  if (!isPitcherNamed || (!hasTrustedPhotoCredit && !officialPitchingHighlight)) return null;
  if (nonActionMlbContentPattern().test(text) || nonActionMlbTitlePattern().test(text)) return null;
  if (score < 125 && !hasPitchingActionCopy) return null;
  return { focalPoint: { x: officialPitchingHighlight ? 50 : 62, y: 50 }, officialPitchingHighlight };
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

async function writeCachedMlbGameContentActionImage(startId: string, image: TopPerformerImage, autoPromotion: { focalPoint: { x: number; y: number }; officialPitchingHighlight: boolean } | null) {
  await mkdir(CACHE_DIR, { recursive: true });
  const value: CachedMlbGameContentActionImage = {
    startId,
    imageUrl: image.imageUrl,
    alt: image.alt,
    attribution: image.attribution,
    autoPromoted: Boolean(autoPromotion),
    officialPitchingHighlight: autoPromotion?.officialPitchingHighlight ?? false,
    clean: false,
    textFreeReviewed: false,
    focalPoint: autoPromotion?.focalPoint,
    focalX: autoPromotion?.focalPoint.x ?? null,
    focalY: autoPromotion?.focalPoint.y ?? null,
    focalXOverride: null,
    focalYOverride: null,
    objectPosition: image.objectPosition ?? "50% 50%",
    mobileObjectPosition: image.mobileObjectPosition,
    playUrl: image.playUrl,
    expiresAt: Date.now() + MLB_CONTENT_CACHE_TTL_MS,
  };
  await writeFile(mlbGameContentActionImageCachePath(startId), JSON.stringify(value, null, 2));
}

async function readCachedMlbGameContentActionImage(startId: string): Promise<CachedMlbGameContentActionImage | null> {
  const body = await readFile(mlbGameContentActionImageCachePath(startId), "utf8").catch(() => readDeployedActionImageMetadata(startId));
  if (!body) return null;
  let value: CachedMlbGameContentActionImage;
  try {
    value = JSON.parse(body) as CachedMlbGameContentActionImage;
  } catch {
    return null;
  }
  if (!isAllowedCuratedActionImageUrl(value.imageUrl)) return null;
  if (value.clean !== true) return null;
  if (value.autoPromoted === true && value.textFreeReviewed !== true) return null;
  if (value.focalPoint && !isValidFocalPoint(value.focalPoint)) return null;
  if (value.focalX !== undefined && value.focalX !== null && !isValidFocalCoordinate(value.focalX)) return null;
  if (value.focalY !== undefined && value.focalY !== null && !isValidFocalCoordinate(value.focalY)) return null;
  if (value.focalXOverride !== undefined && value.focalXOverride !== null && !isValidFocalCoordinate(value.focalXOverride)) return null;
  if (value.focalYOverride !== undefined && value.focalYOverride !== null && !isValidFocalCoordinate(value.focalYOverride)) return null;
  return value.imageUrl && value.alt && value.objectPosition ? value : null;
}

async function readDeployedActionImageMetadata(startId: string) {
  const deploymentHost = process.env.VERCEL_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!deploymentHost) return null;
  const baseUrl = /^https?:\/\//.test(deploymentHost) ? deploymentHost : `https://${deploymentHost}`;
  const filename = `${safeFilePart(startId)}-mlb-action-v4.json`;
  const response = await fetch(`${baseUrl}/images/top-performer-action-shots/${filename}`, {
    next: { revalidate: MLB_CONTENT_REVALIDATE_SECONDS },
  }).catch(() => null);
  if (!response?.ok) return null;
  return response.text();
}

async function readLatestApprovedPitcherActionImage(start: StartSummary): Promise<CachedMlbGameContentActionImage | null> {
  const pitcherId = String(start.pitcher.mlbId);
  const suffix = `-${pitcherId}-mlb-action-v4.json`;
  const filenames = await readdir(CACHE_DIR).catch(() => []);
  const candidateStartIds = filenames
    .filter((filename) => filename.endsWith(suffix))
    .map((filename) => filename.slice(0, -"-mlb-action-v4.json".length))
    .filter((startId) => startId !== start.id)
    .sort((a, b) => b.localeCompare(a));

  for (const startId of candidateStartIds) {
    const candidate = await readCachedMlbGameContentActionImage(startId);
    if (candidate && candidate.expiresAt > Date.now()) return candidate;
  }
  return null;
}

function isAllowedCuratedActionImageUrl(url: string) {
  return (
    url.startsWith("/images/top-performer-action-shots/") ||
    url.startsWith("https://img.mlbstatic.com/mlb-images/image/upload/") ||
    url.startsWith("https://images2.minutemediacdn.com/image/upload/") ||
    url.startsWith("https://s.hdnux.com/photos/")
  );
}

function isValidFocalPoint(value: CachedMlbGameContentActionImage["focalPoint"]): value is { x: number; y: number } {
  return !!value && Number.isFinite(value.x) && Number.isFinite(value.y) && value.x >= 0 && value.x <= 100 && value.y >= 0 && value.y <= 100;
}

function isValidFocalCoordinate(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function cachedActionFocalPoint(value: CachedMlbGameContentActionImage): ActionPhotoFocalPoint | null {
  const x = value.focalXOverride ?? value.focalX ?? value.focalPoint?.x ?? null;
  const y = value.focalYOverride ?? value.focalY ?? value.focalPoint?.y ?? null;
  if (x === null || y === null || !isValidFocalCoordinate(x) || !isValidFocalCoordinate(y)) return null;
  return { x, y };
}

function mlbGameContentActionImageCachePath(startId: string) {
  return path.join(CACHE_DIR, `${safeFilePart(startId)}-mlb-action-v4.json`);
}

function safeFilePart(value: string) {
  return value.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
}

function lastName(name: string) {
  return name.trim().split(/\s+/).at(-1) ?? name;
}
