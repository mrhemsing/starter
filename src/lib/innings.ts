export function inningsFromIP(value: number | string) {
  const raw = typeof value === "number" ? value.toFixed(1) : value.trim();
  const match = raw.match(/^(\d+)(?:\.(\d+))?$/);

  if (!match) {
    throw new Error(`Invalid innings pitched value: ${raw}`);
  }

  const wholeInnings = Number(match[1]);
  const extraOuts = Number(match[2] ?? "0");

  if (extraOuts > 2) {
    throw new Error(`Invalid baseball IP fraction: ${raw}`);
  }

  return wholeInnings + extraOuts / 3;
}

export function outsFromIP(value: number | string) {
  return Math.round(inningsFromIP(value) * 3);
}
