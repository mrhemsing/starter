# GS+ context-v8 Recompute Dry Run

Date: 2026-07-04
Scope: read-only dry run for the completed-start park sign correction. No historical scores were rewritten.

## Decision Options

Option A, go-forward only: context-v8 applies to new settles only. This is cheapest, but 2026 season aggregates keep the context-v7 park bias.

Option B, one-time versioned recompute: resettle all 2026 completed starts under context-v8 using the already frozen context inputs. This is the recommended option because the formula changes but the inputs do not.

Option C, dual persistence: store context-v8 alongside frozen context-v7 and display context-v8. This is more complex and likely not worth it for this correction.

## Dry-Run Method

The report queried a local production build through `/api/slate/yesterday/{date}` for every archived 2026 date in `data/mlb-archive/2026/manifest.json`.

The app served context-v8 scores. The context-v7 comparison was reconstructed from the displayed breakdown by reversing only the park component sign:

- context-v8 park component: `(parkRunFactor - 1) * 12`
- context-v7 park component: `(1 - parkRunFactor) * 12`
- display transform multiplier: `0.72`

This is a report only. It does not write canonical rows, Supabase rows, archive files, or cached page payloads.

## Figures

Affected completed starts: 2,656 across 101 archived dates.

Score delta distribution, context-v8 precise score minus reconstructed context-v7 precise score:

- Min: -2.76
- P10: -0.69
- Median: 0.00
- P90: 0.69
- Max: 2.76
- Mean: 0.06

Displayed-score bucket counts:

- -3: 1
- -2: 5
- -1: 515
- 0: 1,666
- +1: 348
- +2: 52
- +3: 69

League mean:

- context-v7 reconstructed precise mean: 49.50
- context-v8 precise mean: 49.56
- Result: still approximately centered around 50.

Season aggregate top 20 rank changes, using pitchers with at least five starts and average precise GS+:

| context-v8 rank | context-v7 rank | Pitcher | Team | Starts | v8 avg | v7 avg | Change |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| 1 | 1 | Jacob Misiorowski | MIL | 17 | 65.37 | 65.15 | 0 |
| 2 | 2 | Bryce Miller | SEA | 8 | 62.86 | 63.40 | 0 |
| 3 | 3 | Cristopher Sánchez | PHI | 18 | 60.15 | 60.10 | 0 |
| 4 | 4 | Shohei Ohtani | LAD | 14 | 59.47 | 59.60 | 0 |
| 5 | 5 | Chris Sale | ATL | 15 | 59.41 | 59.20 | 0 |
| 6 | 6 | Dylan Cease | TOR | 17 | 58.90 | 58.70 | 0 |
| 7 | 7 | Tyler Glasnow | LAD | 7 | 58.61 | 58.38 | 0 |
| 8 | 8 | Cam Schlittler | NYY | 18 | 58.59 | 58.38 | 0 |
| 9 | 9 | Zack Wheeler | PHI | 13 | 58.17 | 58.11 | 0 |
| 10 | 11 | Chase Burns | CIN | 17 | 58.01 | 57.44 | +1 |
| 11 | 10 | Tarik Skubal | DET | 11 | 57.67 | 57.72 | -1 |
| 12 | 12 | Drew Rasmussen | TB | 16 | 57.23 | 57.29 | 0 |
| 13 | 13 | Hunter Brown | HOU | 5 | 56.93 | 57.03 | 0 |
| 14 | 16 | Ben Brown | CHC | 8 | 56.92 | 56.88 | +2 |
| 15 | 15 | Troy Melton | DET | 8 | 56.92 | 56.92 | 0 |
| 16 | 14 | Yoshinobu Yamamoto | LAD | 15 | 56.82 | 56.98 | -2 |
| 17 | 17 | Parker Messick | CLE | 18 | 56.79 | 56.88 | 0 |
| 18 | 18 | Max Meyer | MIA | 18 | 56.57 | 56.87 | 0 |
| 19 | 19 | Jacob deGrom | TEX | 17 | 56.14 | 56.21 | 0 |
| 20 | 20 | Kyle Harrison | MIL | 16 | 55.95 | 55.89 | 0 |

Top 20 names with changed rank: 4.

## Largest Single-Start Deltas

These are the largest absolute deltas in the read-only pass. The park value shown is the context-v8 `parkContext` component, not the raw venue run factor.

| Date | Pitcher | Team | Park component | v7 display | v8 display | Precise delta |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 2026-04-03 | Aaron Nola | PHI | 1.92 | 63 | 65 | +2.76 |
| 2026-04-04 | Brennan Bernardino | COL | 1.92 | 42 | 45 | +2.76 |
| 2026-04-05 | Tomoyuki Sugano | COL | 1.92 | 58 | 60 | +2.76 |
| 2026-04-05 | Taijuan Walker | PHI | 1.92 | 39 | 42 | +2.76 |
| 2026-04-06 | Cody Bolton | HOU | 1.92 | 48 | 51 | +2.76 |
| 2026-04-06 | Ryan Feltner | COL | 1.92 | 37 | 40 | +2.76 |
| 2026-04-07 | Kyle Freeland | COL | 1.92 | 59 | 62 | +2.76 |
| 2026-04-07 | Mike Burrows | HOU | 1.92 | 41 | 44 | +2.76 |
| 2026-04-08 | Michael Lorenzen | COL | 1.92 | 52 | 55 | +2.76 |
| 2026-04-08 | Cristian Javier | HOU | 1.92 | 41 | 44 | +2.76 |

## Recommendation

Choose Option B after approval: perform a one-time versioned recompute for 2026 completed starts, republish affected pages, and add a dated methodology note. The dry run indicates the league mean remains centered and the top-20 movement is small, while the directional bias is removed.
