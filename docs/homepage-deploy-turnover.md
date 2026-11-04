# Homepage deployment turnover, 2026-11-03

## Finding and evidence boundary

The reported old bare-URL response was no longer reproducible when this repair
began. Before intervention, a plain GET returned build `9a1314fa9df5`, HTTP 200,
four primary nav links, `2026 Season in Review`, and no `Warming up`. Headers
identified Vercel CDN `HIT`, Age 194, and Next prerendering. We cannot honestly
attribute the earlier response to a specific Vercel invalidation defect without
the old response headers and deployment/edge logs. A query-string comparison
alone does not establish that cause.

Configuration audit: P1-12 originally set a 60-second homepage ISR window.
The current OFF-1 homepage is `force-static`, `revalidate = false`; nested
cached reads can still impose shorter regeneration windows. There is no custom
homepage Cache-Control or s-maxage in next.config.ts, vercel.json, or proxy.ts.
The observed browser header is `public, max-age=0, must-revalidate`.
`X-Nextjs-Stale-Time: 300` is not proof of a custom CDN s-maxage setting.
The /live path is a runtime proxy redirect in offseason, not an independent
copy of the homepage. Query variants and runtime redirects are not valid
substitutes for checking the bare homepage cache entry.

Confirmed release-process defect: deployment success was not coupled to a
plain homepage build-identity assertion. Existing tts-build metadata was
available, but no automatic post-deploy check used it. A stale root response
could therefore survive acceptance unnoticed. OFF-1 also skips season jobs,
so incidental season cron invalidation is not a deployment turnover mechanism.

## Purge and durable repair

Executed `vercel cache purge --type cdn --yes --project starter` in the project
team. CLI confirmed success. The next plain GET returned Age 0, PRERENDER,
build `9a1314fa9df5`, and the correct homepage. Data cache was not purged.

The production deployment lifecycle now invalidates only `/` using Next's
revalidatePath, then fetches the bare production URL and compares its existing
HTML tts-build marker to the deployment event's commit SHA. The invalidation
endpoint requires a dedicated production/GitHub secret, fails closed, and
rejects a SHA that differs from its running deployment. It cannot invalidate
arbitrary paths. No secret is included in logs or artifacts.

The GitHub `Production homepage turnover` workflow runs on successful Production
deployment events, or explicitly with a full SHA. Any wrong/missing marker,
non-200 response, redirect, failed invalidation, or missing credential fails the
job. Raw HTML and headers are uploaded even on verification failure. A failed
check is a failed release verification, not an automatic rollback.

Static route settings, data-cache keys/tags/TTLs, and live polling are unchanged.
The deployment-only invalidation preserves cached serving between deploys.
No force-dynamic homepage, periodic purge, shortened TTL, or cache-busted final
request is introduced. This repairs the deployment lifecycle rather than
claiming an unsupported cache header was the historical cause.

## Reproducible acceptance

- `node scripts/check-home-deploy-guard.mjs`: positive and negative HTML
  fixtures plus a real HTTP server asserting path `/` and no bypass headers.
- `node scripts/check-home-turnover-route.mjs`: executes the actual compiled
  handler with a mocked invalidation boundary; rejects missing/wrong credentials
  and wrong deployment, and only invalidates `/` for the matching deployment.
- `npm run check:read-path-cache`: existing P1-12 cache contract.
- `node scripts/verify-home-deploy.mjs https://www.toetheslab.com/ FULL_SHA outputs/home-deploy --offseason`:
  strict SHA, HTTP 200, four nav items, season-review H1, no raw skeleton strings.
- Production browser DOM is separately checked at desktop and mobile widths.

Historical edge trigger remains unconfirmed; current purge, protected turnover,
negative controls, and production results are independently verifiable.
