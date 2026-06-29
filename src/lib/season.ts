export function currentSeasonFromDate(date: string) {
  const match = date.match(/^(\d{4})-/);
  return match?.[1] ?? String(new Date().getFullYear());
}
