// WMO weather codes used by Open-Meteo — grouping the ones that mean "wet"
// in some form (drizzle, rain, rain showers, thunderstorms). Snow codes are
// left out of the "rain" bucket deliberately since an umbrella isn't the
// right advice for snow — Southern Africa's ride footprint makes snow rare
// enough that a dedicated message isn't worth the complexity for now.
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

export interface WeatherAdvisory {
  message: string;
  icon: "umbrella" | "coat" | "sun" | "pleasant";
}

export function getWeatherAdvisory(
  tempC: number | null,
  precipitationMm: number | null,
  weatherCode: number | null,
  destinationLabel: string
): WeatherAdvisory | null {
  const place = destinationLabel.split(",")[0]; // just the first segment, not the full address
  const isRaining = (weatherCode !== null && RAIN_CODES.has(weatherCode)) || (precipitationMm !== null && precipitationMm > 0.2);

  if (isRaining) {
    return { message: `It's raining at ${place} — you may need an umbrella.`, icon: "umbrella" };
  }
  if (tempC !== null && tempC < 15) {
    return { message: `You might need a coat — it's cold at ${place} (${Math.round(tempC)}°C).`, icon: "coat" };
  }
  if (tempC !== null && tempC > 32) {
    return { message: `It's hot at ${place} (${Math.round(tempC)}°C) — stay hydrated.`, icon: "sun" };
  }
  if (tempC !== null) {
    // Nothing notable — still worth a friendly line, both as a nice touch
    // and so "no advisory" doesn't look identical to "feature not working".
    return { message: `Pleasant at ${place} (${Math.round(tempC)}°C) — good weather for being outdoors.`, icon: "pleasant" };
  }
  return null; // only when the weather data itself wasn't available at all
}
