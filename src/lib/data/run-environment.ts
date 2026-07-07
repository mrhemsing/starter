import type { DecisionParkContext, DecisionWeatherContext } from "@/lib/types";

const NEUTRAL_PARK_RUN_FACTOR = 1;
export const PARK_RUN_FACTOR_MIN = 0.85;
export const PARK_RUN_FACTOR_MAX = 1.2;
export const PARK_FACTOR_SOURCE = "FanGraphs 3-year park factors, normalized to 1.00 run environment";
const WEATHER_REVALIDATE_SECONDS = 15 * 60;
const WEATHER_FETCH_TIMEOUT_MS = 5000;

export const VENUE_RUN_FACTORS: Record<string, number> = {
  "Angel Stadium": 0.98,
  "Busch Stadium": 0.97,
  "Chase Field": 1.03,
  "Citi Field": 0.97,
  "Citizens Bank Park": 1.01,
  "Comerica Park": 0.98,
  "Coors Field": 1.16,
  "Daikin Park": 0.99,
  "Dodger Stadium": 0.98,
  "Fenway Park": 1.05,
  "George M. Steinbrenner Field": 1.02,
  "Globe Life Field": 1,
  "Great American Ball Park": 1.08,
  "Guaranteed Rate Field": 1.01,
  "Kauffman Stadium": 1,
  "loanDepot park": 0.96,
  "Minute Maid Park": 0.99,
  "Nationals Park": 1,
  "Oracle Park": 0.94,
  "Oriole Park at Camden Yards": 1.01,
  "Petco Park": 0.95,
  "PNC Park": 0.98,
  "Progressive Field": 0.99,
  "Rate Field": 1.01,
  "Rogers Centre": 1.02,
  "Sutter Health Park": 1,
  "T-Mobile Park": 0.95,
  "Target Field": 0.99,
  "Truist Park": 1.01,
  "UNIQLO Field at Dodger Stadium": 0.98,
  "Wrigley Field": 1.04,
  "Yankee Stadium": 1.03,
};

validateVenueRunFactorTable(VENUE_RUN_FACTORS);

type VenueWeatherProfile = {
  latitude: number;
  longitude: number;
  outdoor: boolean;
  label: string;
};

const VENUE_WEATHER_PROFILES: Record<string, VenueWeatherProfile> = {
  "Angel Stadium": { latitude: 33.8003, longitude: -117.8827, outdoor: true, label: "Anaheim, CA" },
  "Busch Stadium": { latitude: 38.6226, longitude: -90.1928, outdoor: true, label: "St. Louis, MO" },
  "Chase Field": { latitude: 33.4455, longitude: -112.0667, outdoor: false, label: "Phoenix, AZ" },
  "Citi Field": { latitude: 40.7571, longitude: -73.8458, outdoor: true, label: "Queens, NY" },
  "Citizens Bank Park": { latitude: 39.9061, longitude: -75.1665, outdoor: true, label: "Philadelphia, PA" },
  "Comerica Park": { latitude: 42.339, longitude: -83.0485, outdoor: true, label: "Detroit, MI" },
  "Coors Field": { latitude: 39.7561, longitude: -104.9942, outdoor: true, label: "Denver, CO" },
  "Daikin Park": { latitude: 29.7573, longitude: -95.3555, outdoor: false, label: "Houston, TX" },
  "Dodger Stadium": { latitude: 34.0739, longitude: -118.24, outdoor: true, label: "Los Angeles, CA" },
  "Fenway Park": { latitude: 42.3467, longitude: -71.0972, outdoor: true, label: "Boston, MA" },
  "George M. Steinbrenner Field": { latitude: 27.9801, longitude: -82.5067, outdoor: true, label: "Tampa, FL" },
  "Globe Life Field": { latitude: 32.7473, longitude: -97.0842, outdoor: false, label: "Arlington, TX" },
  "Great American Ball Park": { latitude: 39.0979, longitude: -84.5066, outdoor: true, label: "Cincinnati, OH" },
  "Guaranteed Rate Field": { latitude: 41.83, longitude: -87.6338, outdoor: true, label: "Chicago, IL" },
  "Kauffman Stadium": { latitude: 39.0517, longitude: -94.4803, outdoor: true, label: "Kansas City, MO" },
  "loanDepot park": { latitude: 25.7781, longitude: -80.2197, outdoor: false, label: "Miami, FL" },
  "Minute Maid Park": { latitude: 29.7573, longitude: -95.3555, outdoor: false, label: "Houston, TX" },
  "Nationals Park": { latitude: 38.873, longitude: -77.0074, outdoor: true, label: "Washington, DC" },
  "Oracle Park": { latitude: 37.7786, longitude: -122.3893, outdoor: true, label: "San Francisco, CA" },
  "Oriole Park at Camden Yards": { latitude: 39.2839, longitude: -76.6217, outdoor: true, label: "Baltimore, MD" },
  "Petco Park": { latitude: 32.7073, longitude: -117.1566, outdoor: true, label: "San Diego, CA" },
  "PNC Park": { latitude: 40.4469, longitude: -80.0057, outdoor: true, label: "Pittsburgh, PA" },
  "Progressive Field": { latitude: 41.4962, longitude: -81.6852, outdoor: true, label: "Cleveland, OH" },
  "Rate Field": { latitude: 41.83, longitude: -87.6338, outdoor: true, label: "Chicago, IL" },
  "Rogers Centre": { latitude: 43.6414, longitude: -79.3894, outdoor: false, label: "Toronto, ON" },
  "Sutter Health Park": { latitude: 38.5804, longitude: -121.5135, outdoor: true, label: "West Sacramento, CA" },
  "T-Mobile Park": { latitude: 47.5914, longitude: -122.3325, outdoor: false, label: "Seattle, WA" },
  "Target Field": { latitude: 44.9817, longitude: -93.2776, outdoor: true, label: "Minneapolis, MN" },
  "Tropicana Field": { latitude: 27.7683, longitude: -82.6534, outdoor: false, label: "St. Petersburg, FL" },
  "Truist Park": { latitude: 33.8908, longitude: -84.4678, outdoor: true, label: "Atlanta, GA" },
  "UNIQLO Field at Dodger Stadium": { latitude: 34.0739, longitude: -118.24, outdoor: true, label: "Los Angeles, CA" },
  "Wrigley Field": { latitude: 41.9484, longitude: -87.6553, outdoor: true, label: "Chicago, IL" },
  "Yankee Stadium": { latitude: 40.8296, longitude: -73.9262, outdoor: true, label: "Bronx, NY" },
};

export function getParkFactorRows() {
  return Object.keys(VENUE_RUN_FACTORS)
    .map((venue) => {
      const weatherProfile = VENUE_WEATHER_PROFILES[venue];
      const parkContext = getParkContext(venue);
      return {
        venue,
        runFactor: parkContext.runFactor,
        runValue: parkContext.runValue,
        environment: weatherProfile?.outdoor === false ? "Roofed / climate controlled" : weatherProfile?.outdoor === true ? "Outdoor" : "Weather profile pending",
        location: weatherProfile?.label ?? "Location pending",
        label: parkContext.label,
        source: PARK_FACTOR_SOURCE,
      };
    })
    .sort((a, b) => b.runFactor - a.runFactor || a.venue.localeCompare(b.venue));
}

type OpenMeteoHourly = {
  time?: string[];
  temperature_2m?: number[];
  precipitation_probability?: number[];
  wind_speed_10m?: number[];
  wind_direction_10m?: number[];
};

type OpenMeteoResponse = {
  hourly?: OpenMeteoHourly;
};

const weatherCache = new Map<string, Promise<DecisionWeatherContext>>();

export function getParkContext(venue: string): DecisionParkContext {
  const storedRunFactor = VENUE_RUN_FACTORS[venue];
  const hasStoredRunFactor = typeof storedRunFactor === "number";
  if (hasStoredRunFactor && !isValidParkRunFactor(storedRunFactor)) {
    logInvalidParkRunFactor(venue, storedRunFactor);
  }
  const available = hasStoredRunFactor && isValidParkRunFactor(storedRunFactor);
  const runFactor = available ? storedRunFactor : NEUTRAL_PARK_RUN_FACTOR;
  return {
    venue,
    runFactor,
    runValue: available ? Number(((NEUTRAL_PARK_RUN_FACTOR - runFactor) * 12).toFixed(1)) : 0,
    label: available ? parkLabel(venue, runFactor) : `${venue} park factor unavailable; using neutral run environment.`,
    available,
  };
}

export function getVenueRunFactor(venue: string) {
  return getParkContext(venue).runFactor;
}

export function validateVenueRunFactorForWrite(venue: string, runFactor: number) {
  if (!isValidParkRunFactor(runFactor)) {
    throw new Error(`${venue} park run factor ${runFactor} is outside the supported ${PARK_RUN_FACTOR_MIN.toFixed(2)}-${PARK_RUN_FACTOR_MAX.toFixed(2)} range`);
  }
  return runFactor;
}

export function isValidParkRunFactor(runFactor: number | undefined | null): runFactor is number {
  return typeof runFactor === "number" && Number.isFinite(runFactor) && runFactor >= PARK_RUN_FACTOR_MIN && runFactor <= PARK_RUN_FACTOR_MAX;
}

export async function getGameTimeWeather(venue: string, gameDate: string): Promise<DecisionWeatherContext> {
  const profile = VENUE_WEATHER_PROFILES[venue];
  if (!profile) {
    return {
      source: "unavailable",
      label: `${venue} weather profile unavailable.`,
      runValue: 0,
    };
  }

  if (!profile.outdoor) {
    return {
      source: "indoor",
      label: `${venue} is roofed or climate-controlled; weather is treated as neutral.`,
      runValue: 0,
    };
  }

  const cacheKey = `${venue}|${gameDate}`;
  const cached = weatherCache.get(cacheKey);
  if (cached) return cached;

  const request = fetchOpenMeteoWeather(profile, gameDate)
    .then((weather) => {
      if (weather.source === "unavailable") weatherCache.delete(cacheKey);
      return weather;
    })
    .catch(() => {
      weatherCache.delete(cacheKey);
      return {
        source: "unavailable" as const,
        label: `${profile.label} game-time weather unavailable; using neutral run environment.`,
        runValue: 0,
      };
    });
  weatherCache.set(cacheKey, request);
  return request;
}

export function getNeutralGameTimeWeather(venue: string): DecisionWeatherContext {
  const profile = VENUE_WEATHER_PROFILES[venue];
  const label = profile?.outdoor === false
    ? `${venue} is roofed or climate-controlled; weather is treated as neutral.`
    : `${profile?.label ?? venue} weather deferred to the data-change pipeline; using neutral run environment.`;

  return {
    source: profile?.outdoor === false ? "indoor" : "unavailable",
    label,
    runValue: 0,
  };
}

export function isRequestTimeEnvironmentEnrichmentEnabled() {
  return process.env.THE_BUMP_REQUEST_TIME_ENRICHMENT === "1";
}

async function fetchOpenMeteoWeather(profile: VenueWeatherProfile, gameDate: string): Promise<DecisionWeatherContext> {
  const date = gameDate.slice(0, 10);
  const params = new URLSearchParams({
    latitude: String(profile.latitude),
    longitude: String(profile.longitude),
    hourly: "temperature_2m,precipitation_probability,wind_speed_10m,wind_direction_10m",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: "auto",
    start_date: date,
    end_date: date,
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
    next: { revalidate: WEATHER_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(WEATHER_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    return {
      source: "unavailable",
      label: `${profile.label} game-time weather unavailable; using neutral run environment.`,
      runValue: 0,
    };
  }

  const payload = (await response.json()) as OpenMeteoResponse;
  const hourly = payload.hourly;
  const index = closestHourIndex(hourly?.time ?? [], gameDate);
  if (!hourly || index < 0) {
    return {
      source: "unavailable",
      label: `${profile.label} game-time weather unavailable; using neutral run environment.`,
      runValue: 0,
    };
  }

  const tempF = readHourly(hourly.temperature_2m, index);
  const precipProbability = readHourly(hourly.precipitation_probability, index);
  const windMph = readHourly(hourly.wind_speed_10m, index);
  const windDirectionDeg = readHourly(hourly.wind_direction_10m, index);
  const runValue = weatherRunValue(tempF, precipProbability, windMph);

  return {
    source: "open-meteo",
    tempF,
    precipProbability,
    windMph,
    windDirectionDeg,
    runValue,
    label: weatherLabel(profile.label, tempF, precipProbability, windMph),
  };
}

function closestHourIndex(times: string[], gameDate: string) {
  const target = new Date(gameDate).valueOf();
  if (!Number.isFinite(target)) return -1;
  let bestIndex = -1;
  let bestDistance = Infinity;
  times.forEach((time, index) => {
    const parsed = new Date(time).valueOf();
    if (!Number.isFinite(parsed)) return;
    const distance = Math.abs(parsed - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function readHourly(values: number[] | undefined, index: number) {
  const value = values?.[index];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function weatherRunValue(tempF: number | undefined, precipProbability: number | undefined, windMph: number | undefined) {
  let value = 0;
  if (tempF !== undefined) value += clamp(-1.5, 1.5, (tempF - 70) / 18);
  if (windMph !== undefined) value += clamp(-1, 1, (windMph - 8) / 14);
  if (precipProbability !== undefined && precipProbability >= 35) value -= 0.5;
  return Number(value.toFixed(1));
}

function parkLabel(venue: string, runFactor: number) {
  if (runFactor >= 1.06) return `${venue} is hitter-friendly (${runFactor.toFixed(2)} run factor).`;
  if (runFactor <= 0.96) return `${venue} suppresses run scoring (${runFactor.toFixed(2)} run factor).`;
  return `${venue} plays near neutral (${runFactor.toFixed(2)} run factor).`;
}

function validateVenueRunFactorTable(factors: Record<string, number>) {
  for (const [venue, runFactor] of Object.entries(factors)) {
    validateVenueRunFactorForWrite(venue, runFactor);
  }
}

const loggedInvalidParkFactors = new Set<string>();

function logInvalidParkRunFactor(venue: string, runFactor: number) {
  const key = `${venue}:${runFactor}`;
  if (loggedInvalidParkFactors.has(key)) return;
  loggedInvalidParkFactors.add(key);
  console.warn("[park-factor:invalid]", {
    venue,
    runFactor,
    min: PARK_RUN_FACTOR_MIN,
    max: PARK_RUN_FACTOR_MAX,
  });
}

function weatherLabel(location: string, tempF: number | undefined, precipProbability: number | undefined, windMph: number | undefined) {
  const parts = [];
  if (tempF !== undefined) parts.push(`${Math.round(tempF)}F`);
  if (windMph !== undefined) parts.push(`wind ${Math.round(windMph)} mph`);
  if (precipProbability !== undefined) parts.push(`${Math.round(precipProbability)}% precip`);
  return `${location} game-time weather: ${parts.length ? parts.join(", ") : "neutral forecast"}.`;
}

function clamp(min: number, max: number, value: number) {
  return Math.min(max, Math.max(min, value));
}
