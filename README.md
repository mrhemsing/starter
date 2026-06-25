# Toe the Slab

Toe the Slab is a visual-first MLB starting-pitcher site. It ranks completed starts, shows probable and live starters, and turns each start into a pitch-level deep dive with arsenal, velocity, count leverage, inning timeline, and explainable Game Score+ context.

## Current Surface

- Home: ranked completed starts, upcoming slates, and quick route chips.
- Slate pages: `/slate/yesterday/[date]`, `/slate/today/[date]`, `/slate/tomorrow/[date]`, and `/slate/week/[date]`.
- Start pages: `/starts/[id]` with pitch chart controls, pitch-by-pitch sequence, arsenal table, velocity trend, inning timeline, and Game Score+ why.
- Pitcher pages: `/pitchers/[id]` with season summary, arsenal report, structured splits, season-log controls, and start history.
- APIs: `/api/slate/[window]/[date]`, `/api/starts/[id]`, and `/api/pitchers/[id]`.

## Data Modes

The app runs with fixture-backed data by default so local development and CI-style checks do not depend on live MLB availability.

Set `THE_BUMP_LIVE_MLB=1` when starting the Next server to ingest public MLB Stats API schedule, gamefeed, standings, pitcher splits, and hitting-stat data where available. The app keeps fixture fallbacks for missing or not-yet-final data.

Set `THE_BUMP_ODDS_API_KEY` to hydrate K props, team totals, and game totals from The Odds API. The default budget guard only fetches odds for today and tomorrow, then caches responses for 30 minutes so 7-day pages do not burn free-tier credits for every future slate. Override with `THE_BUMP_ODDS_MAX_DAYS_AHEAD` and `THE_BUMP_ODDS_CACHE_MINUTES` only when you intentionally want broader or fresher market coverage.

YouTube highlights use checked-in manual video IDs or stored Supabase highlight rows by default. Dynamic YouTube search is disabled unless `YOUTUBE_SEARCH_ENABLED=1` because `search.list` is quota-expensive and page renders can otherwise exhaust a small API budget quickly.

Use the background ingestion command after completed starts are archived and synced when Recent Gems needs automatic MLB YouTube discovery without page-render search:

```bash
$env:YOUTUBE_API_KEY="..."
$env:THE_BUMP_SUPABASE_URL="..."
$env:THE_BUMP_SUPABASE_SERVICE_ROLE_KEY="..."
npm run ingest:featured-highlights -- --date=2026-06-19
```

The ingester ranks archived completed starts, skips highlights already stored in Supabase, searches the official MLB YouTube channel for a small candidate set, validates pitcher/date/title matches, and upserts into `toetheslab_featured_start_highlights`. Use `--dry-run`, `--start=YYYY-MM-DD --end=YYYY-MM-DD`, `--lookback-days=7`, `--limit=8`, or `--min-score=58` to tune cron runs.

For durable local season storage, use the MLB archive commands. They write normalized schedule, completed starting-pitcher lines, arsenal summaries, and pitch events into ignored local JSON files under `data/mlb-archive/[season]/`.

```bash
npm run archive:mlb-season -- --season=2026 --start=2026-03-01 --end=2026-06-02
npm run archive:mlb-season -- --season=2026 --date=2026-06-02
npm run check:mlb-archive -- --season=2026
```

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

For a production-style local check:

```bash
npm run build
npm run start
```

## Verification

Core gates:

```bash
npm run check:publish-prep
npm run lint
npm run build
npm run check:mlb-archive
npm run test:fixture-gates
```

Contract checks expect a running local Next server. Override the base URL when the server is not on port 3000.

```bash
$env:THE_BUMP_BASE_URL="http://127.0.0.1:3000"
npm run test:contracts
```

Or run an individual contract while iterating:

```bash
$env:THE_BUMP_BASE_URL="http://127.0.0.1:3000"
npm run test:slate-contract
npm run test:start-contract
npm run test:pitcher-contract
```

Responsive screenshot coverage also expects a running local Next server and writes ignored PNGs to `.responsive-screenshots/`.

```bash
$env:THE_BUMP_BASE_URL="http://127.0.0.1:3000"
npm run test:responsive
```

`npm run test:fixture-gates` starts a temporary production Next server on a reserved local port, runs `npm run test:contracts` and responsive screenshot checks against that server, then stops the tracked process.

Live-data gates can use the same production-server runner. The live pass starts the temporary server with MLB data enabled, runs the same contracts and responsive checks, includes live slate/start screenshot targets, and skips fixture-only screenshot targets.

```bash
$env:THE_BUMP_LIVE_MLB="1"
$env:THE_BUMP_RESPONSIVE_LIVE="1"
$env:THE_BUMP_RESPONSIVE_LIVE_DATE="2026-05-24"
$env:THE_BUMP_EXPECT_SCHEDULE_SOURCE="live"
$env:THE_BUMP_EXPECT_COMPLETED_STATS_SOURCE="live-gamefeed"
$env:THE_BUMP_EXPECT_PITCH_DETAIL_SOURCE="live-gamefeed"
npm run test:fixture-gates
```

The live aggregate gate also runs the pitcher contract with `THE_BUMP_LIVE_MLB=1`, which expects `live-people-stats` for pitcher identity, season line, and start history, `live-gamefeed` pitch events for arsenal, and `live-people-stat-splits` for splits.

You can also run individual live checks against a manually started server.

```bash
$env:THE_BUMP_LIVE_MLB="1"
npm run start
```

In another shell:

```bash
$env:THE_BUMP_BASE_URL="http://127.0.0.1:3000"
$env:THE_BUMP_EXPECT_SCHEDULE_SOURCE="live"
$env:THE_BUMP_EXPECT_COMPLETED_STATS_SOURCE="live-gamefeed"
npm run test:slate-contract

$env:THE_BUMP_EXPECT_PITCH_DETAIL_SOURCE="live-gamefeed"
npm run test:start-contract

$env:THE_BUMP_LIVE_MLB="1"
npm run test:pitcher-contract

$env:THE_BUMP_RESPONSIVE_LIVE="1"
npm run test:responsive
```

## Publish Prep Checklist

Before publishing to `mrhemsing/starter`, keep the final local pass boring and explicit:

1. Review `git status --short` and confirm only intended project files are present.
2. Run `git diff --check` to catch whitespace errors or conflict markers before committing.
3. Run `npm run check:publish-prep` to verify the local handoff docs, scripts, ignored generated files, and `mrhemsing/starter` remote.
4. Run `npm run lint`.
5. Run `npm run build`.
6. Run `npm run check:mlb-archive` after any local season archive refresh, including same-day `--date=YYYY-MM-DD` refreshes.
7. Run `npm run test:fixture-gates` for fixture contract checks and responsive screenshots against a production local server.
8. Review `.responsive-screenshots/` for obvious visual regressions and update `docs/responsive-review.md`.
9. Optionally run live contract and responsive checks with `THE_BUMP_LIVE_MLB=1` and `THE_BUMP_RESPONSIVE_LIVE=1`.
10. Confirm `package.json` remains `"private": true` so npm publishing stays blocked.
11. Commit locally with a concise milestone message.
12. Push only when Matt asks for external publishing.

See `docs/commit-prep.md` for the local commit-prep checklist and suggested milestone boundary. See `docs/responsive-review.md` for the latest screenshot review notes.

## Notes

- Game Score+ is currently contracted as `context-v7` on a 20-80 display scale.
- Responsive tests assert mobile affordances, desktop/mobile pitch sequence behavior, horizontal overflow, and minimum screenshot byte size.
- Temporary Next logs (`.next-heartbeat-*.log`, `.next-local-*.log`, `.next-responsive-*.log`, `.next-live-splits-*.log`), screenshots, environment files, and build outputs are ignored by git.
