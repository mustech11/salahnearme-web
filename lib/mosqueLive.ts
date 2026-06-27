export type Report = {
  report_type: string;
  created_at: string;
};

export type LiveConfidence = "low" | "medium" | "strong";

export type LiveStatus = {
  counts: {
    iqamah: number;
    khutbah: number;
    full: number;
    correction: number;
    parking_full: number;
    jumuah_first: number;
    jumuah_second: number;
    jumuah_third: number;
  };
  confidence: LiveConfidence;
  hasLive: boolean;
};

const LIVE_WINDOW_MINUTES = 90;

export function buildLiveStatus(reports: Report[]): LiveStatus {
  const now = Date.now();

  const recent = reports.filter((r) => {
    const createdAt = new Date(r.created_at).getTime();

    if (Number.isNaN(createdAt)) return false;

    const age = now - createdAt;
    return age >= 0 && age < LIVE_WINDOW_MINUTES * 60 * 1000;
  });

  const counts: LiveStatus["counts"] = {
    iqamah: 0,
    khutbah: 0,
    full: 0,
    correction: 0,
    parking_full: 0,
    jumuah_first: 0,
    jumuah_second: 0,
    jumuah_third: 0,
  };

  for (const r of recent) {
    if (r.report_type === "iqamah_started") counts.iqamah += 1;
    if (r.report_type === "khutbah_live") counts.khutbah += 1;
    if (r.report_type === "full") counts.full += 1;
    if (r.report_type === "correction") counts.correction += 1;
    if (r.report_type === "parking_full") counts.parking_full += 1;
    if (r.report_type === "jumuah_first") counts.jumuah_first += 1;
    if (r.report_type === "jumuah_second") counts.jumuah_second += 1;
    if (r.report_type === "jumuah_third") counts.jumuah_third += 1;
  }

  let confidence: LiveConfidence = "low";
  const total = recent.length;

  if (total >= 5) confidence = "strong";
  else if (total >= 2) confidence = "medium";

  return {
    counts,
    confidence,
    hasLive: total > 0,
  };
}

