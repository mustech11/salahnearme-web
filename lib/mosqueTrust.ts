export type LiveReportRow = {
  mosque_id: string;
  report_type: string;
  created_at: string;
  user_fingerprint?: string | null;
};

export type MosqueLiveTrust = {
  counts: {
    iqamah: number;
    khutbah: number;
    full: number;
    correction: number;
    parking_full: number;
    jumuah_second: number;
  };
  totalRecent: number;
  uniqueReporters: number;
  confidence: "low" | "medium" | "strong";
  trustScore: number;
  hasLive: boolean;
};

function recentWithinMinutes(createdAt: string, minutes: number) {
  const diff = Date.now() - new Date(createdAt).getTime();
  return diff >= 0 && diff <= minutes * 60 * 1000;
}

export function buildMosqueLiveTrust(reports: LiveReportRow[]): MosqueLiveTrust {
  const recent = reports.filter((r) => recentWithinMinutes(r.created_at, 90));

  const uniqueReporterSet = new Set(
    recent.map((r) => (typeof r.user_fingerprint === "string" ? r.user_fingerprint : null)).filter(Boolean)
  );

  const counts = {
    iqamah: 0,
    khutbah: 0,
    full: 0,
    correction: 0,
    parking_full: 0,
    jumuah_second: 0,
  };

  for (const r of recent) {
    if (r.report_type === "iqamah_started") counts.iqamah++;
    if (r.report_type === "khutbah_live") counts.khutbah++;
    if (r.report_type === "full") counts.full++;
    if (r.report_type === "correction") counts.correction++;
    if (r.report_type === "parking_full") counts.parking_full++;
    if (r.report_type === "jumuah_second") counts.jumuah_second++;
  }

  const totalRecent = recent.length;
  const uniqueReporters = uniqueReporterSet.size;

  let confidence: "low" | "medium" | "strong" = "low";

  if (uniqueReporters >= 3 || totalRecent >= 5) {
    confidence = "strong";
  } else if (uniqueReporters >= 2 || totalRecent >= 2) {
    confidence = "medium";
  }

  let trustScore = 0;

  trustScore += counts.iqamah * 12;
  trustScore += counts.khutbah * 15;
  trustScore += counts.full * 4;
  trustScore += counts.parking_full * 3;
  trustScore += counts.jumuah_second * 8;
  trustScore -= counts.correction * 6;

  trustScore += uniqueReporters * 8;

  if (confidence === "medium") trustScore += 10;
  if (confidence === "strong") trustScore += 22;

  if (trustScore < 0) trustScore = 0;

  return {
    counts,
    totalRecent,
    uniqueReporters,
    confidence,
    trustScore,
    hasLive: totalRecent > 0,
  };
}

