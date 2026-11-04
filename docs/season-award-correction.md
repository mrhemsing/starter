# Full-season award and duplicate winner correction

Owner direction, 2026-11-04:

- Arm of the Year requires 25 starts, ranked by mean GS+ with existing ties unchanged. This rule is independent of rolling Form qualification.
- Recomputed from all 4,425 frozen canonical starts: Jacob Misiorowski (63.1, 32 starts), Cam Schlittler (61.9, 31), Chris Sale (60.7, 27).
- Only the published review's `arms` and `copy.arm` fields change. The receipt records the prior review hash and new hash. Canonical scores, all other review fields, media and recaps remain unchanged. No LLM regeneration or new data fetch.
- Start of the Year remains the single featured winner. Shared Top Starts omits that ID, displaying original ranks 2-5 on home and 2-25 on the archive. Four remaining top-five full highlight cards are retained; compact ranks 6-25 are unchanged. Structured data still lists the complete 25, including the hero.

Checks:

- `node scripts/check-arm-qualification.mjs`: independent ranking, 12/24/25-start boundaries, unchanged source and unrelated fields.
- `node scripts/check-season-review.mjs`: review hash, trace, metrics and prose validation.
- `node scripts/check-season-start-dedup.mjs`: both list limits, original ranks and omitted winner.
- `node scripts/check-season-awards.mjs` and `node scripts/check-awards-mobile.mjs`: shared component regressions, with the explicitly authorized correction covered by field-level assertions.
- `node scripts/verify-season-award-correction.mjs BASE OUTPUT`: actual DOM on both surfaces at 390 and 1440, corrected podium, no duplicate list winner, mobile row height and screenshots.

Historical OFF-2.2 exact-text/desktop-pixel baselines predate the intentional winner changes and are not current award-content expectations.
