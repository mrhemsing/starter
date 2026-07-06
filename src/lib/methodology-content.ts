export const METHODOLOGY_PENDING_METRIC_TODOS = [
  "P3-10: add BUY-LOW and xGS+ methodology copy when those metrics ship.",
  "P3-12.1: keep capped RAW annotation copy tied to the shared raw GS+ display helper.",
];

export const GS_PLUS_20_80_FAQ_QUESTION = "Why is GS+ capped at 20 and 80?";

export const GS_PLUS_20_80_FAQ_PARAGRAPHS = [
  "The 20-80 scale is baseball's oldest shared grading language, credited to Branch Rickey's front office in the 1950s. It works like a standard score: 50 is major league average, and each 10 points represents one standard deviation away from it. In a normal distribution, three standard deviations on either side of the mean cover 99.7 percent of the population. That is why the scale runs 20 to 80 instead of 0 to 100: beyond three deviations there is almost nobody left to grade.",
  "Scouts have used this vocabulary for decades. A 60 is plus, a 70 is plus-plus, and an 80 is reserved for the rare extreme: the best fastball, the best tool, the best of the best. Because the language is shared, a grade carries meaning instantly, with no legend required. GS+ adopts the scale so a start's number reads the same way a scouting grade does.",
  "The cap is part of the scale's definition, not a limitation we regret. An 80 already means the extreme, so GS+ never displays beyond it. When a start is good enough to hit the cap, the raw pre-calibration score is shown beneath the 80, so historic starts still separate from merely great ones. On the other end, 20 is the floor for the same reason.",
];

export const GS_PLUS_20_80_FAQ_ANSWER = GS_PLUS_20_80_FAQ_PARAGRAPHS.join(" ");
