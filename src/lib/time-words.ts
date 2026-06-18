type SlateTimeWordInput = {
  date?: string | null;
};

type GameTimeWordInput = {
  firstPitch?: string | null;
  date?: string | null;
};

type TimeWordOptions = {
  today?: string;
};

export function slateTimeWord(slate: SlateTimeWordInput, options: TimeWordOptions = {}) {
  const today = options.today ?? localIsoDate();
  const slateDate = slate.date ?? today;
  if (slateDate === today) return "today";
  if (slateDate === addDays(today, 1)) return "tomorrow";
  if (slateDate === addDays(today, -1)) return "yesterday";
  return "today";
}

export function slateTimeWordTitle(slate: SlateTimeWordInput, options: TimeWordOptions = {}) {
  const word = slateTimeWord(slate, options);
  return word.slice(0, 1).toUpperCase() + word.slice(1);
}

export function gameTimeWord(game: GameTimeWordInput, options: TimeWordOptions = {}) {
  const firstPitch = game.firstPitch;
  if (!firstPitch) return slateTimeWord({ date: game.date }, options);

  const hour = Number(new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: "America/New_York",
  }).format(new Date(firstPitch)));
  const period = hour < 12 ? "this morning" : hour < 17 ? "this afternoon" : "tonight";

  const today = options.today ?? localIsoDate();
  const gameDate = game.date ?? firstPitch.slice(0, 10);
  if (gameDate === addDays(today, 1)) {
    if (period === "tonight") return "tomorrow night";
    return period.replace("this", "tomorrow");
  }
  if (gameDate === addDays(today, -1)) return "yesterday";
  return period;
}

function localIsoDate() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Los_Angeles",
  }).format(new Date());
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
