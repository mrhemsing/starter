import http from "node:http";
import https from "node:https";
import { performance } from "node:perf_hooks";

const baseUrl = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3000";

const routes = [
  ["home", "/"],
  ["ranked starts", "/starts/2026-07-06"],
  ["heat check", "/heat-check"],
  ["upcoming", "/upcoming"],
  ["live", "/live/2026-07-08"],
  ["watchlist", "/watchlist"],
  ["pitcher page", "/pitchers/dylan-cease-656302"],
];

function requestTiming(path) {
  const url = new URL(path, baseUrl);
  const client = url.protocol === "https:" ? https : http;
  const startedAt = performance.now();
  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method: "GET",
        headers: {
          "user-agent": "tts-performance-guardrail/1.0",
        },
      },
      (res) => {
        const firstByteAt = performance.now();
        let bytes = 0;
        res.on("data", (chunk) => {
          bytes += chunk.length;
        });
        res.on("end", () => {
          const endedAt = performance.now();
          resolve({
            status: res.statusCode,
            ttfbMs: Math.round(firstByteAt - startedAt),
            totalMs: Math.round(endedAt - startedAt),
            bytes,
            cache: String(res.headers["x-vercel-cache"] ?? res.headers["x-nextjs-cache"] ?? "n/a"),
          });
        });
      },
    );
    req.setTimeout(30_000, () => {
      req.destroy(new Error(`Timed out fetching ${url}`));
    });
    req.on("error", reject);
    req.end();
  });
}

function formatRow(label, path, cold, warm) {
  return `| ${label} | \`${path}\` | ${cold.status} | ${cold.ttfbMs} | ${cold.totalMs} | ${warm.ttfbMs} | ${warm.totalMs} | ${warm.cache} | ${Math.round(warm.bytes / 1024)} KB |`;
}

console.log(`# Performance Guardrail Probe`);
console.log("");
console.log(`Base URL: ${baseUrl}`);
console.log(`Run at: ${new Date().toISOString()}`);
console.log("");
console.log("| Route | Path | Status | Cold TTFB ms | Cold total ms | Warm TTFB ms | Warm total ms | Warm cache | Warm size |");
console.log("| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |");

for (const [label, path] of routes) {
  const cold = await requestTiming(path);
  const warm = await requestTiming(path);
  console.log(formatRow(label, path, cold, warm));
}
