# Matchup Sentences Energy Pass

Spec: P2-26.15
Date: 2026-07-08

## Finding

P2-26.14 landed the hard validators, but the generation path could still retreat into short form-number captions. The packet assembly existed, including K-line, venue, season-best, streak, and narrative-notable facts, but two gaps kept the board flat:

- Stored fallback writeups were not returned by the page reader, so packet-aware fallback copy could not surface.
- Final validation rechecked fallback copy through the generic SIMPLE validator without fact trace context, which favored plain numeric form sentences.

## Decision

Keep the stricter truthfulness and n-gram validators, but give the generator real material and a stronger structure target:

- Stored fallback writeups are now visible when valid.
- Deterministic fallback is packet-first when a traceable fact exists.
- The prompt now asks for high-energy baseball copy under a 24-word ceiling, leading with the most electric true thing.
- The writeup version moved to 6 and prompt version to 13, forcing regeneration.
- A structure crowding guard blocks the possessive-number-single-clause pattern from taking over more than one third of a slate.

## Guardrails

- New jargon banned: `the starter read`, `the trust edge`, `sets the tone`, `leads the read`, `anchors the read`, and `keeps the trust edge`.
- Short captions under 12 words are rejected unless the archetype is quiet/provisional/TBD.
- Fact claims still require matching packet trace, including no-hit and hitless-inning notables from the P2-45 stored notable path.
- The previous n-gram, concreteness, attribution, no-em-dash, and number-fidelity checks still apply.
