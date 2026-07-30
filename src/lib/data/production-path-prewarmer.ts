import { getRankedStartsPageData } from "@/lib/data/ranked-starts-page-service";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { pitcherHref, startRecapPath } from "@/lib/routes";

const PREWARM_CONCURRENCY = 3;
const PREWARM_TIMEOUT_MS = 15_000;
const PREWARM_USER_AGENT = "ToeTheSlab-ISR-Prewarmer/1.0";

export type PrewarmResult = {
  paths: string[];
  warmed: string[];
  failed: Array<{ path: string; attempts: number; error: string }>;
  durationMs: number;
};

export async function reconciliationPrewarmPaths(date: string) {
  const pageData = await getRankedStartsPageData(date, getHomeSlateDate());
  const starts = pageData.slateStarts;
  const pitcherPaths = starts.map((start) => pitcherHref(start.pitcher));
  const recapPaths = starts.map((start) => startRecapPath(start, starts));

  return uniquePaths([
    "/",
    `/starts/${date}`,
    ...recapPaths,
    "/heat-check",
    "/best-starts",
    ...pitcherPaths,
    `/leaderboard/${date.slice(0, 4)}`,
  ]);
}

export function slatePrewarmPaths(date: string, weekStartDate = date) {
  return uniquePaths([
    "/upcoming",
    `/upcoming/${date}`,
    "/upcoming/week",
    `/upcoming/week/${weekStartDate}`,
    `/live/${date}`,
    `/duels/${date}`,
  ]);
}

export async function prewarmProductionPaths(paths: string[], baseUrl = productionBaseUrl()): Promise<PrewarmResult> {
  const startedAt = Date.now();
  const normalizedPaths = uniquePaths(paths);
  const warmed: string[] = [];
  const failed: PrewarmResult["failed"] = [];

  for (let index = 0; index < normalizedPaths.length; index += PREWARM_CONCURRENCY) {
    const batch = normalizedPaths.slice(index, index + PREWARM_CONCURRENCY);
    const results = await Promise.all(batch.map((path) => warmPath(baseUrl, path)));
    for (const result of results) {
      if (result.ok) warmed.push(result.path);
      else failed.push(result);
    }
  }

  const result = {
    paths: normalizedPaths,
    warmed,
    failed,
    durationMs: Date.now() - startedAt,
  };
  console.log("[production-prewarm] complete", result);
  if (failed.length > 0) console.error("[production-prewarm] path failures", failed);
  return result;
}

async function warmPath(baseUrl: string, path: string) {
  let lastError = "unknown error";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PREWARM_TIMEOUT_MS);
    try {
      const response = await fetch(new URL(path, baseUrl), {
        headers: {
          "user-agent": PREWARM_USER_AGENT,
          "x-toe-the-slab-prewarm": "1",
        },
        redirect: "follow",
        signal: controller.signal,
      });
      if (response.ok) {
        await response.arrayBuffer();
        return { ok: true as const, path };
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  return { ok: false as const, path, attempts: 2, error: lastError };
}

function productionBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.toetheslab.com").replace(/\/+$/, "");
}

function uniquePaths(paths: string[]) {
  return [...new Set(paths.filter((path) => path.startsWith("/")))];
}
