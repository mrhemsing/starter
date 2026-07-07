import { getFormLeaderboard } from "@/lib/data/form-service";
import { readRuntimeState, writeRuntimeState } from "@/lib/data/runtime-state-store";
import { getKnownWatchlistPitcherIds, type WatchlistWireEvent } from "@/lib/data/watchlist-service";
import type { FormSummary } from "@/lib/types";

export type WatchlistHeadlineSource = "google-news" | "mlb-trade-rumors" | "espn";

type HeadlineCandidate = {
  pitcherId: string;
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
  sourceType: WatchlistHeadlineSource;
};

type StoredHeadline = {
  id: string;
  pitcherId: string;
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
  detectedAt: string;
  sourceType: WatchlistHeadlineSource;
};

type PitcherHeadlineState = {
  version: 4;
  pitcherId: string;
  updatedAt: string;
  headlines: StoredHeadline[];
};

type HeadlineBreakerState = {
  source: WatchlistHeadlineSource;
  disabledUntil: string;
  reason: string;
  updatedAt: string;
};

type EspnIdMapState = {
  ids: Record<string, string>;
  updatedAt: string;
};

type HeadlineAdapter = {
  source: WatchlistHeadlineSource;
  fetch: (pitcher: FormSummary) => Promise<HeadlineCandidate[]>;
};

export type WatchlistHeadlineIngestResult = {
  attempted: boolean;
  reason?: string;
  followedPitchers: number;
  fetched: number;
  written: number;
  skipped: Record<string, number>;
  sources: Array<{ source: WatchlistHeadlineSource; enabled: boolean; skippedByBreaker: boolean }>;
};

const HEADLINE_STATE_VERSION = 4;
const HEADLINE_EXPIRY_MS = 72 * 60 * 60 * 1000;
const HEADLINE_DEDUPE_WINDOW_MS = 96 * 60 * 60 * 1000;
const HEADLINE_MAX_LENGTH = 120;
const HEADLINE_PRIORITY = 35;
const NEWS_RSS_TIMEOUT_MS = 8000;
const GOOGLE_NEWS_ARTICLE_RESOLVE_LIMIT = 20;
const PROFILE_HEADLINE_FETCH_RETRY_MS = 30 * 60 * 1000;
const DEFAULT_USER_AGENT = "ToeTheSlab/1.0 watchlist-headlines";

export async function readWatchlistHeadlineEvents(pitcherIds: string[]): Promise<Map<string, WatchlistWireEvent[]>> {
  const events = new Map<string, WatchlistWireEvent[]>();
  const states = await Promise.all(pitcherIds.map((pitcherId) => readPitcherHeadlineState(pitcherId)));
  const now = Date.now();

  for (const state of states) {
    if (!state) continue;
    const items = collapseHeadlineClusters(state.headlines)
      .filter((headline) => now - Date.parse(headline.publishedAt) <= HEADLINE_EXPIRY_MS)
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
      .map(headlineToWireEvent);
    if (items.length > 0) events.set(state.pitcherId, items);
  }

  return events;
}

export async function readOrFetchPitcherHeadlineEvents(pitchers: FormSummary[]): Promise<Map<string, WatchlistWireEvent[]>> {
  const events = await readWatchlistHeadlineEvents(pitchers.map((pitcher) => pitcher.pitcherId));
  const missingPitchers = pitchers.filter((pitcher) => !events.has(pitcher.pitcherId));
  if (missingPitchers.length === 0) return events;

  const leaderboard = await getFormLeaderboard({ qualifiedOnly: false });
  const allPitchers = leaderboard.pitchers;
  const adapters = await activeAdapters();

  await Promise.all(missingPitchers.map(async (pitcher) => {
    const cachedAttempt = await readRuntimeState<{ checkedAt: string }>(headlineFetchAttemptKey(pitcher.pitcherId));
    if (cachedAttempt && Date.now() - Date.parse(cachedAttempt.checkedAt) < PROFILE_HEADLINE_FETCH_RETRY_MS) return;
    await writeRuntimeState(headlineFetchAttemptKey(pitcher.pitcherId), { checkedAt: new Date().toISOString() });

    for (const adapter of adapters) {
      if (await isSourceBreakerOpen(adapter.source)) continue;
      try {
        const candidates = await adapter.fetch(pitcher);
        for (const candidate of candidates) {
          const filtered = filterHeadlineCandidate(candidate, pitcher, allPitchers);
          if (filtered) await appendHeadline(filtered);
        }
      } catch (error) {
        await openSourceBreaker(adapter.source, error instanceof Error ? error.message : "schema drift");
        console.warn("[watchlist-headlines] profile source breaker opened", { source: adapter.source, reason: error instanceof Error ? error.message : "unknown" });
      }
    }
  }));

  return readWatchlistHeadlineEvents(pitchers.map((pitcher) => pitcher.pitcherId));
}

export async function ingestWatchlistHeadlines(): Promise<WatchlistHeadlineIngestResult> {
  if (!isHeadlinePollingWindow(new Date())) {
    return { attempted: false, reason: "outside-hourly-cadence", followedPitchers: 0, fetched: 0, written: 0, skipped: {}, sources: [] };
  }

  const pitcherIds = await getKnownWatchlistPitcherIds();
  if (pitcherIds.length === 0) {
    return { attempted: false, followedPitchers: 0, fetched: 0, written: 0, skipped: {}, sources: [] };
  }

  const leaderboard = await getFormLeaderboard({ qualifiedOnly: false });
  const pitchers = pitcherIds
    .map((pitcherId) => leaderboard.pitchers.find((pitcher) => pitcher.pitcherId === pitcherId))
    .filter((pitcher): pitcher is FormSummary => Boolean(pitcher));
  const allPitchers = leaderboard.pitchers;
  const adapters = await activeAdapters();
  const result: WatchlistHeadlineIngestResult = {
    attempted: true,
    followedPitchers: pitchers.length,
    fetched: 0,
    written: 0,
    skipped: {},
    sources: adapters.map((adapter) => ({ source: adapter.source, enabled: true, skippedByBreaker: false })),
  };

  for (const adapter of adapters) {
    if (await isSourceBreakerOpen(adapter.source)) {
      result.sources = result.sources.map((source) => source.source === adapter.source ? { ...source, skippedByBreaker: true } : source);
      continue;
    }

    for (const pitcher of pitchers) {
      try {
        const candidates = await adapter.fetch(pitcher);
        result.fetched += candidates.length;
        for (const candidate of candidates) {
          const filtered = filterHeadlineCandidate(candidate, pitcher, allPitchers);
          if (!filtered) {
            increment(result.skipped, "irrelevant");
            continue;
          }
          const wrote = await appendHeadline(filtered);
          if (wrote) result.written += 1;
          else increment(result.skipped, "duplicate");
        }
      } catch (error) {
        await openSourceBreaker(adapter.source, error instanceof Error ? error.message : "schema drift");
        console.warn("[watchlist-headlines] source breaker opened", { source: adapter.source, reason: error instanceof Error ? error.message : "unknown" });
        break;
      }
    }
  }

  return result;
}

async function activeAdapters(): Promise<HeadlineAdapter[]> {
  const adapters: HeadlineAdapter[] = [];
  if (sourceEnabled("THE_BUMP_WIRE_GOOGLE_NEWS_ENABLED", true)) adapters.push({ source: "google-news", fetch: fetchGoogleNewsHeadlines });
  if (sourceEnabled("THE_BUMP_WIRE_MLBTR_ENABLED", true)) adapters.push({ source: "mlb-trade-rumors", fetch: fetchMlbTradeRumorsHeadlines });
  if (sourceEnabled("THE_BUMP_WIRE_ESPN_ENABLED", true)) adapters.push({ source: "espn", fetch: fetchEspnHeadlines });
  return adapters;
}

async function fetchGoogleNewsHeadlines(pitcher: FormSummary): Promise<HeadlineCandidate[]> {
  const query = `${pitcher.name} ${teamNickname(pitcher.team)}`.trim();
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");
  const xml = await fetchText(url.toString());
  const items = parseRssItems(xml).slice(0, GOOGLE_NEWS_ARTICLE_RESOLVE_LIMIT);
  return Promise.all(items.map(async (item) => {
    const resolved = await resolveGoogleNewsArticleMetadata(item.link);
    return {
      pitcherId: pitcher.pitcherId,
      headline: item.title,
      source: resolved?.source || item.source || "Google News",
      url: resolved?.url || item.link,
      publishedAt: resolved?.publishedAt || item.pubDate,
      sourceType: "google-news" as const,
    };
  }));
}

async function fetchMlbTradeRumorsHeadlines(pitcher: FormSummary): Promise<HeadlineCandidate[]> {
  const slug = await mlbTradeRumorsSlug(pitcher);
  const response = await fetch(`https://www.mlbtraderumors.com/players/${slug}/feed`, {
    headers: { "user-agent": DEFAULT_USER_AGENT },
    next: { revalidate: 30 * 60 },
  });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`mlbtr ${response.status}`);
  const xml = await response.text();
  return parseRssItems(xml).map((item) => ({
    pitcherId: pitcher.pitcherId,
    headline: item.title,
    source: "MLB Trade Rumors",
    url: item.link,
    publishedAt: item.pubDate,
    sourceType: "mlb-trade-rumors",
  }));
}

async function fetchEspnHeadlines(pitcher: FormSummary): Promise<HeadlineCandidate[]> {
  const espnId = await espnAthleteIdFor(pitcher);
  if (!espnId) return [];
  const payload = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?athlete=${espnId}`);
  const rawItems = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.articles) ? payload.articles : [];
  return rawItems.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const headline = typeof record.headline === "string" ? record.headline : typeof record.title === "string" ? record.title : "";
    const url = typeof record.link === "string" ? record.link : articleLink(record.link) ?? articleLink(record.links) ?? (typeof record.webUrl === "string" ? record.webUrl : "");
    const publishedAt = typeof record.published === "string" ? record.published : typeof record.publishedAt === "string" ? record.publishedAt : "";
    if (!headline || !url || !publishedAt) return [];
    return [{
      pitcherId: pitcher.pitcherId,
      headline,
      source: "ESPN",
      url,
      publishedAt,
      sourceType: "espn" as const,
    }];
  });
}

function filterHeadlineCandidate(candidate: HeadlineCandidate, pitcher: FormSummary, allPitchers: FormSummary[]) {
  const source = truncateHeadline(decodeHtml(stripTags(candidate.source)).trim());
  const headline = truncateHeadline(stripSourceSuffix(decodeHtml(stripTags(candidate.headline)).trim(), source));
  const url = canonicalUrl(candidate.url);
  const publishedAt = normalizePublishedAt(candidate.publishedAt);
  if (!headline || !url || !publishedAt) return null;

  const headlineTokens = new Set(normalizedTokens(headline));
  const pitcherTokens = normalizedTokens(pitcher.name);
  const surname = lastName(pitcher.name);
  if (!headlineTokens.has(normalizeText(surname))) return null;
  if (candidate.sourceType === "google-news" && !containsTokenPhrase(headlineTokens, pitcherTokens) && !containsTokenPhrase(headlineTokens, normalizedTokens(teamNickname(pitcher.team)))) return null;

  for (const other of allPitchers) {
    if (other.pitcherId === pitcher.pitcherId) continue;
    if (containsTokenPhrase(headlineTokens, normalizedTokens(other.name)) && !containsTokenPhrase(headlineTokens, pitcherTokens)) return null;
  }

  return {
    ...candidate,
    headline,
    url,
    publishedAt,
    source,
  };
}

async function appendHeadline(candidate: HeadlineCandidate) {
  const state = await readPitcherHeadlineState(candidate.pitcherId) ?? {
    version: HEADLINE_STATE_VERSION,
    pitcherId: candidate.pitcherId,
    updatedAt: new Date().toISOString(),
    headlines: [],
  };
  const now = new Date().toISOString();
  const recent = state.headlines.filter((headline) => Date.parse(now) - Date.parse(headline.publishedAt) <= HEADLINE_EXPIRY_MS);
  const duplicate = recent.find((headline) => isDuplicateHeadline(headline, candidate));
  if (duplicate) {
    const preferred = preferredHeadline(duplicate, candidate);
    if (preferred === duplicate) return false;
    const withoutDuplicate = recent.filter((headline) => headline.id !== duplicate.id);
    await writeRuntimeState(headlineStateKey(candidate.pitcherId), {
      ...state,
      updatedAt: now,
      headlines: [
        ...withoutDuplicate,
        storedHeadlineFromCandidate(candidate, now),
      ].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 20),
    });
    return true;
  }
  const next: PitcherHeadlineState = {
    ...state,
    updatedAt: now,
    headlines: [
      ...recent,
      storedHeadlineFromCandidate(candidate, now),
    ].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 20),
  };
  await writeRuntimeState(headlineStateKey(candidate.pitcherId), next);
  return true;
}

function headlineToWireEvent(headline: StoredHeadline): WatchlistWireEvent {
  const displayHeadline = truncateHeadline(stripSourceSuffix(headline.headline, headline.source));
  return {
    key: "headlines",
    label: "NEWS",
    sentence: null,
    detectedAt: headline.detectedAt,
    priority: HEADLINE_PRIORITY,
    payloadValues: [displayHeadline, headline.source, headline.url, headline.publishedAt],
    headline: {
      text: displayHeadline,
      source: headline.source,
      url: headline.url,
      publishedAt: headline.publishedAt,
    },
  };
}

async function readPitcherHeadlineState(pitcherId: string) {
  const state = await readRuntimeState<PitcherHeadlineState>(headlineStateKey(pitcherId));
  return state?.version === HEADLINE_STATE_VERSION && Array.isArray(state.headlines) ? state : null;
}

function parseRssItems(xml: string) {
  const matches = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)];
  return matches.map((match) => {
    const item = match[0];
    return {
      title: tagText(item, "title"),
      link: tagText(item, "link"),
      pubDate: tagText(item, "pubDate"),
      source: tagText(item, "source"),
    };
  }).filter((item) => item.title && item.link && item.pubDate);
}

function tagText(xml: string, tag: string) {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml);
  return decodeCdata(match?.[1] ?? "").trim();
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: { "user-agent": DEFAULT_USER_AGENT },
    next: { revalidate: 30 * 60 },
    signal: AbortSignal.timeout(NEWS_RSS_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`headline source ${response.status}`);
  return response.text();
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: { "user-agent": DEFAULT_USER_AGENT },
    next: { revalidate: 30 * 60 },
    signal: AbortSignal.timeout(NEWS_RSS_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`espn ${response.status}`);
  return response.json() as Promise<{ items?: unknown[]; articles?: unknown[] } | null>;
}

async function resolveGoogleNewsArticleMetadata(url: string) {
  const publisherUrl = await decodeGoogleNewsArticleUrl(url);
  if (!publisherUrl) return null;
  const metadata = await fetchPublisherArticleMetadata(publisherUrl);
  return {
    url: metadata?.url || publisherUrl,
    publishedAt: metadata?.publishedAt ?? "",
    source: metadata?.source ?? "",
  };
}

async function decodeGoogleNewsArticleUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "news.google.com" || !parsed.pathname.includes("/articles/")) return url;
    const html = await fetchText(url);
    const articleId = html.match(/data-n-a-id="([^"]+)"/)?.[1];
    const timestamp = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
    const signature = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
    if (!articleId || !timestamp || !signature) return null;
    const request = JSON.stringify([
      "garturlreq",
      googleNewsArticleContext(),
      articleId,
      Number(timestamp),
      signature,
    ]);
    const body = new URLSearchParams({
      "f.req": JSON.stringify([[
        ["Fbv4je", request, null, "generic"],
      ]]),
    });
    const response = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "user-agent": DEFAULT_USER_AGENT,
      },
      next: { revalidate: 30 * 60 },
      signal: AbortSignal.timeout(NEWS_RSS_TIMEOUT_MS),
      body,
    });
    if (!response.ok) return null;
    const payload = await response.text();
    const jsonStart = payload.indexOf("[[");
    if (jsonStart === -1) return null;
    const rows = JSON.parse(payload.slice(jsonStart)) as unknown[];
    const row = rows.find((entry) => Array.isArray(entry) && entry[0] === "wrb.fr") as unknown[] | undefined;
    const encoded = typeof row?.[2] === "string" ? row[2] : "";
    if (!encoded) return null;
    const decoded = JSON.parse(encoded) as unknown[];
    const resolvedUrl = typeof decoded[1] === "string" ? decoded[1] : "";
    return resolvedUrl ? canonicalUrl(resolvedUrl) : null;
  } catch {
    return null;
  }
}

function googleNewsArticleContext() {
  return [
    ["en-US", "US", ["FINANCE_TOP_INDICES", "GENESIS_PUBLISHER_SECTION", "WEB_TEST_1_0_0"], null, null, 1, 1, "US:en", null, null, null, null, null, null, null, false, 5],
    "en-US",
    "US",
    true,
    [3, 5, 9, 19],
    1,
    true,
    "941921773",
    null,
    null,
    null,
    false,
  ];
}

async function fetchPublisherArticleMetadata(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "msn.com" || parsed.hostname.endsWith(".msn.com")) {
      const metadata = await fetchMsnArticleMetadata(url);
      if (metadata) return metadata;
    }
    const response = await fetch(url, {
      headers: { "user-agent": DEFAULT_USER_AGENT },
      next: { revalidate: 30 * 60 },
      signal: AbortSignal.timeout(NEWS_RSS_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const html = await response.text();
    const publishedAt = extractArticlePublishedAt(html);
    const source = extractArticleSource(html);
    return publishedAt || source ? { url, publishedAt, source } : null;
  } catch {
    return null;
  }
}

async function fetchMsnArticleMetadata(url: string) {
  const articleId = /\/ar-([A-Za-z0-9]+)/.exec(url)?.[1];
  if (!articleId) return null;
  const payload = await fetchJson(`https://assets.msn.com/content/view/v2/Detail/en-us/${articleId}`) as Record<string, unknown> | null;
  if (!payload) return null;
  const sourceHref = typeof payload.sourceHref === "string" ? payload.sourceHref : url;
  const provider = payload.provider && typeof payload.provider === "object" ? payload.provider as Record<string, unknown> : null;
  const source = typeof provider?.name === "string" ? provider.name : typeof payload.source === "string" ? payload.source : "";
  const publishedAt = typeof payload.publishedDateTime === "string"
    ? payload.publishedDateTime
    : typeof payload.createdDateTime === "string"
      ? payload.createdDateTime
      : "";
  return { url: sourceHref, publishedAt, source };
}

function extractArticlePublishedAt(html: string) {
  const patterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+name=["'](?:pubdate|publishdate|date|sailthru\.date)["'][^>]+content=["']([^"']+)/i,
    /<time[^>]+datetime=["']([^"']+)/i,
    /"datePublished"\s*:\s*"([^"]+)/i,
    /"publishedDate"\s*:\s*"([^"]+)/i,
    /"publishedDateTime"\s*:\s*"([^"]+)/i,
  ];
  for (const pattern of patterns) {
    const value = pattern.exec(html)?.[1];
    const publishedAt = value ? normalizePublishedAt(decodeHtml(value)) : "";
    if (publishedAt) return publishedAt;
  }
  return "";
}

function extractArticleSource(html: string) {
  const patterns = [
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+name=["']application-name["'][^>]+content=["']([^"']+)/i,
  ];
  for (const pattern of patterns) {
    const source = pattern.exec(html)?.[1];
    if (source) return truncateHeadline(decodeHtml(source).trim());
  }
  return "";
}

async function mlbTradeRumorsSlug(pitcher: FormSummary) {
  const key = `watchlist-headline-slug:${pitcher.pitcherId}`;
  const cached = await readRuntimeState<{ slug: string }>(key);
  if (cached?.slug) return cached.slug;
  const slug = slugify(pitcher.name);
  await writeRuntimeState(key, { slug, updatedAt: new Date().toISOString() });
  return slug;
}

async function espnAthleteIdFor(pitcher: FormSummary) {
  const configured = parseEspnIdMap(process.env.THE_BUMP_ESPN_ATHLETE_IDS);
  if (configured[pitcher.pitcherId]) return configured[pitcher.pitcherId];
  const state = await readRuntimeState<EspnIdMapState>("watchlist-headline-espn-ids");
  if (state?.ids?.[pitcher.pitcherId]) return state.ids[pitcher.pitcherId];
  const resolved = await resolveEspnAthleteId(pitcher);
  if (!resolved) return null;
  await writeRuntimeState("watchlist-headline-espn-ids", {
    ids: { ...(state?.ids ?? {}), [pitcher.pitcherId]: resolved },
    updatedAt: new Date().toISOString(),
  });
  return resolved;
}

function parseEspnIdMap(raw: string | undefined) {
  if (!raw) return {} as Record<string, string>;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => /^\d+$/.test(entry[0]) && typeof entry[1] === "string" && /^\d+$/.test(entry[1])));
  } catch {
    return {};
  }
}

async function resolveEspnAthleteId(pitcher: FormSummary) {
  const url = new URL("https://site.web.api.espn.com/apis/search/v2");
  url.searchParams.set("query", pitcher.name);
  url.searchParams.set("type", "player");
  url.searchParams.set("limit", "10");
  const payload = await fetchJson(url.toString());
  const results = Array.isArray((payload as { results?: unknown[] } | null)?.results) ? (payload as { results: unknown[] }).results : [];
  const candidates = results.flatMap((group) => {
    if (!group || typeof group !== "object") return [];
    const contents = (group as { type?: unknown; contents?: unknown }).contents;
    if ((group as { type?: unknown }).type !== "player" || !Array.isArray(contents)) return [];
    return contents;
  });

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const item = candidate as Record<string, unknown>;
    const displayName = typeof item.displayName === "string" ? item.displayName : "";
    const league = typeof item.defaultLeagueSlug === "string" ? item.defaultLeagueSlug : "";
    const sport = typeof item.sport === "string" ? item.sport : "";
    const subtitle = typeof item.subtitle === "string" ? item.subtitle : "";
    const uid = typeof item.uid === "string" ? item.uid : "";
    if (normalizeText(displayName) !== normalizeText(pitcher.name)) continue;
    if (league !== "mlb" || sport !== "baseball") continue;
    if (subtitle && !normalizeText(subtitle).includes(normalizeText(teamNickname(pitcher.team)))) continue;
    const id = /~a:(\d+)/.exec(uid)?.[1] ?? athleteIdFromLink(item.link);
    if (id) return id;
  }

  return null;
}

function athleteIdFromLink(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const web = (value as { web?: unknown }).web;
  if (typeof web !== "string") return null;
  return /\/id\/(\d+)/.exec(web)?.[1] ?? null;
}

function articleLink(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const href = (value as { href?: unknown }).href;
  if (typeof href === "string") return href;
  const web = (value as { web?: unknown }).web;
  if (web && typeof web === "object") {
    const webHref = (web as { href?: unknown }).href;
    if (typeof webHref === "string") return webHref;
  }
  return null;
}

async function isSourceBreakerOpen(source: WatchlistHeadlineSource) {
  const state = await readRuntimeState<HeadlineBreakerState>(breakerStateKey(source));
  return state ? Date.parse(state.disabledUntil) > Date.now() : false;
}

async function openSourceBreaker(source: WatchlistHeadlineSource, reason: string) {
  await writeRuntimeState(breakerStateKey(source), {
    source,
    reason,
    disabledUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

function isDuplicateHeadline(existing: StoredHeadline, candidate: HeadlineCandidate) {
  if (existing.url === candidate.url) return true;
  if (normalizeHeadlineTitle(existing.headline) === normalizeHeadlineTitle(candidate.headline)) return true;
  const withinWindow = Math.abs(Date.parse(existing.publishedAt) - Date.parse(candidate.publishedAt)) <= HEADLINE_DEDUPE_WINDOW_MS;
  if (!withinWindow) return false;
  return titleSimilarity(existing.headline, candidate.headline) >= 0.85 || sameHeadlineCluster(existing.headline, candidate.headline);
}

function titleSimilarity(a: string, b: string) {
  const aTokens = new Set(normalizeHeadlineTitle(a).split(" ").filter(Boolean));
  const bTokens = new Set(normalizeHeadlineTitle(b).split(" ").filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return intersection / union;
}

function collapseHeadlineClusters(headlines: StoredHeadline[]) {
  const kept: StoredHeadline[] = [];
  for (const headline of [...headlines].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))) {
    const duplicateIndex = kept.findIndex((existing) => isDuplicateHeadline(existing, headline));
    if (duplicateIndex === -1) {
      kept.push(headline);
      continue;
    }
    const preferred = preferredHeadline(kept[duplicateIndex], headline);
    if (preferred !== kept[duplicateIndex]) kept[duplicateIndex] = preferred;
  }
  return kept.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

function storedHeadlineFromCandidate(candidate: HeadlineCandidate, detectedAt: string): StoredHeadline {
  return {
    id: stableHeadlineId(candidate),
    pitcherId: candidate.pitcherId,
    headline: candidate.headline,
    source: candidate.source,
    url: candidate.url,
    publishedAt: candidate.publishedAt,
    detectedAt,
    sourceType: candidate.sourceType,
  };
}

function preferredHeadline<T extends Pick<StoredHeadline, "url" | "publishedAt">>(a: T, b: T) {
  const aSyndicator = isSyndicatorUrl(a.url);
  const bSyndicator = isSyndicatorUrl(b.url);
  if (aSyndicator !== bSyndicator) return aSyndicator ? b : a;
  return Date.parse(a.publishedAt) <= Date.parse(b.publishedAt) ? a : b;
}

function isSyndicatorUrl(raw: string) {
  try {
    const hostname = new URL(raw).hostname.toLowerCase();
    return SYNDICATOR_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

const SYNDICATOR_HOSTS = ["msn.com"];

function sameHeadlineCluster(a: string, b: string) {
  const aKey = eventTopicKey(a);
  const bKey = eventTopicKey(b);
  if (aKey && aKey === bKey) return true;

  const aTokens = headlineTopicTokens(a);
  const bTokens = headlineTopicTokens(b);
  if (aTokens.length < 3 || bTokens.length < 3) return false;
  const shared = aTokens.filter((token) => bTokens.includes(token));
  const smaller = Math.min(aTokens.length, bTokens.length);
  return shared.length >= 3 && shared.length / smaller >= 0.6;
}

function eventTopicKey(value: string) {
  const text = normalizeText(stripSourceSuffix(value));
  if (/\ball\s+star(s)?\b/.test(text) || text.includes("allstar")) return "all-star";
  if ((text.includes("shut out") || text.includes("shutout")) && text.includes("mariners")) return "shutout-mariners";
  if (text.includes("fans") && /\b\d+\b/.test(text)) return `strikeouts-${text.match(/\b\d+\b/)?.[0] ?? ""}`;
  return "";
}

function headlineTopicTokens(value: string) {
  return Array.from(new Set(normalizeText(stripSourceSuffix(value)).split(" ").filter((token) => token.length > 2 && !HEADLINE_TOPIC_STOP_WORDS.has(token))));
}

function stripSourceSuffix(value: string, source?: string) {
  let clean = value.trim();
  const sourceLabel = source?.trim();
  if (sourceLabel) {
    clean = clean.replace(new RegExp(`\\s+-\\s+${escapeRegExp(sourceLabel)}\\s*$`, "i"), "");
  }
  return clean.replace(HEADLINE_SOURCE_SUFFIX_PATTERN, "").trim();
}

export function normalizeHeadlineTitle(value: string) {
  return normalizeText(stripSourceSuffix(decodeHtml(stripTags(value)))).replace(/\s+/g, " ").trim();
}

const HEADLINE_TOPIC_STOP_WORDS = new Set([
  "and",
  "are",
  "but",
  "com",
  "for",
  "from",
  "game",
  "heading",
  "into",
  "jays",
  "journal",
  "mlb",
  "msn",
  "news",
  "sport",
  "sports",
  "sportsnet",
  "star",
  "the",
  "toronto",
  "with",
]);

const HEADLINE_SOURCE_SUFFIX_PATTERN = /\s+-\s+(?:espn|fantasypros|google news|jays journal|mlb(?:\.com)?|mlb news|mlb trade rumors|msn|newsweek|rotoballer|roundtable\.io|si(?:\.com)?|sports illustrated|sportsnet(?:\.ca)?|the athletic|toronto star|yahoo sports)\s*$/i;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function canonicalUrl(raw: string) {
  try {
    const url = new URL(decodeHtml(raw));
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "ved" || key === "usg" || key === "fbclid" || key === "gclid") url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return "";
  }
}

function normalizePublishedAt(raw: string) {
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

function truncateHeadline(value: string) {
  return value.length > HEADLINE_MAX_LENGTH ? `${value.slice(0, HEADLINE_MAX_LENGTH - 1).trimEnd()}…` : value;
}

function sourceEnabled(name: string, fallback: boolean) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw !== "0" && raw.toLowerCase() !== "false";
}

function isHeadlinePollingWindow(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    minute: "numeric",
    timeZone: "America/Los_Angeles",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  if (hour >= 6 && hour < 23) return true;
  return minute === 0;
}

function stableHeadlineId(candidate: HeadlineCandidate) {
  return `${candidate.pitcherId}:${normalizeText(candidate.headline).slice(0, 48)}:${Date.parse(candidate.publishedAt) || 0}`;
}

function headlineStateKey(pitcherId: string) {
  return `watchlist-headlines:${pitcherId}`;
}

function headlineFetchAttemptKey(pitcherId: string) {
  return `watchlist-headline-fetch:${pitcherId}`;
}

function breakerStateKey(source: WatchlistHeadlineSource) {
  return `watchlist-headline-breaker:${source}`;
}

function increment(target: Record<string, number>, key: string) {
  target[key] = (target[key] ?? 0) + 1;
}

function teamNickname(team: string) {
  return TEAM_NICKNAMES[team.toUpperCase()] ?? team;
}

const TEAM_NICKNAMES: Record<string, string> = {
  AZ: "Diamondbacks",
  ATL: "Braves",
  BAL: "Orioles",
  BOS: "Red Sox",
  CHC: "Cubs",
  CWS: "White Sox",
  CIN: "Reds",
  CLE: "Guardians",
  COL: "Rockies",
  DET: "Tigers",
  HOU: "Astros",
  KC: "Royals",
  LAA: "Angels",
  LAD: "Dodgers",
  MIA: "Marlins",
  MIL: "Brewers",
  MIN: "Twins",
  NYM: "Mets",
  NYY: "Yankees",
  ATH: "Athletics",
  PHI: "Phillies",
  PIT: "Pirates",
  SD: "Padres",
  SEA: "Mariners",
  SF: "Giants",
  STL: "Cardinals",
  TB: "Rays",
  TEX: "Rangers",
  TOR: "Blue Jays",
  WSH: "Nationals",
};

function lastName(name: string) {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

function slugify(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function containsTokenPhrase(tokens: Set<string>, phraseTokens: string[]) {
  return phraseTokens.length > 0 && phraseTokens.every((token) => tokens.has(token));
}

function normalizedTokens(value: string) {
  return normalizeText(value).split(" ").filter(Boolean);
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, "");
}

function decodeCdata(value: string) {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
