import {
  CalculationMethod,
  Coordinates,
  Madhab,
  PrayerTimes,
} from "adhan";

export type PrayerTimesResult = {
  fajr_start: string | null;
  sunrise: string | null;
  dhuhr_start: string | null;
  asr_start: string | null;
  maghrib_start: string | null;
  isha_start: string | null;
};

type CityPrayerInput = {
  timezone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

function formatTimeInZone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).formatToParts(date);

  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";

  return `${hour}:${minute}:00`;
}

function getDatePartsInZone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  return { year, month, day };
}

export function calculatePrayerTimesForCity(
  city: CityPrayerInput
): PrayerTimesResult | null {
  const timezone = city.timezone ?? "Europe/London";

  if (
    typeof city.latitude !== "number" ||
    typeof city.longitude !== "number"
  ) {
    return null;
  }

  const now = new Date();
  const { year, month, day } = getDatePartsInZone(now, timezone);

  const coordinates = new Coordinates(city.latitude, city.longitude);

  const params = CalculationMethod.MuslimWorldLeague();
  params.madhab = Madhab.Hanafi;

  const prayerTimes = new PrayerTimes(
    coordinates,
    new Date(Date.UTC(year, month - 1, day)),
    params
  );

  return {
    fajr_start: formatTimeInZone(prayerTimes.fajr, timezone),
    sunrise: formatTimeInZone(prayerTimes.sunrise, timezone),
    dhuhr_start: formatTimeInZone(prayerTimes.dhuhr, timezone),
    asr_start: formatTimeInZone(prayerTimes.asr, timezone),
    maghrib_start: formatTimeInZone(prayerTimes.maghrib, timezone),
    isha_start: formatTimeInZone(prayerTimes.isha, timezone),
  };
}

