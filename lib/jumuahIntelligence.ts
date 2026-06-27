import type { TravelPrayerInsight } from "@/lib/travelPrayerIntelligence";

export type JumuahInsight = {
  isFriday: boolean;
  isJumuahRelevant: boolean;
  stage: "not_friday" | "before_jumuah" | "jumuah_window" | "after_jumuah";
  title: string;
  message: string;
  mosqueBoost: number;
  businessPenalty: number;
};

function parseMinutes(value: string | null | undefined) {
  if (!value) return null;

  const [hour, minute] = value.split(":").map(Number);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  return hour * 60 + minute;
}

export function buildJumuahInsight(options: {
  now?: Date;
  dhuhrStart?: string | null;
  prayerInsight: TravelPrayerInsight;
}) {
  const now = options.now ?? new Date();
  const day = now.getDay(); // 5 = Friday
  const isFriday = day === 5;

  if (!isFriday) {
    const result: JumuahInsight = {
      isFriday: false,
      isJumuahRelevant: false,
      stage: "not_friday",
      title: "Standard travel mode",
      message:
        "It is not Friday right now, so normal prayer-aware travel ranking is being used.",
      mosqueBoost: 0,
      businessPenalty: 0,
    };
    return result;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const dhuhrMinutes = parseMinutes(options.dhuhrStart);

  // Sensible fallback if Dhuhr missing: assume 13:00 local
  const jumuahBase = dhuhrMinutes ?? 13 * 60;

  const beforeWindowStart = jumuahBase - 90;
  const activeWindowEnd = jumuahBase + 90;

  if (currentMinutes < beforeWindowStart) {
    const result: JumuahInsight = {
      isFriday: true,
      isJumuahRelevant: true,
      stage: "before_jumuah",
      title: "Friday mode active",
      message:
        "It is Friday. Jumu’ah is later today, so nearby mosques should be prioritised in your planning.",
      mosqueBoost: 16,
      businessPenalty: 2,
    };
    return result;
  }

  if (currentMinutes >= beforeWindowStart && currentMinutes <= activeWindowEnd) {
    const result: JumuahInsight = {
      isFriday: true,
      isJumuahRelevant: true,
      stage: "jumuah_window",
      title: "Jumu’ah window active",
      message:
        "It is currently within the likely Jumu’ah window. Nearby mosques are being strongly prioritised for travel guidance.",
      mosqueBoost: 40,
      businessPenalty: 10,
    };
    return result;
  }

  const result: JumuahInsight = {
    isFriday: true,
    isJumuahRelevant: true,
    stage: "after_jumuah",
    title: "Post-Jumu’ah Friday mode",
    message:
      "Jumu’ah has likely passed for today. Mosque priority is reduced, while normal essentials ranking becomes more relevant again.",
    mosqueBoost: 8,
    businessPenalty: 0,
  };
  return result;
}

