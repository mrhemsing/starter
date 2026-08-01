export type WatchRankInput = {
  gameWatchScore: number;
  firstPitch: string;
  away: string;
};

export function assignWatchRanks<T extends WatchRankInput>(games: T[], options: { canRankFirst?: (game: T) => boolean } = {}) {
  const watchRankOf = games.length;
  const ordered = [...games].sort((a, b) =>
    b.gameWatchScore - a.gameWatchScore ||
    a.firstPitch.localeCompare(b.firstPitch) ||
    a.away.localeCompare(b.away),
  );
  const firstEligibleIndex = options.canRankFirst ? ordered.findIndex(options.canRankFirst) : -1;
  if (firstEligibleIndex > 0) {
    const [firstEligible] = ordered.splice(firstEligibleIndex, 1);
    ordered.unshift(firstEligible);
  }
  const rankByGame = new Map(ordered.map((game, index) => [game, index + 1]));
  return games.map((game) => ({
    ...game,
    watchRank: rankByGame.get(game) ?? watchRankOf,
    watchRankOf,
  }));
}
