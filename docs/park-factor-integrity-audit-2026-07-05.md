# Park Factor Integrity Audit, 2026-07-05

Source of truth in code: `src/lib/data/run-environment.ts`.

Canonical source: FanGraphs 3-year park factors, normalized to a 1.00 run environment. The local table was originally built as venue run factors, not deviations from 1.00. The current source rows for the live problem venues already store full factors: Petco Park 0.95, Oracle Park 0.94, Citi Field 0.97.

The failure mode this audit guards against is a row storing the deviation from 1.00, such as 0.05, instead of the full factor, such as 0.95.

| Venue | Stored factor | Status |
| --- | ---: | --- |
| Angel Stadium | 0.98 | sane |
| Busch Stadium | 0.97 | sane |
| Chase Field | 1.03 | sane |
| Citi Field | 0.97 | sane |
| Citizens Bank Park | 1.01 | sane |
| Comerica Park | 0.98 | sane |
| Coors Field | 1.16 | sane |
| Daikin Park | 0.99 | sane |
| Dodger Stadium | 0.98 | sane |
| Fenway Park | 1.05 | sane |
| George M. Steinbrenner Field | 1.02 | sane |
| Globe Life Field | 1.00 | sane |
| Great American Ball Park | 1.08 | sane |
| Guaranteed Rate Field | 1.01 | sane |
| Kauffman Stadium | 1.00 | sane |
| loanDepot park | 0.96 | sane |
| Minute Maid Park | 0.99 | sane |
| Nationals Park | 1.00 | sane |
| Oracle Park | 0.94 | sane |
| Oriole Park at Camden Yards | 1.01 | sane |
| Petco Park | 0.95 | sane |
| PNC Park | 0.98 | sane |
| Progressive Field | 0.99 | sane |
| Rate Field | 1.01 | sane |
| Rogers Centre | 1.02 | sane |
| Sutter Health Park | 1.00 | sane |
| T-Mobile Park | 0.95 | sane |
| Target Field | 0.99 | sane |
| Truist Park | 1.01 | sane |
| UNIQLO Field at Dodger Stadium | 0.98 | sane |
| Wrigley Field | 1.04 | sane |
| Yankee Stadium | 1.03 | sane |

Post-audit changes:

- Added a write gate that rejects factors outside 0.85 to 1.20.
- Added a read gate that treats out-of-range factors as unavailable, logs one warning, and returns neutral park contribution.
- Collapsed the duplicate Upcoming/start-service park table into the shared source.
- Upcoming and Watchlist PARK chips now omit unavailable factors instead of rendering corrupt values.

