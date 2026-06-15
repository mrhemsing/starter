# Toe the Slab Commit Prep

Use this note for the local milestone pass before any commit for `mrhemsing/starter`. This is a local-only checklist; do not push unless Matt asks.

## Scope Check

1. Run `git status --short`.
2. Run `git diff --check` to catch whitespace errors or conflict markers before committing.
3. Confirm changed files are limited to Toe the Slab app code, tests, scripts, docs, or ignored generated output.
4. Confirm `.responsive-screenshots/`, `.next/`, temporary Next logs (`.next-heartbeat-*.log`, `.next-local-*.log`, `.next-responsive-*.log`, `.next-live-splits-*.log`), environment files, and other generated artifacts are not staged.
5. Review or update `docs/responsive-review.md` after refreshing `.responsive-screenshots/`.
6. Confirm `package.json` remains `"private": true` so npm publishing stays blocked.

## Required Local Gates

```bash
npm run check:publish-prep
npm run lint
npm run build
npm run check:mlb-archive
npm run test:fixture-gates
```

`npm run test:fixture-gates` is the required fixture production-server gate. It starts a temporary production server, sets `THE_BUMP_BASE_URL` for the child checks, runs:

```bash
npm run test:contracts
npm run test:responsive
```

Then it stops the tracked server process.

Individual contract scripts remain available for targeted iteration: `npm run test:slate-contract`, `npm run test:start-contract`, and `npm run test:pitcher-contract`.

The local 2026 MLB archive is built separately from the app runtime. Refresh it with `npm run archive:mlb-season -- --season=2026 --start=2026-03-01 --end=2026-06-02`, or use `npm run archive:mlb-season -- --season=2026 --date=2026-06-02` for a same-day incremental refresh after games finish. Then verify the manifest and date shards with `npm run check:mlb-archive`. Archive payloads live under ignored `data/mlb-archive/[season]/` so season backfills can be large without forcing them into git.

## Optional Live Gate

For the full live local pass, run the fixture-gate runner with live MLB and live responsive expectations enabled:

```bash
$env:THE_BUMP_LIVE_MLB="1"
$env:THE_BUMP_RESPONSIVE_LIVE="1"
$env:THE_BUMP_RESPONSIVE_LIVE_DATE="2026-05-24"
$env:THE_BUMP_EXPECT_SCHEDULE_SOURCE="live"
$env:THE_BUMP_EXPECT_COMPLETED_STATS_SOURCE="live-gamefeed"
$env:THE_BUMP_EXPECT_PITCH_DETAIL_SOURCE="live-gamefeed"
npm run test:fixture-gates
```

The live aggregate gate also runs the pitcher contract with `THE_BUMP_LIVE_MLB=1`. That contract expects `live-people-stats` for identity, season line, and start history, `live-gamefeed` for arsenal, and `live-people-stat-splits` for splits.

You can still start the production server manually and run the individual live slate/start/pitcher/responsive checks documented in `README.md`. Treat live MLB API failures as a dependency note, not a reason to change fixture behavior.

## Commit Boundary

A local milestone commit should describe the shipped project slice, for example:

```bash
git commit -m "Prepare Toe the Slab local publish handoff"
```

External publishing stays blocked until Matt explicitly asks.
Npm publishing also stays blocked by keeping `package.json` private.
