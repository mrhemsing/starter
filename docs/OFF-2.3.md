# OFF-2.3: restored WHY GS+ panels

## Recovery

Source commit: `20af591` (the original shipped three-panel implementation in `src/app/(home)/page.tsx`). The same section remained unrendered during season_complete at baseline `4b23a50`. Extracted to `src/components/why-gs-plus-band.tsx`, imported by the in-season homepage and by the shared `FrozenSeasonGsPlus` wrapper on both archive surfaces. No rewrite of the cards, borders, iconography, claim headlines, or lock/link mechanics.

`node scripts/check-off23.mjs` compares the recovered functions byte-for-byte with that historical commit after removing only the enumerated adaptations. It also checks imports, placement, deterministic HTML, internal-vocabulary exclusions, and every existing file in `data/` and `src/data/` against `4b23a50`.

## Permitted offseason adaptations

- A season prop labels the selection `2026 examples, frozen at season end` instead of the daily-refresh label.
- Existing Methodology destination appears as a separate footer link as well as in the third panel.
- The stuff total is labeled `Stuff credit ... before scale adjustment`. These are the real stored component credits, not a claim that unscaled credits equal the final rounded display-score increase. The in-season wording is unchanged.
- No frozen score, recap, notable, award, media selection, or pitcher record was changed. No cron behavior changed.

## Full-season canonical selection query

Reproduction: `node scripts/freeze-season-gs-plus-examples.mjs <full-canonical-json> --check`.

Input is the verified P0-7 full canonical snapshot, including its 531 newly settled records. The shared `selectCanonicalStarts` removes the 18 known duplicate-date aliases: 4,956 stored finals become 4,938 distinct starts. Every input must be frozen/final in 2026. No retired archive reader or recent-only window is used.

The shared `canonicalRecordToFormStart` adapter and original proof-formatting helpers are imported. Where older canonical records omit a breakdown, the existing start-detail `summarizeGameScorePlus` function receives the stored line, stored GS+ total, and frozen contextSnapshot, exactly as the detail page does. No record is rewritten and no current opponent/park lookup is introduced.

Panel 1 scans every pair in the full season, with these deterministic eligibility rules:

1. Both starts at least five innings, to illustrate normal starter workloads.
2. Similarity distance <= 4: `4*abs(IP innings difference) + 3*abs(ER difference) + abs(H difference) + abs(BB difference) + 0.7*abs(K difference)`. Baseball IP is converted by the existing innings helper.
3. Park + opponent-quality + opponent-offense credit difference has the same sign as the GS+ difference. At the existing 0.72 display scaling, that context difference must explain at least 60% of the GS+ gap. Stuff-credit difference <= 1.
4. Rank by largest displayed GS+ gap, then smallest line distance, then largest context difference, then stable start IDs.

5,193 eligible pairs. Winner: JP Sears, July 5 (5 IP, 0 ER, 1 H, 2 BB, 5 K; 64 GS+) and Hayden Wesneski, August 21 (5 IP, 0 ER, 1 H, 3 BB, 4 K; 54 GS+). Distance 1.7; context-credit difference 9.92; stuff-credit difference zero. The claim does not imply that all ten points are context: the walks and strikeouts differ too.

Panel 2 ranks all full-season starts by positive stored whiff-plus-velocity credits, excluding floor/ceiling-clipped scores, then higher GS+, then stable ID. Cam Schlittler, July 24: 7.1 IP, 0 ER, 3 H, 0 BB, 12 K; 79 GS+. Whiff credit 2.94; velocity credit 1.225; total 4.165 before display scaling. Original recorded descriptions show +8.4 percentage points whiff and +0.7 mph velocity.

Panel 3 uses that same real Schlittler start and the original `/starts/{id}` breakdown route. Its lock icon and settled-score claim are unchanged.

## Frozen artifact and evidence

`src/data/gs-plus-examples-2026.json` is a static import, not selected at request time. It contains the three complete source records, input SHA-256, chosen pair metrics, pool counts, and source/recovery commits. Re-running with --check requires byte-identical output. No new runtime fetch or refresh job.

Evidence directory: `outputs/off23/`. Source/freeze assertions, reproducible selection, build process-tree memory, existing season-review and offseason tests, and local/production browser output are packaged with production screenshots. Browser assertions cover 390 and 1440 on both surfaces, exact placement after Top Starts/before Season Awards, all three panels, real stat lines, no overflow/internal vocabulary, lock and breakdown destination, HTTP 200 for every section link, raw HTML presence, and repeated plain-URL cache HITs.
