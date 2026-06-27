type Mosque = {
  id: string;
  name: string | null;
  verified_status?: string | null;
};

type Live = {
  counts: {
    iqamah: number;
    khutbah: number;
    full: number;
    correction: number;
  };
  confidence: "low" | "medium" | "strong";
};

type RankingInput = {
  mosque: Mosque;
  live?: Live;
  hasPrayerTimes?: boolean;
  hasJumuah?: boolean;
  sponsorCount?: number;
  businessCount?: number;
};

export function computeMosqueScore(input: RankingInput) {
  let score = 0;

  // 🔥 LIVE SIGNALS (highest weight)
  if (input.live) {
    score += input.live.counts.iqamah * 15;
    score += input.live.counts.khutbah * 20;
    score += input.live.counts.full * 5;

    if (input.live.confidence === "strong") score += 25;
    if (input.live.confidence === "medium") score += 10;
  }

  // ✅ TRUST SIGNALS
  if (input.mosque.verified_status === "verified") {
    score += 20;
  }

  if (input.hasPrayerTimes) score += 15;
  if (input.hasJumuah) score += 10;

  // 💰 ECONOMIC SIGNALS
  score += (input.sponsorCount ?? 0) * 10;
  score += (input.businessCount ?? 0) * 3;

  return score;
}

export function sortMosquesBySmartRanking(
  mosques: Mosque[],
  context: {
    liveMap?: Map<string, Live>;
    prayerMap?: Map<string, boolean>;
    jumuahMap?: Map<string, boolean>;
    sponsorMap?: Map<string, number>;
  }
) {
  return mosques
    .map((mosque) => {
      const score = computeMosqueScore({
        mosque,
        live: context.liveMap?.get(mosque.id),
        hasPrayerTimes: context.prayerMap?.get(mosque.id),
        hasJumuah: context.jumuahMap?.get(mosque.id),
        sponsorCount: context.sponsorMap?.get(mosque.id),
      });

      return { mosque, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.mosque);
}

