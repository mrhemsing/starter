export type WatchRankInput = {
  gameWatchScore: number;
  firstPitch: string;
  away: string;
};

export function assignWatchRanks<T extends WatchRankInput>(games: T[]) {
  const watchRankOf = games.length;
  const ordered = [...games].sort((a, b) =>
    b.gameWatchScore - a.gameWatchScore ||
    a.firstPitch.localeCompare(b.firstPitch) ||
    a.away.localeCompare(b.away),
  );
  const rankByGame = new Map(ordered.map((game, index) => [game, index + 1]));
  return games.map((game) => ({
    ...game,
    watchRank: rankByGame.get(game) ?? watchRankOf,
    watchRankOf,
  }));
}
