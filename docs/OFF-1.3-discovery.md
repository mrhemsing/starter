# OFF-1.3 discovery audit

The named highlight-backfill-spec.md attachment was not present in the inbound
files. This run follows the detailed acceptance requirements in Matt's request
9002; the missing attachment was requested before implementation.

## Existing implementation, read before changes

The daily `featured-highlights` cron selects at most 16 ranked starts from the
last 30 days with GS+ at least 58. It skips already stored IDs and queries
YouTube Data API v3, resolving the official @MLB channel rather than trusting
a hand-copied channel ID. Its two queries are pitcher name plus `strikeouts`
and pitcher name/team plus `highlight`. Publication windows are game-date
midnight minus 6 hours through plus 42 hours. It rejects other channels,
interviews, previews, game recaps, condensed games, and all-game compilations.
It requires the pitcher's surname and ranks by title identity, pitching words,
team, duration, and proximity to game date. Durations come from videos.list.

Writes go to `toetheslab_featured_start_highlights`, keyed by start_id. The
ordinary feature resolver checks explicit/manual references, that table, and
only then opt-in discovery. Page-time search defaults off. OFF-1 disables
the seasonal cron after season completion.

The archive publisher and media extension explicitly set YOUTUBE_SEARCH_ENABLED
to zero. They capture existing references without querying missing historical
starts. The current frozen media file has seven Top 25 references, of which
two are among the first three. The absence of a discovery pass is independently
confirmed in source, not inferred from thumbnails alone.

The image pipeline independently reads the official MLB game-content endpoint
by exact gamePk. It filters pitching-video items and selects their approved
MLB image cuts; it does not currently store those video URLs as YouTube IDs.
The embed component currently accepts official YouTube iframe references.

## Shared reuse

The cron's discovery implementation is extracted to
`src/lib/data/highlight-discovery.ts`. The cron, historical backfill, existing
ingestion CLI, and optional feature resolver import that implementation. The
backfill changes the explicit candidate set, not the ranking, season results,
or page-time discovery policy. There is no archive-specific second finder.

Historical requests must log start ID, gamePk, query, response status, returned
candidate identities, selected reference, and miss/error reason. API errors
are not evidence of unavailable highlights. Per-game outcomes and frozen-page
assertions are required before publication. Full-season discovery is proposal
only and must not be executed as part of this run.

## Outcomes and diagnosed discovery gaps

The first pass queried all 25 Top Starts through the original YouTube algorithm:
20 resolved, five were absent from official-channel search. All five had
exact-game official MLB content. The final pass resolves 25/25 Top Starts and
41/41 explicitly featured starts across 40 gamePks. The set includes the Top
25, Start of the Year, Biggest Blowup, the five starts in the winning streak,
and all 14 no-hitter bids, deduplicated. Multi-start pitcher/team awards do not
authorize scanning every game by those players or teams.

The shared MLB selector needed one evidenced taxonomy repair: Martín Pérez's
six-no-hit-inning reel is tagged `highlight-reel-starting-pitching`, not the
older `highlight-reel-pitching` spelling. Both are now recognized. The video
consumer also filters for a usable official playback before selecting the best
candidate, preventing a higher-scoring single-pitch item from hiding a playable
montage. It prefers MLB FORGE montages and permits official produced pitching
clips only as a fallback. The original identity/action checks remain in place.

Final references: 23 official MLB YouTube videos and 18 official MLB game-content
videos. Three older seeded YouTube references were replaced after channel or
embeddability validation failed. The original two top-three references remain.
No final misses or lookup errors remain. The full per-start/gamePk request log
and frozen-byte hashes are committed beside the season receipt. Raw response
evidence is retained in the attached run bundle. Requests are sequential with
at least 750 ms between network calls; replay uses saved responses, not new
quota-consuming searches. API failures now throw rather than silently becoming
missing highlights. New YouTube discoveries validate channel and embeddability.

## Publication and rendering

References are stored in the existing `season-review-media-2026.json` presentation
manifest, exactly where the existing archive references live. No raw video is
downloaded, mirrored, or uploaded. The shared feature resolver reads that same
manifest first, so both full start-log pages and date/slug recap pages use the
published reference, with no page-time archive discovery. The Supabase ingestion
schema and ongoing cron storage are unchanged.

The existing facade/modal component now supports official MLB playback URLs
with a native video element after interaction, and labels those assets `MLB`,
not `MLB on YouTube`. YouTube remains the existing privacy-enhanced iframe.
Top three retain card treatment; rows 4-25 retain compact controls. Existing
award/no-hitter rows use the same compact modal. Homepage modules reuse the hub
components. No ranking, scoring, prose, frozen recap, canonical data, or hero
photography is regenerated. Exact hashes and the non-media production DOM
comparison enforce that boundary.

## Full-season proposal, not executed

The frozen season contains 4,425 starts across 2,205 unique gamePks. A sensible
future run would make about 2,205 deduplicated MLB content lookups first, then
at most two YouTube searches per unresolved start. The pessimistic upper bound
is 8,850 YouTube searches, plus channel/video-validation calls. Search calls
alone would cost about 885,000 quota units at 100 units each, roughly 89 default
10,000-unit daily budgets before other usage. Reusing existing references and
MLB-first discovery should lower this substantially. This is an estimate only;
no full-season network backfill was performed.

## Checks

`npm run check:highlight-backfill` enforces exact featured-set coverage, rejects
unqueried/wrong-game/error rows and fewer than 20 Top 25 matches, validates
approved source URLs, pins frozen hashes and hero metadata, and tests the real
shared resolver with official-channel, unavailable-player, wrong-pitcher,
unapproved-host, and taxonomy fixtures. The existing OFF-1, OFF-1.1, OFF-1.2,
home-ranked, home-best-starts, starts-page, P1-12, TypeScript and lint checks
remain in force. Production checks exercise every Top 25 compact control at
1440 and 390, including native video metadata, and retain the OFF-1.1 image
network assertion across every rendered row.

## Production-discovered detail read repair

The full DOM pass found an inherited 404 for Luzardo's Sep 7 detail: ranked
archive reads were canonical-first, but getStartDetail still required an optional
completed-start shard before checking canonical history. The repair falls back
to final/frozen canonical records through the existing canonicalRecordToFormStart
adapter when archive enrichment is absent. No live schedule lookup is needed;
pitch arrays stay empty and explicitly not archived instead of borrowing demo
pitches. Both full start logs and date/slug recaps share this repaired read.
A regression executes all 41 featured IDs with absent archive shards under both
season flags and asserts immutable lines/scores, identity, and empty pitch arrays.
