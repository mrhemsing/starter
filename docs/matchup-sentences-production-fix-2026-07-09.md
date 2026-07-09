# Matchup Sentences Production Fix

Date: 2026-07-09

## Production finding

The Jul 9 Upcoming board showed a mixed generation state:

- Several cards were byte-identical to the prior board because the writeup job reused unchanged per-game LLM rows.
- Rendered cards were falling back to deterministic copy, with no stored packet hooks visible.
- COIN FLIP fallback copy could still say `needs the tiebreaker` or `one real factor must decide it` without naming the factor.
- New jargon phrases appeared: `firm angle` and `cleaner starter side`.

## Fix

- Bumped Upcoming writeups to `version 7` and `prompt 14`.
- Added `UPCOMING_WRITEUPS_REGENERATION_EPOCH` to the slate and per-game input hashes so this production fix forces a full slate backfill instead of reusing old valid rows.
- Added `generatedAtByGame` so each regenerated card has a per-card timestamp to audit.
- Lowered fact-packet gates while keeping traceability:
  - K hooks can use a real market K line or a high projected strikeout value.
  - Venue-history hooks can surface at 5 K or 52 GS+ in the same park.
  - Season-best hooks can surface at 58 GS+.
  - Streak hooks now use consecutive 52+ GS+ starts.
  - P2-45 narrative notables still outrank ordinary hooks.
- COIN FLIP validation now requires a named tiebreaker factor in both LLM and deterministic fallback paths.
- Added `firm angle`, `cleaner starter side`, `needs the tiebreaker`, and `one real factor must decide it` to the prohibited list.

## Verification notes

Local production build passed. A local rendered `/upcoming` fallback probe showed the previously vague COIN FLIP cards naming actual factors:

- Wacha/Manaea: `weather at Citi Field points toward bats`.
- Valdez/Perkins: `weather at Comerica Park points toward bats`.
- Williams/Ober: `the strikeout lean sits with Williams at 5.8`.
- Canning/Kelly: `extra rest helps Canning's side`.

The local HTTP cron probe is unreliable on this Windows runner: `next start` closed the connection during `/api/cron/upcoming-writeups`, and `next dev` timed out on full OpenAI generation. The deploy-side verification step is therefore:

```powershell
curl.exe -s "https://www.toetheslab.com/api/cron/upcoming-writeups?date=2026-07-09"
curl.exe -s "https://www.toetheslab.com/upcoming" | Select-String "data-simple-context-source"
```

Expected result after deploy:

- `result.generated + result.fallbackCount` covers every visible card, with `reused: 0` for the first v7 run.
- Stored writeups render instead of the old mixed board.
- At least a meaningful fraction of hook-bearing cards mention a traceable K, venue, streak, season-best, or narrative-notable fact.
- The rendered board contains none of the prohibited phrases above.
