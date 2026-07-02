export type PitchTypeKey = "FF" | "SI" | "SL" | "CH" | "CU" | "FC";

export type PitchResultKey =
  | "called_strike"
  | "swinging_strike"
  | "foul"
  | "ball"
  | "hit_into_play";

export type PitchEvent = {
  id: string;
  gamePk: number;
  pitchNumber: number;
  inning: number;
  count: {
    balls: number;
    strikes: number;
  };
  type: PitchTypeKey;
  velocityMph: number;
  plateX: number;
  plateZ: number;
  result: PitchResultKey;
  statcast?: PitchEventStatcast;
};

export type PitchEventStatcast = {
  zone?: number | null;
  description?: string | null;
  launchSpeedMph?: number | null;
  launchAngleDeg?: number | null;
  estimatedWoba?: number | null;
  barrel?: boolean | null;
  hardHit?: boolean | null;
  releaseExtensionFt?: number | null;
  spinRateRpm?: number | null;
  pfxX?: number | null;
  pfxZ?: number | null;
};

export type PitcherSummary = {
  id: string;
  mlbId: number;
  name: string;
  team: string;
  headshotUrl: string;
  throws: "R" | "L";
};

export type TeamSummary = {
  abbreviation: string;
  name: string;
  color: string;
  accentColor: string;
};

export type GameSummary = {
  gamePk: number;
  date: string;
  homeTeam: TeamSummary;
  awayTeam: TeamSummary;
  venue: string;
  status: "scheduled" | "live" | "final";
};

export type StartLine = {
  inningsPitched: number;
  hits: number;
  earnedRuns: number;
  runsAllowed?: number;
  homeRunsAllowed?: number;
  walks: number;
  strikeouts: number;
  pitches: number;
};

export type StartContext = {
  label: string;
  whiffDeltaPct: number;
  velocityDeltaMph: number;
  parkRunFactor: number;
  parkLabel: string;
  opponentQualityRunValue: number;
  opponentQualityLabel: string;
  opponentOffenseRunValue: number;
  opponentOffenseLabel: string;
};

export type MlbTeamQualityContext = {
  abbreviation: string;
  teamId: number;
  wins: number;
  losses: number;
  runDifferential: number;
  winningPercentage: number;
  runsPerGame?: number;
  ops?: number;
  opponentQualityRunValue: number;
  opponentQualityLabel: string;
  opponentOffenseRunValue: number;
  opponentOffenseLabel: string;
};

export type MlbTeamHandednessSplitContext = {
  team: string;
  teamId: number;
  split: "vs-lhp" | "vs-rhp";
  gamesPlayed: number;
  plateAppearances: number;
  ops: number;
  obp: number;
  slg: number;
  iso: number;
  strikeoutRate: number;
  walkRate: number;
  opsRank: number;
  strikeoutRateRank: number;
  matchupRunValue: number;
  label: string;
};

export type StartDataSource = {
  schedule: MlbSchedule["source"];
  line: "fixture" | "archive-gamefeed" | "live-gamefeed";
  lineStatus?: "scheduled" | "live" | "final" | "warming" | "delay";
  ranking: "schedule-derived-fixture-line" | "schedule-derived-archive-line" | "schedule-derived-gamefeed-line";
};

export type StartSummary = {
  id: string;
  gamePk: number;
  date: string;
  rank: number;
  pitcher: PitcherSummary;
  opponent: string;
  side?: "home" | "away";
  result: "W" | "L" | "ND";
  line: StartLine;
  gameScorePlus: number;
  gameScoreV2?: number;
  eventFlags?: StartEventFlag[];
  expectedGameScorePlus?: number;
  gameScorePlusBreakdown?: StartApiGameScorePlusBreakdown;
  plannedStarter?: boolean;
  teamColor: string;
  accentColor: string;
  context: StartContext;
  source?: StartDataSource;
  highlightVideoId?: string;
};

export type ProbableStart = {
  id: string;
  gamePk: number;
  date: string;
  pitcherId: string;
  pitcherMlbId: number;
  pitcherName: string;
  team: string;
  opponent: string;
  side?: "home" | "away";
  venue?: string;
  gameLabel?: string;
  status: string;
  matchupScore: number;
  parkAdjustment: number;
};

export type FormTrend = "heating" | "steady" | "cooling";
export type FormStatus = "ok" | "insufficient";
export type HeatBandKey = "onfire" | "hot" | "even" | "cooling" | "ice";
export type FormTier = HeatBandKey;

export type HeatBand = {
  key: HeatBandKey;
  label: string;
  min: number;
  color: string;
  textClass: string;
};

export type FormStartPoint = {
  id: string;
  gameDate: string;
  gamePk: string;
  opp: string;
  park: string;
  ip: number;
  h: number;
  er: number;
  bb: number;
  k: number;
  gsPlus: number;
  result: StartSummary["result"];
  tier: FormTier;
  rollingMean: number;
  bandLow: number;
  bandHigh: number;
  startHref: string;
};

export type FormDriverChip = {
  key: "k-rate" | "walks" | "depth" | "run-prevention";
  label: string;
  direction: "good" | "bad";
  delta: number;
  score: number;
};

export type FormSeasonStats = {
  inningsPitched: number;
  era: number | null;
  whip: number | null;
  k9: number | null;
  qualityStarts: number;
};

export type FormSeasonDepthStats = {
  gemRate: number;
  dudRate: number;
  consistency: number;
  bestStart: number;
  worstStart: number;
  medianGsPlus: number;
  bandDistribution: Array<{
    key: FormTier;
    label: string;
    count: number;
    share: number;
    color: string;
  }>;
};

export type FormSeasonQualification = {
  teamGamesPlayed: number;
  minStarts: number;
  divisor: number;
  qualified: boolean;
};

export type FormDecisionRecord = {
  wins: number;
  losses: number;
  noDecisions: number;
};

export type FormWorkload = {
  lastStartDate: string | null;
  lastStartPitches: number | null;
  avgPitchesLast5: number | null;
  avgIpLast5: number | null;
};

export type StartEventFlag = "HARD_LUCK" | "VULTURE";

export type PitcherAvailability = {
  status: "injured-list";
  code: string;
  label: string;
  statusDate: string | null;
  blurb: string;
  transactionDescription: string | null;
  source: "mlb-roster-entries";
};

export type FormVenueSplitLabel = {
  label: "HOME FORTRESS" | "ROAD WARRIOR";
  strongSide: "home" | "away";
  weakSide: "home" | "away";
  gap: number;
  home: {
    starts: number;
    gsPlus: number;
    tier: FormTier;
  };
  away: {
    starts: number;
    gsPlus: number;
    tier: FormTier;
  };
  window: "current-plus-prior";
};

export type FormSummary = {
  pitcherId: string;
  name: string;
  team: string;
  throws?: "R" | "L";
  status: FormStatus;
  rgs: number;
  windowCount: number;
  seasonStartCount: number;
  bgs: number;
  deltaForm: number;
  trend: FormTrend;
  trendDelta: number;
  tier: FormTier;
  heatIndex?: number;
  spark: number[];
  formSpark: number[];
  lastStart: FormStartPoint | null;
  seasonStats: FormSeasonStats;
  seasonDepthStats: FormSeasonDepthStats;
  seasonQualification: FormSeasonQualification;
  seasonDecisionRecord: FormDecisionRecord;
  driverChips: FormDriverChip[];
  workload: FormWorkload;
  venueSplit?: FormVenueSplitLabel | null;
  availability?: PitcherAvailability | null;
  nextStart?: FormNextStart | null;
  highlight?: FeaturedStartHighlight | null;
  flags?: { rust?: boolean; limitedSample?: boolean; todaysStartNotReflected?: boolean };
};

export type FormNextStart = {
  date: string;
  opponent: string;
  side: "home" | "away";
};

export type FormLeaderboardResponse = {
  generatedAt: string;
  formThroughDate: string | null;
  latestScoredStartDate: string | null;
  stale: boolean;
  window: 3 | 5 | 10;
  leagueMeanGS: number;
  count: number;
  qualifiedCount: number;
  seasonQualificationThreshold: number;
  seasonUnrankedCount: number;
  heatingCount: number;
  coolingCount: number;
  pitchers: FormSummary[];
};

export type FormHomeResponse = {
  generatedAt: string;
  formThroughDate: string | null;
  latestScoredStartDate: string | null;
  stale: boolean;
  window: 3 | 5 | 10;
  leagueMeanGS: number;
  totalQualified: number;
  bands: Record<HeatBandKey, number>;
  hot: FormSummary[];
  cold: FormSummary[];
};

export type FormPitcherResponse = {
  pitcher: Pick<FormSummary, "pitcherId" | "name" | "team" | "throws" | "status">;
  formThroughDate: string | null;
  latestScoredStartDate: string | null;
  stale: boolean;
  window: 3 | 5 | 10;
  leagueMeanGS: number;
  series: FormStartPoint[];
  summary: FormSummary;
};

export type WatchTierKey = "mustwatch" | "worthit" | "background";
export type WatchSortPolicy = "status-then-watch-score";
export type StarterFormStatus = "ok" | "cold_start" | "mlb_debut" | "join_gap";
export type StarterLimitedReason = Exclude<StarterFormStatus, "ok"> | null;
export type MatchupConfidence = "HIGH" | "LOW" | "NONE";
export type ProbableStarterConfidence = "CONFIRMED" | "REPORTED" | "TBD";
export type ProbableStarterSource = "mlb-stats-api" | "secondary-feed" | "none";

export type TonightStarter = {
  pitcherId: string | null;
  name: string | null;
  team: string;
  side: "home" | "away";
  status: FormStatus | "tbd";
  formStatus: StarterFormStatus | "tbd";
  probableSource: ProbableStarterSource;
  probableConfidence: ProbableStarterConfidence;
  limitedReason: StarterLimitedReason;
  formCompleteness?: {
    matched: number;
    expected: number;
    careerGS: number | null;
  };
  rgs?: number;
  tier?: FormTier;
  trend?: FormTrend;
  deltaForm?: number;
  windowCount?: number;
  spark?: number[];
  lastStart?: FormStartPoint | null;
  seasonStats?: FormSeasonStats;
  seasonDecisionRecord?: FormDecisionRecord;
  driverChips?: FormDriverChip[];
  opponentSplit?: MlbTeamHandednessSplitContext | null;
  projection?: {
    status: "line-backed" | "pending";
    projectedGsPlus: number | null;
    confidence: "low" | "medium" | "high";
    line: {
      inningsPitched: number | null;
      strikeouts: number | null;
      earnedRuns: number | null;
    };
    notes: string[];
  };
  marketContext?: {
    status: "pending-feed" | "ready";
    source: "the-odds-api" | "not-configured" | "odds-deferred";
    projectedStrikeouts: number | null;
    strikeoutPropLine: number | null;
    strikeoutEdge: number | null;
    opposingTeamTotal: number | null;
    label: string;
  };
  workload?: FormWorkload & {
    daysRest: number | null;
    restLabel: "short" | "normal" | "extended" | "unknown";
  };
  availability?: PitcherAvailability | null;
  flags?: FormSummary["flags"] & { joinGap?: boolean; mlbDebut?: boolean };
  likelyOpener?: boolean;
};

export type TonightGameStatus = "pregame" | "live" | "final" | "ppd";
export type UpcomingCardStatus = Extract<TonightGameStatus, "pregame">;

export type TonightGame = {
  gamePk: string;
  date: string;
  status: TonightGameStatus;
  detailedState: string;
  firstPitch: string;
  park: string;
  parkContext: DecisionParkContext;
  weatherContext: DecisionWeatherContext;
  away: string;
  awayName: string;
  home: string;
  homeName: string;
  label: string;
  matchupScore: number;
  matchupRankTonight: number;
  matchupContext: {
    status: "pending-opponent-splits" | "scored";
    label: string;
  };
  starters: [TonightStarter, TonightStarter];
  gameWatchScore: number;
  watchTier: WatchTierKey;
  watchSortGroup: number;
  watchComponents: {
    topArm: number;
    pairing: number;
    matchup: number;
  };
  matchupConfidence: MatchupConfidence;
  flags?: { tbd?: boolean; limitedForm?: boolean; coldStartForm?: boolean; joinGapForm?: boolean; mlbDebut?: boolean; likelyOpener?: boolean };
};

export type TonightResponse = {
  date: string;
  generatedAt: string;
  activeCardStatuses: UpcomingCardStatus[];
  formWindow: 3 | 5 | 10;
  formThroughDate: string | null;
  latestScoredStartDate: string | null;
  formDataStale: boolean;
  leagueMeanGS: number;
  watchScoreWeights: {
    topArm: number;
    pairAvg: number;
    matchup: number;
  };
  watchSortPolicy: WatchSortPolicy;
  watchScoreRange: { min: number; max: number };
  watchScorePrecision: number;
  matchupScoreRange: { min: number; max: number };
  scheduledGames: number;
  games: TonightGame[];
};

export type UpcomingDay = TonightResponse;

export type UpcomingResponse = {
  range: {
    start: string;
    end: string;
  };
  generatedAt: string;
  days: UpcomingDay[];
};

export type DecisionParkContext = {
  venue: string;
  runFactor: number;
  runValue: number;
  label: string;
};

export type DecisionOpponentContext = {
  team: string;
  pitcherHand?: "R" | "L";
  scope: "overall" | "vs-lhp" | "vs-rhp";
  qualityRunValue: number;
  qualityLabel: string;
  offenseRunValue: number;
  offenseLabel: string;
};

export type DecisionWeatherContext = {
  source: "open-meteo" | "indoor" | "unavailable";
  tempF?: number;
  precipProbability?: number;
  windMph?: number;
  windDirectionDeg?: number;
  runValue: number;
  label: string;
};

export type DecisionToolsStarter = {
  pitcherId: string | null;
  name: string | null;
  team: string;
  opponent: string;
  side: "home" | "away";
  throws?: "R" | "L";
  status: FormStatus | "tbd";
  form: Pick<FormSummary, "rgs" | "tier" | "trend" | "deltaForm" | "spark" | "windowCount"> | null;
  opponentContext: DecisionOpponentContext;
  parkContext: DecisionParkContext;
  weatherContext: DecisionWeatherContext;
};

export type DecisionToolsGame = {
  gamePk: string;
  date: string;
  status: TonightGameStatus;
  firstPitch: string;
  label: string;
  away: string;
  home: string;
  park: string;
  starters: [DecisionToolsStarter, DecisionToolsStarter];
  parkContext: DecisionParkContext;
  weatherContext: DecisionWeatherContext;
};

export type DecisionToolsFoundationResponse = {
  range: {
    start: string;
    end: string;
  };
  generatedAt: string;
  source: {
    schedule: Array<{ date: string; source: MlbSchedule["source"] }>;
    opponent: "mlb-standings-and-team-offense" | "fallback";
    park: "shared-venue-run-factors";
    weather: "open-meteo";
  };
  games: DecisionToolsGame[];
};

export type DuelStarter = {
  pitcherId: string;
  name: string;
  team: string;
  score: number;
  scoreLabel: "GS+" | "Form";
  trend?: FormTrend;
  deltaForm?: number;
  tier?: FormTier;
  spark?: number[];
  href: string;
};

export type PitchingDuel = {
  gamePk: string;
  date: string;
  label: string;
  status: TonightGameStatus | "settled";
  firstPitch?: string;
  park?: string;
  starters: [DuelStarter, DuelStarter];
  gap: number;
  combinedQuality: number;
  duelScore: number;
  mismatchScore: number;
};

export type PitchingDuelsResponse = {
  date: string;
  generatedAt: string;
  mode: "upcoming" | "settled";
  bestDuels: PitchingDuel[];
  closestDuels: PitchingDuel[];
  mismatches: PitchingDuel[];
};

export type MlbProbablePitcher = {
  id: number;
  fullName: string;
  teamAbbreviation: string;
  opponentAbbreviation: string;
  side: "home" | "away";
  source: ProbableStarterSource;
  confidence: ProbableStarterConfidence;
};

export type MlbProbablePitcherGame = MlbProbablePitcher & {
  gamePk: number;
  gameDate: string;
  gameStatus: string;
  venue: string;
  homeTeam: Pick<TeamSummary, "abbreviation" | "name">;
  awayTeam: Pick<TeamSummary, "abbreviation" | "name">;
};

export type MlbScheduleGame = {
  gamePk: number;
  gameDate: string;
  gameType?: string;
  status: string;
  detailedState: string;
  venue: string;
  homeTeam: Pick<TeamSummary, "abbreviation" | "name">;
  awayTeam: Pick<TeamSummary, "abbreviation" | "name">;
  probableHomePitcher?: MlbProbablePitcher;
  probableAwayPitcher?: MlbProbablePitcher;
};

export type MlbSchedule = {
  date: string;
  source: "fixture" | "live";
  games: MlbScheduleGame[];
};

export type MlbCompletedPitchingLine = {
  gamePk: number;
  pitcherMlbId: number;
  pitcherName?: string;
  teamAbbreviation: string;
  opponentAbbreviation: string;
  side: "home" | "away";
  gameStatus?: "live" | "final" | "warming" | "delay";
  result: StartSummary["result"];
  line: StartLine;
};

export type MlbLivePitchingLine = MlbCompletedPitchingLine & {
  gameStatus: "live" | "final" | "warming" | "delay";
  starterIsOut: boolean;
  inningLabel: string | null;
};

export type StartPitchDetailSource = "fixture" | "archive-gamefeed" | "live-gamefeed" | "statcast-savant";

export type ArsenalPitchSummary = {
  type: PitchTypeKey;
  usagePct: number;
  avgVelocityMph: number;
  whiffPct: number;
  calledStrikePct: number;
};

export type MlbStartPitchDetails = {
  source: StartPitchDetailSource;
  arsenal: ArsenalPitchSummary[];
  pitchEvents: PitchEvent[];
};

export type ArchivedPitcherRecentArsenal = MlbStartPitchDetails & {
  source: "archive-gamefeed";
  archiveArsenal: {
    season: string;
    startDate: string;
    endDate: string;
    archivedAt: string;
    source: "mlb-stats-api";
    starts: number;
    pitchEvents: number;
    firstStartDate: string;
    lastStartDate: string;
  };
};

export type ArchivedStartPitchDetailSummary = {
  status: "stored" | "missing-gamefeed-pitches" | "not-archived";
  pitchEvents: number;
  date?: string;
  archivedAt?: string;
  source?: "mlb-stats-api";
};

export type ArchivedStartLineSummary = {
  status: "stored" | "not-archived";
  date?: string;
  archivedAt?: string;
  source?: "mlb-stats-api";
};

export type StartArsenalEventSummary = {
  newPitchTypes: PitchTypeKey[];
  usageShifts: Array<{
    type: PitchTypeKey;
    usagePct: number;
    usageDeltaPct: number;
  }>;
};

export type MlbPitcherSeasonProfile = {
  source: "live-people-stats";
  id: string;
  mlbId: number;
  name: string;
  team: string;
  throws: "R" | "L";
  headshotUrl: string;
  seasonLine: PitcherDetail["seasonLine"];
  starts: PitcherStartLogEntry[];
};

export type ArchivedPitcherSeasonProfile = {
  source: "archive-gamefeed";
  mlbId: number;
  name: string;
  team: string;
  archiveProfile: {
    season: string;
    startDate: string;
    endDate: string;
    archivedAt: string;
    source: "mlb-stats-api";
    dates: number;
    games: number;
    completedGames: number;
    completedGamesWithStarts: number;
    completedGamesMissingStarts: number;
    starts: number;
    pitchEvents: number;
    pitcherStarts: number;
  };
  seasonLine: PitcherDetail["seasonLine"];
  starts: PitcherStartLogEntry[];
};

export type MlbPitcherSplitGroup = {
  key: "vs-rhb" | "vs-lhb" | "home" | "away";
  label: string;
  scope: "batter-hand" | "venue";
  inningsPitched: number;
  era: number | null;
  strikeouts: number;
  walks: number;
  opponentAverage: number;
  note: string;
};

export type StartDetail = StartSummary & {
  game: GameSummary;
  arsenal: ArsenalPitchSummary[];
  pitchEvents: PitchEvent[];
  velocityTrend?: StartApiVelocityTrend[];
  inningTimeline?: StartApiInningTimeline[];
  countLeverage?: StartApiCountLeverage[];
  pitchSequence?: StartApiPitchSequenceRow[];
  gameScorePlusBreakdown?: StartApiGameScorePlusBreakdown;
  pitchDetailSource?: StartPitchDetailSource;
  archivePitchDetail?: ArchivedStartPitchDetailSummary;
  archiveCompletedLine?: ArchivedStartLineSummary;
  arsenalEventSummary?: StartArsenalEventSummary;
};

export type FeaturedStartHighlight = {
  videoId: string;
  source: "manual" | "stored" | "youtube-search";
  isShort: boolean;
  embedUrl: string;
  thumbnailUrl: string;
  watchUrl: string;
};

export type PitcherStartLogEntry = Pick<StartSummary, "id" | "date" | "opponent" | "result" | "line" | "gameScorePlus" | "gameScoreV2"> & {
  gamePk?: number;
  pitchEvents?: PitchEvent[];
};

export type PitcherDetail = PitcherSummary & {
  seasonLine: {
    starts: number;
    inningsPitched: number;
    era: number;
    strikeouts: number;
    walks: number;
  };
  arsenal: ArsenalPitchSummary[];
  starts: PitcherStartLogEntry[];
};

export type PitcherApiStartLogEntry = PitcherStartLogEntry & {
  startHref: string;
};

export type PitcherApiSeasonLogSummary = {
  recentStartCount: number;
  averageGameScorePlus: number;
  averageInningsPitched: number;
  lastStart: Pick<PitcherApiStartLogEntry, "id" | "date" | "opponent" | "result" | "gameScorePlus" | "startHref"> | null;
  bestStart: Pick<PitcherApiStartLogEntry, "id" | "date" | "opponent" | "result" | "gameScorePlus" | "startHref"> | null;
};

export type PitcherSkillSnapshot = {
  label: "Season" | "Last 30";
  status: "line-backed" | "insufficient";
  starts: number;
  inningsPitched: number;
  era: number | null;
  whip: number | null;
  k9: number | null;
  bb9: number | null;
  kMinusBbPer9: number | null;
  avgIpPerStart: number | null;
  pitchesPerStart: number | null;
  pitchCount: number;
  cswPct: number | null;
  swStrPct: number | null;
  whiffPct: number | null;
  avgVelocityMph: number | null;
  maxVelocityMph: number | null;
};

export type PitcherSkillProfile = {
  source: "archive-gamefeed-line" | "live-people-stats-line" | "fixture-line";
  note: string;
  season: PitcherSkillSnapshot;
  trailing30: PitcherSkillSnapshot;
  trend: {
    status: "available" | "insufficient";
    starts: number;
    cswDeltaPct: number | null;
    whiffDeltaPct: number | null;
    swStrDeltaPct: number | null;
    avgVelocityDeltaMph: number | null;
    summary: string;
  };
  statcastStatus: "available" | "partial" | "pending";
};

export type PitcherVelocityStart = {
  id: string;
  date: string;
  opponent: string;
  startHref: string;
  avgVelocityMph: number;
  maxVelocityMph: number;
  belowSeasonMedian: boolean;
};

export type PitcherPitchMixStart = {
  id: string;
  date: string;
  opponent: string;
  startHref: string;
  pitches: number;
  newPitchTypes: PitchTypeKey[];
  mix: Array<{
    type: PitchTypeKey;
    usagePct: number;
    usageDeltaPct: number | null;
    firstSeen: boolean;
  }>;
};

export type PitcherApiSeasonLogSort = "date-desc" | "gs-desc" | "ip-desc";

export type PitcherApiSeasonLogResultFilter = "all" | "W" | "L" | "ND";

export type PitcherApiSeasonLogControls = {
  sort: PitcherApiSeasonLogSort;
  result: PitcherApiSeasonLogResultFilter;
  totalStartCount: number;
  shownStartCount: number;
  options: {
    sort: PitcherApiSeasonLogSort[];
    result: PitcherApiSeasonLogResultFilter[];
  };
};

export type PitcherApiSplitGroup = {
  key: "vs-rhb" | "vs-lhb" | "home" | "away";
  label: string;
  scope: "batter-hand" | "venue";
  status: "live-people-stat-splits" | "pending-live-source";
  inningsPitched: number | null;
  era: number | null;
  strikeouts: number | null;
  walks: number | null;
  opponentAverage: number | null;
  note: string;
};

export type PitcherApiResponse = Pick<PitcherSummary, "id" | "mlbId" | "name" | "team" | "throws" | "headshotUrl"> & {
  seasonLine: PitcherDetail["seasonLine"];
  skillProfile: PitcherSkillProfile;
  arsenal: ArsenalPitchSummary[];
  velocityByStart: PitcherVelocityStart[];
  pitchMixByStart: PitcherPitchMixStart[];
  starts: PitcherApiStartLogEntry[];
  seasonLogSummary: PitcherApiSeasonLogSummary;
  seasonLogControls: PitcherApiSeasonLogControls;
  source: {
    identity: "fixture" | "live-people-stats";
    seasonLine: "fixture" | "archive-gamefeed" | "live-people-stats";
    startHistory: "fixture" | "archive-gamefeed" | "live-people-stats";
    arsenal: "fixture" | "archive-gamefeed" | "live-gamefeed" | "statcast-savant";
    splits: "live-people-stat-splits" | "pending-live-source";
    archiveArsenal: {
      season: string;
      startDate: string;
      endDate: string;
      archivedAt: string;
      source: "mlb-stats-api";
      starts: number;
      pitchEvents: number;
      firstStartDate: string;
      lastStartDate: string;
    } | null;
    archiveProfile: {
      season: string;
      startDate: string;
      endDate: string;
      archivedAt: string;
      source: "mlb-stats-api";
      dates: number;
      games: number;
      completedGames: number;
      completedGamesWithStarts: number;
      completedGamesMissingStarts: number;
      starts: number;
      pitchEvents: number;
      pitcherStarts: number;
    } | null;
  };
  splits: {
    status: "live-people-stat-splits" | "pending-live-source";
    groups: PitcherApiSplitGroup[];
  };
};

export type SlateWindow = "yesterday" | "today" | "tomorrow" | "week";

export type SlateRouteParams = {
  window: SlateWindow;
  date: string;
};

export type SlateNavItem = SlateRouteParams & {
  label: string;
  href: string;
};

export type SlateApiGame = {
  gamePk: number;
  status: string;
  venue: string;
  label: string;
  probablePitcherIds: number[];
};

export type SlateApiProbable = Pick<ProbableStart, "id" | "gamePk" | "pitcherMlbId" | "pitcherName" | "team" | "opponent" | "side" | "status">;

export type SlateApiStart = {
  id: string;
  gamePk: number;
  date: string;
  rank: number;
  pitcherMlbId: number;
  pitcherName: string;
  team: string;
  opponent: string;
  result: StartSummary["result"];
  line: StartLine;
  gameScorePlus: number;
  gameScoreV2?: number;
  eventFlags?: StartEventFlag[];
  gameScorePlusBreakdown: StartApiGameScorePlusBreakdown;
  source: {
    schedule: StartDataSource["schedule"];
    line: StartDataSource["line"];
    ranking: StartDataSource["ranking"];
  };
};

export type SlateApiResponse = SlateRouteParams & {
  counts: {
    starts: number;
    probables: number;
    games: number;
  };
  source: {
    schedule: MlbSchedule["source"];
    completedStartStats: "fixture" | "archive-gamefeed" | "live-gamefeed";
    completedStartStatsCoverage: {
      total: number;
      archiveGamefeed: number;
      liveGamefeed: number;
      fixture: number;
    };
    archiveDate: {
      date: string;
      archivedAt: string;
      source: "mlb-stats-api";
      games: number;
      completedGames: number;
      completedGamesWithStarts: number;
      completedGamesMissingStarts: number;
      starts: number;
      pitchEvents: number;
      startsWithPitchEvents: number;
      startsMissingPitchEvents: number;
    } | null;
  };
  scoreScale: SlateApiScoreScale;
  scoreDeltaComparison: SlateApiScoreDeltaComparison | null;
  games: SlateApiGame[];
  probables: SlateApiProbable[];
  starts: SlateApiStart[];
};

export type StartApiPitchCount = {
  total: number;
  byType: Partial<Record<PitchTypeKey, number>>;
  byInning: Array<{
    inning: number;
    pitches: number;
  }>;
};

export type StartApiVelocityTrend = {
  inning: number;
  avgVelocityMph: number;
  maxVelocityMph: number;
};

export type StartApiInningTimeline = {
  inning: number;
  pitches: number;
  strikes: number;
  whiffs: number;
  inPlay: number;
  avgVelocityMph: number;
  maxVelocityMph: number;
};

export type StartApiCountLeverage = {
  inning: number;
  ahead: number;
  even: number;
  behind: number;
  twoStrike: number;
};

export type StartApiPitchSequenceRow = Pick<PitchEvent, "id" | "pitchNumber" | "inning" | "count" | "type" | "result" | "velocityMph" | "plateX" | "plateZ"> & {
  countLabel: string;
  locationLabel: string;
};

export type StartApiGameScorePlusComponent = {
  key: "baseline" | "innings" | "strikeouts" | "earnedRuns" | "hits" | "walks" | "whiffDelta" | "velocityDelta" | "parkContext" | "opponentQuality" | "opponentOffense" | "calibration";
  label: string;
  value: number;
  description: string;
};

export type StartApiGameScorePlusGradeLabel = "Elite" | "Plus" | "Average" | "Below average" | "Poor";

export type StartApiGameScorePlusBreakdown = {
  total: number;
  preciseTotal: number;
  formulaVersion: "context-v7";
  gradeBand: {
    label: StartApiGameScorePlusGradeLabel;
    percentileLabel: string;
    rangeLabel: string;
    description: string;
  };
  components: StartApiGameScorePlusComponent[];
  rankingReasons: Array<StartApiGameScorePlusComponent & {
    impact: "positive" | "negative";
  }>;
};

export type SlateApiScoreScale = {
  formulaVersion: StartApiGameScorePlusBreakdown["formulaVersion"];
  displayRange: "20-80";
  low: number;
  high: number;
  average: number;
  explanation: Array<{
    label: string;
    value: string;
    description: string;
  }>;
  gradeBandCounts: Array<{
    label: StartApiGameScorePlusGradeLabel;
    count: number;
  }>;
};

export type SlateApiScoreDeltaComparison = {
  leader: {
    rank: number;
    pitcherName: string;
    gameScorePlus: number;
  };
  comparedStarts: Array<{
    rank: number;
    pitcherName: string;
    gameScorePlus: number;
  }>;
  components: Array<{
    key: StartApiGameScorePlusComponent["key"];
    label: string;
    description: string;
    leaderValue: number;
    rows: Array<{
      rank: number;
      pitcherName: string;
      gameScorePlus: number;
      value: number;
      deltaVsLeader: number;
    }>;
  }>;
};

export type StartApiResponse = {
  id: string;
  gamePk: number;
  date: string;
  pitcherMlbId: number;
  pitcherName: string;
  team: string;
  opponent: string;
  line: StartLine;
  gameScorePlus: number;
  gameScoreV2?: number;
  eventFlags?: StartEventFlag[];
  gameScorePlusBreakdown: StartApiGameScorePlusBreakdown;
  source: {
    schedule: StartDataSource["schedule"];
    line: StartDataSource["line"];
    ranking: StartDataSource["ranking"];
    pitchDetail: StartPitchDetailSource;
    archivePitchDetail: ArchivedStartPitchDetailSummary;
    archiveCompletedLine: ArchivedStartLineSummary;
  };
  pitchCounts: StartApiPitchCount;
  velocityTrend: StartApiVelocityTrend[];
  inningTimeline: StartApiInningTimeline[];
  countLeverage: StartApiCountLeverage[];
  pitchSequence: StartApiPitchSequenceRow[];
  arsenal: ArsenalPitchSummary[];
  pitchEvents: PitchEvent[];
  arsenalEventSummary?: StartArsenalEventSummary;
};
