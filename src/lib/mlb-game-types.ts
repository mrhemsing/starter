// MLB regular season plus Wild Card, Division, Championship and World Series.
// Exclude spring training, exhibitions and the All-Star Game.
export const MLB_BOARD_GAME_TYPES = "R,F,D,L,W";

export function isMlbBoardGameType(gameType: string | undefined): gameType is string {
  return gameType !== undefined && MLB_BOARD_GAME_TYPES.split(",").includes(gameType);
}
