# Matchup Sentences Tightening

Date: 2026-07-08
Spec: P2-26.14

## Finding

The hedge ban and archetype validators were present, but two gaps let weak sentences through:

| Issue | Finding | Fix |
| --- | --- | --- |
| Mid-sentence repetition | The variety guard lived in generation behavior and did not compare accepted sentences across the slate. Repeated scaffolds could appear after the opening phrase. | Added slate-wide 4-plus-word n-gram collision checks across accepted writeups, normalized for pitcher names and numbers. |
| New cliches | The fallback phrase bank and LLM validator did not ban the new live-board phrases. | Added the new prohibited phrase list to fallback and LLM validators, and removed those phrases from deterministic banks. |
| Contentless copy | A sentence could pass without a concrete number, factor, or fact hook. | Validators now require a concrete specific: input number, fact-packet trace, park/weather/rest/K-line/opponent-total detail, or honest TBD state. |
| Clause stapling | The validator only counted sentences, not comma chains or duplicate conclusions. | Added comma-chain and duplicate comparative-conclusion rejection. |
| Fact hooks missing | P2-26.12 was wired to Upcoming writeups, but the prompt only said facts were optional and the fact gates were strict enough that typical slates could surface none. | Prompt now asks for one genuine fact when interesting, and gates were calibrated for real K-line, venue-history, season-best, and streak hooks without forcing boring facts. |

## Regeneration

The stored writeup version moved from `4` to `5` and prompt version from `11` to `12`, forcing the current slate to regenerate instead of reusing old stored LLM sentences.

## Guardrails

`npm run check:matchup-sentences` verifies:

- new cliches are present in the banned list and absent from renderable fallback banks
- every accepted sentence must have a concrete specific
- comma-splice chains and duplicate comparative conclusions are rejected
- slate-wide 4-plus-word n-gram collision checks normalize pitcher names and numbers
- fact-packet gates are calibrated so real hooks can surface
- the version bump forces full regeneration
