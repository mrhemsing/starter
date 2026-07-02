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

Store these fields as optional JSON-compatible properties on archived pitch events first. Backfill can then enrich rows date by date without breaking existing start detail pages.

## Ingestion Path

1. Extend `PitchEvent` with optional Statcast fields.
2. Update `baseball-savant-client.ts` to parse the fields from Savant CSV.
3. Update `archive-mlb-season.mjs` validation to accept optional Statcast fields.
4. Add a supervised backfill mode that enriches completed starts from Savant by date.
5. Sync enriched archive rows to Supabase.
6. Only then add product copy for chase, contact, xwOBA, hard-hit, and barrel.

## Product Order

1. Shipped: start-detail archive-derived quality panel using CSW, whiff, zone, swing, and velocity.
2. Next light slice: pitcher-profile summary cards using the same archive-derived metrics across season and last-30 windows.
3. Heavy slice: Statcast-enriched archive with contact-quality metrics.

## Guardrail

Any surface that says xwOBA, chase, contact quality, hard-hit, or barrel must read enriched archived fields. It must not infer those claims from the current simplified pitch event shape, and it must not fetch Savant during normal page render.
