export type CityPrayerTimes = {
  fajr: string | null;
  sunrise: string | null;
  dhuhr: string | null;
  asr: string | null;
  maghrib: string | null;
  isha: string | null;
  source: "database" | "calculated" | "unavailable";
};

type Coordinates = {
  latitude: number | null;
  longitude: number | null;
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function normalizeHour(value: number) {
  let hour = value % 24;

  if (hour < 0) {
    hour += 24;
  }

  return hour;
}

function formatTime(decimalHour: number) {
  const normalized = normalizeHour(decimalHour);
  const hours = Math.floor(normalized);
  const minutes = Math.round((normalized - hours) * 60);

  const finalHours = minutes === 60 ? (hours + 1) % 24 : hours;
  const finalMinutes = minutes === 60 ? 0 : minutes;

  return `${String(finalHours).padStart(2, "0")}:${String(finalMinutes).padStart(
    2,
    "0"
  )}`;
}

function getDayOfYear(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  const diff = date.getTime() - start.getTime();

  return Math.floor(diff / 86400000);
}

function getSolarDeclination(dayOfYear: number) {
  return 23.45 * Math.sin(toRadians((360 / 365) * (284 + dayOfYear)));
}

function getEquationOfTime(dayOfYear: number) {
  const b = toRadians((360 / 365) * (dayOfYear - 81));

  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

function getHourAngle(latitude: number, declination: number, angle: number) {
  const latRad = toRadians(latitude);
  const decRad = toRadians(declination);
  const angleRad = toRadians(angle);

  const cosHourAngle =
    (Math.sin(angleRad) - Math.sin(latRad) * Math.sin(decRad)) /
    (Math.cos(latRad) * Math.cos(decRad));

  if (cosHourAngle < -1 || cosHourAngle > 1) {
    return null;
  }

  return toDegrees(Math.acos(cosHourAngle)) / 15;
}

function getUkOffsetHours(date: Date) {
  const year = date.getUTCFullYear();

  function lastSunday(month: number) {
    const d = new Date(Date.UTC(year, month + 1, 0));
    const day = d.getUTCDay();

    d.setUTCDate(d.getUTCDate() - day);

    return d;
  }

  const bstStart = lastSunday(2);
  const bstEnd = lastSunday(9);

  bstStart.setUTCHours(1, 0, 0, 0);
  bstEnd.setUTCHours(1, 0, 0, 0);

  return date >= bstStart && date < bstEnd ? 1 : 0;
}

export function calculateCityPrayerTimes(
  coordinates: Coordinates,
  date = new Date()
): CityPrayerTimes {
  const latitude = coordinates.latitude;
  const longitude = coordinates.longitude;

  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude)
  ) {
    return {
      fajr: null,
      sunrise: null,
      dhuhr: null,
      asr: null,
      maghrib: null,
      isha: null,
      source: "unavailable",
    };
  }

  const dayOfYear = getDayOfYear(date);
  const declination = getSolarDeclination(dayOfYear);
  const equationOfTime = getEquationOfTime(dayOfYear);
  const timezoneOffset = getUkOffsetHours(date);

  const solarNoon =
    12 + timezoneOffset - longitude / 15 - equationOfTime / 60;

  const sunriseAngle = -0.833;
  const fajrAngle = -15;
  const ishaAngle = -15;

  const sunriseHourAngle = getHourAngle(latitude, declination, sunriseAngle);
  const fajrHourAngle = getHourAngle(latitude, declination, fajrAngle);
  const ishaHourAngle = getHourAngle(latitude, declination, ishaAngle);

  if (!sunriseHourAngle) {
    return {
      fajr: null,
      sunrise: null,
      dhuhr: formatTime(solarNoon),
      asr: null,
      maghrib: null,
      isha: null,
      source: "calculated",
    };
  }

  const sunrise = solarNoon - sunriseHourAngle;
  const maghrib = solarNoon + sunriseHourAngle;

  const fajr = fajrHourAngle ? solarNoon - fajrHourAngle : sunrise - 1.5;
  const isha = ishaHourAngle ? solarNoon + ishaHourAngle : maghrib + 1.5;

  return {
    fajr: formatTime(fajr),
    sunrise: formatTime(sunrise),
    dhuhr: formatTime(solarNoon),
    asr: formatTime(solarNoon + (maghrib - solarNoon) * 0.62),
    maghrib: formatTime(maghrib),
    isha: formatTime(isha),
    source: "calculated",
  };
}

export function normalisePrayerTime(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 5);
}