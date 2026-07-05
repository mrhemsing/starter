# GS+ Adjustment Audit

Date: 2026-07-01
Scope: P1-5 audit step from the credibility roadmap.

## Verdict

GS+ already adjusts completed-start scores for both park and opponent context. A formula rewrite is not the first move for P1-5. The smaller next scope is exposing the existing breakdown more clearly in methodology and start-row UI, then deciding whether the current weights need calibration after the canonical score store lands.

## Current Formula

Completed starts use `context-v8` in `src/lib/data/start-service.ts`.

The scoring breakdown starts with the line:

- Baseline: 45
- Length: innings times 3
- Misses: strikeouts times 2.2
- Runs: earned runs times -5
- Traffic: hits times -1.2
- Free passes: walks times -1.5

It then applies context when available:

- Whiff context: `whiffDeltaPct * 0.35`
- Velocity context: `velocityDeltaMph * 1.75`
- Park context: `(parkRunFactor - 1) * 12`
- Opponent quality: `opponentQualityRunValue`
- Opponent offense: `opponentOffenseRunValue`

The raw total is transformed onto the displayed 20 to 80 GS+ range using the shared midpoint and multiplier in the same module.

## Park Adjustment

Park context is present in the completed-start breakdown as the `parkContext` component. The current value rewards equivalent lines in harder run environments and trims equivalent lines in easier run environments through the run factor term.

July 4, 2026 note: this audit described the intended direction, but the shipped `context-v7` code used the inverted `(1 - parkRunFactor) * 12` term. `context-v8` corrects completed-start GS+ to `(parkRunFactor - 1) * 12` without retuning the x12 weight.

Evidence:

- `summarizeGameScorePlus` includes a `parkContext` component.
- `scoreCompletedLine` calls `summarizeGameScorePlus`.
- Existing slate/start contracts require generated slate scale data to use `context-v8`, while allowing `context-v7` on frozen historical start rows until a human-approved recompute runs.

## Opponent Adjustment

Opponent context is represented in two components:

- `opponentQuality`, derived from opponent record and run differential when live standings context is available.
- `opponentOffense`, derived from team run scoring and OPS when live offense context is available.

Fallback values exist for archived and fixture paths, so the components are still present when live context is unavailable.

Evidence:

- `fetchMlbTeamQualityContexts` builds `opponentQualityRunValue`.
- `fetchMlbTeamQualityContexts` attaches `opponentOffenseRunValue` from offense context.
- `summarizeGameScorePlus` includes both opponent components in the completed-start breakdown.
- Existing slate/start contracts require `opponentQuality` and `opponentOffense` components.

## Current Public Exposure

Public methodology already says completed starts use line, park, opponent, and pitch-event context. The detailed start page also exposes the full component breakdown for each start.

What is still missing from P1-5:

- A clearer methodology section naming park and opponent adjustment as first-class GS+ credibility inputs.
- A compact raw-to-adjusted summary in expanded start rows.
- A version note for `context-v8` that explains that park and opponent are already included.

## Recommendation

Treat P1-5 as transparency and calibration, not an immediate GS+ v2 rewrite.

Next implementation slice after P0-2:

1. Surface raw line score, context delta, and displayed GS+ in expanded rows.
2. Add a methodology section with a plain-language park/opponent example.
3. Add a calibration report over the canonical start store once P0-2 exists, checking league mean and component distribution before changing weights.
