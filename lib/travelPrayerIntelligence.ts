export type TravelPrayerTimes = {
  fajr_start: string | null;
  sunrise: string | null;
  dhuhr_start: string | null;
  asr_start: string | null;
  maghrib_start: string | null;
  isha_start: string | null;
};

export type PrayerKey =
  | "fajr"
  | "sunrise"
  | "dhuhr"
  | "asr"
  | "maghrib"
  | "isha";

export type TravelPrayerInsight = {
  currentPrayer: PrayerKey | null;
  nextPrayer: PrayerKey | null;
  nextPrayerTime: string | null;
  message: string;
  context:
    | "before_fajr"
    | "fajr_window"
    | "after_sunrise"
    | "dhuhr_window"
    | "asr_window"
    | "maghrib_window"
    | "isha_window"
    | "late_night"
    | "unknown";
  isFriday: boolean;
  isJumuahWindow: boolean;
  jumuahPhase: "none" | "planning" | "active" | "ending";
  jumuahMessage: string | null;
};

function parseMinutes(value: string | null | undefined) {
  if (!value) return null;

  const [hour, minute] = value.split(":").map(Number);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  return hour * 60 + minute;
}

export function formatPrayerKey(prayer: PrayerKey | null) {
  switch (prayer) {
    case "fajr":
      return "Fajr";
    case "sunrise":
      return "Sunrise";
    case "dhuhr":
      return "Dhuhr";
    case "asr":
      return "Asr";
    case "maghrib":
      return "Maghrib";
    case "isha":
      return "Isha";
    default:
      return "—";
  }
}

function buildJumuahState(
  now: Date,
  prayerTimes: TravelPrayerTimes | null
): Pick<
  TravelPrayerInsight,
  "isFriday" | "isJumuahWindow" | "jumuahPhase" | "jumuahMessage"
> {
  const isFriday = now.getDay() === 5;

  if (!isFriday || !prayerTimes) {
    return {
      isFriday,
      isJumuahWindow: false,
      jumuahPhase: "none",
      jumuahMessage: null,
    };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const dhuhr = parseMinutes(prayerTimes.dhuhr_start);

  if (dhuhr === null) {
    return {
      isFriday,
      isJumuahWindow: false,
      jumuahPhase: "none",
      jumuahMessage: "It is Friday, but Jumu’ah timing is not available for this city yet.",
    };
  }

  const planningStart = Math.max(0, dhuhr - 90);
  const activeStart = Math.max(0, dhuhr - 15);
  const activeEnd = dhuhr + 45;
  const endingEnd = dhuhr + 90;

  if (currentMinutes >= planningStart && currentMinutes < activeStart) {
    return {
      isFriday,
      isJumuahWindow: true,
      jumuahPhase: "planning",
      jumuahMessage:
        "It is Friday and Jumu’ah is approaching. Nearby mosques should be prioritised now.",
    };
  }

  if (currentMinutes >= activeStart && currentMinutes <= activeEnd) {
    return {
      isFriday,
      isJumuahWindow: true,
      jumuahPhase: "active",
      jumuahMessage:
        "It is currently within the main Jumu’ah window. Nearby mosques are the highest priority.",
    };
  }

  if (currentMinutes > activeEnd && currentMinutes <= endingEnd) {
    return {
      isFriday,
      isJumuahWindow: true,
      jumuahPhase: "ending",
      jumuahMessage:
        "Jumu’ah time is likely concluding. Check nearby mosques first, then nearby essentials.",
    };
  }

  return {
    isFriday,
    isJumuahWindow: false,
    jumuahPhase: "none",
    jumuahMessage: "It is Friday. Plan ahead for Jumu’ah in this city.",
  };
}

export function buildTravelPrayerInsight(
  prayerTimes: TravelPrayerTimes | null,
  now = new Date()
): TravelPrayerInsight {
  const jumuah = buildJumuahState(now, prayerTimes);

  if (!prayerTimes) {
    return {
      currentPrayer: null,
      nextPrayer: null,
      nextPrayerTime: null,
      message: "Prayer times are not available for this city yet.",
      context: "unknown",
      ...jumuah,
    };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const fajr = parseMinutes(prayerTimes.fajr_start);
  const sunrise = parseMinutes(prayerTimes.sunrise);
  const dhuhr = parseMinutes(prayerTimes.dhuhr_start);
  const asr = parseMinutes(prayerTimes.asr_start);
  const maghrib = parseMinutes(prayerTimes.maghrib_start);
  const isha = parseMinutes(prayerTimes.isha_start);

  let currentPrayer: PrayerKey | null = null;
  let nextPrayer: PrayerKey | null = null;
  let nextPrayerTime: string | null = null;
  let context: TravelPrayerInsight["context"] = "unknown";

  if (fajr !== null && currentMinutes < fajr) {
    context = "before_fajr";
    nextPrayer = "fajr";
    nextPrayerTime = prayerTimes.fajr_start;
  } else if (
    fajr !== null &&
    sunrise !== null &&
    currentMinutes >= fajr &&
    currentMinutes < sunrise
  ) {
    currentPrayer = "fajr";
    context = "fajr_window";
    nextPrayer = "sunrise";
    nextPrayerTime = prayerTimes.sunrise;
  } else if (
    sunrise !== null &&
    dhuhr !== null &&
    currentMinutes >= sunrise &&
    currentMinutes < dhuhr
  ) {
    context = "after_sunrise";
    nextPrayer = "dhuhr";
    nextPrayerTime = prayerTimes.dhuhr_start;
  } else if (
    dhuhr !== null &&
    asr !== null &&
    currentMinutes >= dhuhr &&
    currentMinutes < asr
  ) {
    currentPrayer = "dhuhr";
    context = "dhuhr_window";
    nextPrayer = "asr";
    nextPrayerTime = prayerTimes.asr_start;
  } else if (
    asr !== null &&
    maghrib !== null &&
    currentMinutes >= asr &&
    currentMinutes < maghrib
  ) {
    currentPrayer = "asr";
    context = "asr_window";
    nextPrayer = "maghrib";
    nextPrayerTime = prayerTimes.maghrib_start;
  } else if (
    maghrib !== null &&
    isha !== null &&
    currentMinutes >= maghrib &&
    currentMinutes < isha
  ) {
    currentPrayer = "maghrib";
    context = "maghrib_window";
    nextPrayer = "isha";
    nextPrayerTime = prayerTimes.isha_start;
  } else if (isha !== null && currentMinutes >= isha) {
    currentPrayer = "isha";
    context = "isha_window";
    nextPrayer = "fajr";
    nextPrayerTime = prayerTimes.fajr_start;
  } else {
    context = "late_night";
    nextPrayer = "fajr";
    nextPrayerTime = prayerTimes.fajr_start;
  }

  let message =
    "Use nearby mosques and halal essentials to support your prayer routine while travelling.";

  switch (context) {
    case "before_fajr":
      message = `Fajr is the next prayer at ${nextPrayerTime ?? "—"}. Nearby mosques may be especially useful now.`;
      break;
    case "fajr_window":
      message = `It is currently around Fajr time. Sunrise is next at ${nextPrayerTime ?? "—"}.`;
      break;
    case "after_sunrise":
      message = `Dhuhr is the next prayer at ${nextPrayerTime ?? "—"}. Use this time to plan your mosque and halal essentials.`;
      break;
    case "dhuhr_window":
      message = `It is currently around Dhuhr time. Asr is next at ${nextPrayerTime ?? "—"}.`;
      break;
    case "asr_window":
      message = `It is currently around Asr time. Maghrib is next at ${nextPrayerTime ?? "—"}.`;
      break;
    case "maghrib_window":
      message = `It is currently around Maghrib time. Isha is next at ${nextPrayerTime ?? "—"}.`;
      break;
    case "isha_window":
      message = `It is currently around Isha time. The next prayer will be Fajr at ${nextPrayerTime ?? "—"}.`;
      break;
    case "late_night":
      message = `The next prayer is Fajr at ${nextPrayerTime ?? "—"}.`;
      break;
    default:
      break;
  }

  if (jumuah.isFriday && jumuah.jumuahMessage) {
    message = `${message} ${jumuah.jumuahMessage}`;
  }

  return {
    currentPrayer,
    nextPrayer,
    nextPrayerTime,
    message,
    context,
    ...jumuah,
  };
}

export function getPrayerPriorityTag(
  currentPrayer: PrayerKey | null,
  isJumuahWindow = false
) {
  if (isJumuahWindow) {
    return "Jumu’ah priority";
  }

  switch (currentPrayer) {
    case "fajr":
      return "Fajr window";
    case "dhuhr":
      return "Dhuhr window";
    case "asr":
      return "Asr window";
    case "maghrib":
      return "Maghrib window";
    case "isha":
      return "Isha window";
    default:
      return "Prayer planning";
  }
}

