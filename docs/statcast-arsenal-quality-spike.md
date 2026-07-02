# Statcast Arsenal Quality Spike

Date: 2026-07-02

## Decision

Keep the first product slice archive-derived. Do not expand request-time Baseball Savant usage for normal page renders.

The current archived pitch event shape already supports useful quality context:

- CSW rate: called strikes plus swinging strikes over pitches.
- SwStr rate: swinging strikes over pitches.
- Whiff rate: swinging strikes over swings.
- Swing rate: swings over pitches.
- Zone rate: plate coordinates inside the fixed strike-zone box.
- Velocity: average and max by pitch type.
- Count leverage, inning timeline, and pitch sequence.

These can power start-detail and pitcher-profile quality surfaces without new data cost.

## Gap

True Statcast quality needs fields that are not in the normalized archive today:

- Chase: needs plate-discipline context with zone/out-of-zone swing classification.
- Contact: needs contact events and ideally swing/contact denominators.
- Batted-ball quality: needs `launch_speed`, `launch_angle`, and batted-ball type.
- Expected contact quality: needs `estimated_woba_using_speedangle` or equivalent.
- Barrel and hard-hit: needs launch speed/angle derived flags or raw fields.
- Pitch movement/release: needs release extension, release position, spin, movement, and axis fields.

The current `PitchEvent` stores only type, result, count, velocity, plate coordinates, inning, and pitch number. That is enough for command/miss indicators, not enough for contact-quality claims.

## Recommended Schema Extension

Add optional Statcast fields to pitch events, preserving the current archive contract for older rows:

```ts
type PitchEventStatcast = {
  zone?: number | null;
  description?: string | null;
  launchSpeedMph?: number | null;
  launchAngleDeg?: number | null;
  estimatedWoba?: number | null;
  barrel?: boolean | null;
  hardHit?: boolean | null;
  releaseExtensionFt?: number | null;
  spinRateRpm?: number | null;
  pfxX?: number | null;
  pfxZ?: number | null;
};
```

Store these fields as an optional `statcast` object on archived pitch events first. Backfill can then enrich rows date by date without breaking existing start detail pages. Supabase sync also mirrors enriched rows into `toetheslab_statcast_pitch_event_enrichments` so future aggregate jobs can query the enriched pitch fields without scanning every completed-start JSON payload.

## Ingestion Path

1. Extend `PitchEvent` with optional `statcast` fields.
2. Update `baseball-savant-client.ts` to parse the fields from Savant CSV.
3. Update `archive-mlb-season.mjs` validation to accept optional Statcast fields.
4. Add a supervised backfill mode that enriches completed starts from Savant by date.
5. Sync enriched archive rows to Supabase as both local archive JSON and queryable `toetheslab_statcast_pitch_event_enrichments` rows.
6. Only then add product copy for chase, contact, xwOBA, hard-hit, and barrel.

## Backfill IO Plan

The Savant enrichment backfill must run off-peak after the slate completes, in date slices, with an IO-budget check before each slice. Default launch shape: one date per slice, stop for the night if Supabase Disk IO budget falls below 35% remaining or if Postgres starts returning 503, 504, or 57014-class timeout errors. The backfill should resume from the last completed date, not restart from the season opener. If steady-state IO after the July 2 resilience fixes has comfortable headroom, keep the current compute tier and temporarily bump only for the backfill window; if steady-state sits near the budget floor, record the measurement and take a standing one-tier bump before enrichment begins.

## Product Order

1. Shipped: start-detail archive-derived quality panel using CSW, whiff, zone, swing, and velocity.
2. Next light slice: pitcher-profile summary cards using the same archive-derived metrics across season and last-30 windows.
3. Heavy slice: Statcast-enriched archive with contact-quality metrics.

## Guardrail

Any surface that says xwOBA, chase, contact quality, hard-hit, or barrel must read enriched archived fields. It must not infer those claims from the current simplified pitch event shape, and it must not fetch Savant during normal page render.
