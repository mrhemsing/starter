import type { FeaturedStartHighlight, StartSummary } from "@/lib/types";
import { readSupabaseFeaturedStartHighlight } from "@/lib/data/supabase-archive";
import { resolveMlbChannelId, resolveYouTubeHighlight as discoverYouTubeHighlight } from "@/lib/data/highlight-discovery";
import { seasonReviewMedia2026 } from "@/lib/season-review-media";
import { seasonStartMedia2026 } from "@/lib/season-start-media";

const CACHE_TTL_MS = 18 * 60 * 60 * 1000;
const YOUTUBE_SEARCH_ENABLED = process.env.YOUTUBE_SEARCH_ENABLED === "1";
const MANUAL_HIGHLIGHT_VIDEO_IDS_BY_START_ID: Record<string, string> = {
  "2026-09-07-phi-atl-666200": "1vnqtnNjMyc",
  "2026-08-27-atl-lad-519242": "bJ2zfIE18fk",
  "2026-09-01-cle-tor-668909": "yltnsbobT5Q",
  "2026-06-12-mil-phi-694819": "MaAOy8pY36c",
  "2026-06-14-sf-chc-657277": "WfT4TJqUs_E",
  "2026-06-19-nyy-cin-693645": "JkWrVSnrgB4",
  "2026-06-22-mil-cin-605540": "oHw4ASegTcI",
  "2026-06-25-hou-det-837227": "fSu5y2kmChE",
  "2026-06-29-det-nyy-663554": "Z1ZawNQNDh8",
  "2026-06-30-wsh-bos-676917": "C-uwf39UDjw",
  "2026-07-05-min-nyy-657746": "tMUgTt5EwLQ",
  "2026-07-07-phi-cin-554430": "dq9meO_64Fk",
  "2026-07-08-tor-sf-656302": "0AmJgvdkVbk",
  "2026-07-10-cin-chc-668881": "pNxl8o2NWNw",
  "2026-07-24-nyy-phi-693645": "6_lnzZ-p6SU",
  "2026-07-25-tor-bos-656302": "HZ3S7-D0zR8",
  "2026-07-26-tb-cle-656876": "vDaMgzkETOc",
};

type CachedResolution = {
  value: FeaturedStartHighlight | null;
  expiresAt: number;
};

type HighlightStart = Pick<StartSummary, "id" | "date" | "pitcher" | "highlightVideoId">;
const resolutionCache = new Map<string, CachedResolution>();
export async function resolveFeaturedStartHighlight(start: HighlightStart | null): Promise<FeaturedStartHighlight | null> {
  if (!start) return null;

  // Published archive references are shared by hub, homepage and start detail.
  const published = seasonReviewMedia2026.highlights[start.id];
  if (published) return published;
  const settled = seasonStartMedia2026[start.id];
  if (settled?.highlight) return settled.highlight;

  const cached = resolutionCache.get(start.id);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  if (start.highlightVideoId) {
    return cacheResolution(start.id, highlightFromVideoId(start.highlightVideoId, "manual", false));
  }

  const manualVideoId = MANUAL_HIGHLIGHT_VIDEO_IDS_BY_START_ID[start.id];
  if (manualVideoId) {
    return cacheResolution(start.id, highlightFromVideoId(manualVideoId, "manual", false));
  }

  const stored = await readSupabaseFeaturedStartHighlight(start.id);
  if (stored) return cacheResolution(start.id, stored);

  // Keep existing attributed references, but never trigger unscoped live discovery
  // for a start already covered by the controlled settled-season lookup.
  if (settled) return cacheResolution(start.id, null);

  if (!YOUTUBE_SEARCH_ENABLED) return cacheResolution(start.id, null);

  const resolved = await resolveYouTubeHighlight(start).catch(() => null);
  return cacheResolution(start.id, resolved);
}

function cacheResolution(startId: string, value: FeaturedStartHighlight | null) {
  resolutionCache.set(startId, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return value;
}

async function resolveYouTubeHighlight(start: HighlightStart): Promise<FeaturedStartHighlight | null> {
 const youtubeApiKey = process.env.YOUTUBE_API_KEY;
 if (!youtubeApiKey) return null;
 const mlbChannelId = await resolveMlbChannelId(youtubeApiKey);
 if (!mlbChannelId) return null;
 const result = await discoverYouTubeHighlight({start, youtubeApiKey, mlbChannelId});
 return result ? highlightFromVideoId(result.videoId, "youtube-search", result.durationSeconds !== null && result.durationSeconds < 60) : null;
}
function highlightFromVideoId(videoId: string, source: FeaturedStartHighlight["source"], isShort: boolean): FeaturedStartHighlight {
  return {
    videoId,
    source,
    isShort,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}
