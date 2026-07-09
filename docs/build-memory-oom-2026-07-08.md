# Build Memory OOM Investigation - 2026-07-08

Context: P1-15 investigated the Node heap OOM seen during static generation after the read-path caching and archive closeout work. The build passed locally only after an ad hoc `NODE_OPTIONS=--max-old-space-size=8192`, which was not a safe deploy posture.

## Finding

The default build failed during static page generation, not during compile or typecheck.

Baseline command:

```bash
npm run build
```

Observed failure:

- Phase: `Generating static pages`
- Generated page count: `33`
- Static workers reported by Next: `23`
- Failure point: after static page generation began, around `16/33`
- Heap at failure: about `4093 MB`
- Error: `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`

This points to static-generation concurrency and build-time data pressure, not dynamic route long-tail prerendering. There are no `generateStaticParams` exports in `src/app`, so pitcher pages, dated slates, monthly archives, and other dynamic route tails are not being fully prerendered at build time.

## Generated route profile

The successful profiled build generated `33` static pages. Key route classes:

| Route class | Build behavior | Notes |
| --- | --- | --- |
| Home `/` | Static with ISR | Reads cached home ranking, live, best-start, and proof packets. |
| `/best-starts` | Static with ISR | Highest build-time data risk because it reads season starts plus rolling best-start packets. |
| Content pages | Static | Glossary, methodology, parks, pitchers index, leaderboards, rotations. |
| `/upcoming/streamers` | Static with ISR | Reads cached streamer board and stored Fantasy Coach packet. |
| Dynamic route tails | On-demand | `[date]`, `[id]`, `[month]`, team, pitcher, slate, and live pages render on demand. |

## Decision

Keep ISR and cached route behavior, but cap static-generation fan-out. This avoids the 8 GB heap crutch while preserving the P1-12 read-path model: popular static routes are still cached/revalidated, and long-tail dynamic routes remain on-demand.

Implemented in `next.config.ts`:

```ts
experimental: {
  staticGenerationMaxConcurrency: 2,
  staticGenerationMinPagesPerWorker: 16,
}
```

Rationale:

- The app has a small number of generated pages, but several of those pages read cached season or form data during prerender.
- The OOM appeared when many static workers ran concurrently under the default Node heap.
- Capping concurrency reduced peak memory without making pages request-path dynamic.

## Verification

After the cap:

```bash
npm run build
```

Result:

- Build passed without `NODE_OPTIONS=--max-old-space-size=8192`.
- Static generation completed all `33/33` pages.
- Measured peak working set during a normal build: about `1096.6 MB`.
- Target ceiling: under the default 4 GB Node heap, with enough headroom for Vercel's standard build environment.

The build output still reports `Collecting page data using 23 workers`, but the static generation cap is active in the Next config and printed in the build header. The default heap no longer OOMs.

## Guard

`npm run check:build-memory` now pins:

- static generation max concurrency stays at `2`;
- static generation pages are grouped with `staticGenerationMinPagesPerWorker: 16`;
- no `generateStaticParams` long-tail prerendering is introduced under `src/app`;
- the static candidate page count stays under `40` unless a new profile justifies raising it.

If future generated pages or data growth push the build back toward the ceiling, this guard should fail before deploys need an ever-larger heap flag.

## Freshness and performance

This change does not alter page data freshness. Revalidation windows, cache tags, and cron-triggered revalidation from P0-1, P0-4, P1-12, and P1-13 remain in place. The change only limits how many static generation jobs run at once during build.
