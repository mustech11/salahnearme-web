export type MosqueLiveReportType =
  | "iqamah"
  | "iqamah_started"
  | "started"
  | "khutbah"
  | "khutbah_live"
  | "full"
  | "correction"
  | "parking_full"
  | "jumuah_first"
  | "jumuah_second"
  | "jumuah_third"
  | "delayed";

export type LiveReportRow = {
  mosque_id: string;
  report_type: string;
  created_at: string;
  user_fingerprint?: string | null;
};

export type LiveConfidence =
  | "none"
  | "low"
  | "medium"
  | "strong";

export type MosqueLiveDominantStatus =
  | "iqamah"
  | "khutbah"
  | "full"
  | "parking_full"
  | "correction"
  | "delayed"
  | "jumuah"
  | "none";

export type MosqueLiveCounts = {
  iqamah: number;
  khutbah: number;
  full: number;
  correction: number;
  parking_full: number;
  delayed: number;
  jumuah_first: number;
  jumuah_second: number;
  jumuah_third: number;
};

export type MosqueLiveTrust = {
  counts: MosqueLiveCounts;
  totalRecent: number;
  uniqueReporters: number;
  confidence: LiveConfidence;
  trustScore: number;
  hasLive: boolean;
  dominantStatus: MosqueLiveDominantStatus;
  latestReportAt: string | null;
  latestReportMinutesAgo: number | null;
};

type NormalisedLiveReport = {
  mosque_id: string;
  report_type: MosqueLiveReportType;
  created_at: string;
  createdAtTime: number;
  user_fingerprint: string | null;
};

type BuildMosqueLiveTrustOptions = {
  liveWindowMinutes?: number;
  now?: Date | number;
};

export const MOSQUE_LIVE_WINDOW_MINUTES = 90;

const REPORT_TYPE_ALIASES: Readonly<
  Record<string, MosqueLiveReportType>
> = {
  iqamah: "iqamah",
  iqamah_started: "iqamah_started",
  started: "started",

  khutbah: "khutbah",
  khutbah_live: "khutbah_live",

  full: "full",
  mosque_full: "full",

  correction: "correction",
  timetable_correction: "correction",

  parking_full: "parking_full",
  car_park_full: "parking_full",

  delayed: "delayed",
  iqamah_delayed: "delayed",

  jumuah_first: "jumuah_first",
  jummah_first: "jumuah_first",

  jumuah_second: "jumuah_second",
  jummah_second: "jumuah_second",

  jumuah_third: "jumuah_third",
  jummah_third: "jumuah_third",
};

function cleanText(
  value: string | null | undefined
): string {
  return String(value ?? "").trim();
}

function getNowTime(
  value: Date | number | undefined
): number {
  if (value instanceof Date) {
    const time = value.getTime();

    return Number.isFinite(time)
      ? time
      : Date.now();
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  return Date.now();
}

function getReportTime(
  createdAt: string | null | undefined
): number | null {
  const cleaned = cleanText(createdAt);

  if (!cleaned) {
    return null;
  }

  const time = new Date(cleaned).getTime();

  return Number.isFinite(time)
    ? time
    : null;
}

function normaliseReportType(
  value: string | null | undefined
): MosqueLiveReportType | null {
  const cleaned = cleanText(value)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (!cleaned) {
    return null;
  }

  return REPORT_TYPE_ALIASES[cleaned] ?? null;
}

function normaliseReporter(
  value: string | null | undefined
): string | null {
  const cleaned = cleanText(value);

  return cleaned || null;
}

function normaliseReport(
  report: LiveReportRow
): NormalisedLiveReport | null {
  const mosqueId = cleanText(
    report.mosque_id
  );

  const reportType =
    normaliseReportType(
      report.report_type
    );

  const createdAt = cleanText(
    report.created_at
  );

  const createdAtTime =
    getReportTime(createdAt);

  if (
    !mosqueId ||
    !reportType ||
    !createdAt ||
    createdAtTime === null
  ) {
    return null;
  }

  return {
    mosque_id: mosqueId,
    report_type: reportType,
    created_at: createdAt,
    createdAtTime,
    user_fingerprint:
      normaliseReporter(
        report.user_fingerprint
      ),
  };
}

function isWithinLiveWindow(
  reportTime: number,
  nowTime: number,
  minutes: number
): boolean {
  const safeMinutes = Math.max(
    1,
    Math.floor(minutes)
  );

  const difference =
    nowTime - reportTime;

  return (
    difference >= 0 &&
    difference <=
      safeMinutes * 60 * 1000
  );
}

function createEmptyCounts(): MosqueLiveCounts {
  return {
    iqamah: 0,
    khutbah: 0,
    full: 0,
    correction: 0,
    parking_full: 0,
    delayed: 0,
    jumuah_first: 0,
    jumuah_second: 0,
    jumuah_third: 0,
  };
}

function getConfidence(
  totalRecent: number,
  uniqueReporters: number
): LiveConfidence {
  if (totalRecent <= 0) {
    return "none";
  }

  if (
    uniqueReporters >= 3 ||
    totalRecent >= 5
  ) {
    return "strong";
  }

  if (
    uniqueReporters >= 2 ||
    totalRecent >= 2
  ) {
    return "medium";
  }

  return "low";
}

function getDominantStatus(
  counts: MosqueLiveCounts
): MosqueLiveDominantStatus {
  const jumuahTotal =
    counts.jumuah_first +
    counts.jumuah_second +
    counts.jumuah_third;

  const rankedStatuses: Array<{
    status: MosqueLiveDominantStatus;
    count: number;
    priority: number;
  }> = [
    {
      status: "khutbah",
      count: counts.khutbah,
      priority: 8,
    },
    {
      status: "iqamah",
      count: counts.iqamah,
      priority: 7,
    },
    {
      status: "full",
      count: counts.full,
      priority: 6,
    },
    {
      status: "parking_full",
      count: counts.parking_full,
      priority: 5,
    },
    {
      status: "delayed",
      count: counts.delayed,
      priority: 4,
    },
    {
      status: "jumuah",
      count: jumuahTotal,
      priority: 3,
    },
    {
      status: "correction",
      count: counts.correction,
      priority: 2,
    },
  ];

  rankedStatuses.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }

    return b.priority - a.priority;
  });

  const topStatus =
    rankedStatuses[0];

  if (
    !topStatus ||
    topStatus.count <= 0
  ) {
    return "none";
  }

  return topStatus.status;
}

function calculateTrustScore(
  counts: MosqueLiveCounts,
  uniqueReporters: number,
  confidence: LiveConfidence
): number {
  let score = 0;

  score += counts.iqamah * 12;
  score += counts.khutbah * 15;

  /*
   * Full and parking reports are useful
   * live signals, but they should not
   * outweigh confirmed prayer activity.
   */
  score += counts.full * 4;
  score += counts.parking_full * 3;
  score += counts.delayed * 2;

  score += counts.jumuah_first * 6;
  score += counts.jumuah_second * 8;
  score += counts.jumuah_third * 8;

  /*
   * Corrections indicate useful activity,
   * but also reduce the current data-trust
   * score until reviewed.
   */
  score -= counts.correction * 6;

  score += uniqueReporters * 8;

  if (confidence === "medium") {
    score += 10;
  }

  if (confidence === "strong") {
    score += 22;
  }

  return Math.max(
    0,
    Math.round(score)
  );
}

function getMinutesAgo(
  reportTime: number | null,
  nowTime: number
): number | null {
  if (reportTime === null) {
    return null;
  }

  const difference =
    nowTime - reportTime;

  if (difference < 0) {
    return null;
  }

  return Math.floor(
    difference / 60000
  );
}

export function buildMosqueLiveTrust(
  reports: LiveReportRow[],
  options: BuildMosqueLiveTrustOptions = {}
): MosqueLiveTrust {
  const nowTime = getNowTime(
    options.now
  );

  const liveWindowMinutes =
    typeof options.liveWindowMinutes ===
      "number" &&
    Number.isFinite(
      options.liveWindowMinutes
    )
      ? Math.max(
          1,
          Math.floor(
            options.liveWindowMinutes
          )
        )
      : MOSQUE_LIVE_WINDOW_MINUTES;

  const recentReports = reports
    .map(normaliseReport)
    .filter(
      (
        report
      ): report is NormalisedLiveReport =>
        report !== null
    )
    .filter((report) =>
      isWithinLiveWindow(
        report.createdAtTime,
        nowTime,
        liveWindowMinutes
      )
    )
    .sort(
      (a, b) =>
        b.createdAtTime -
        a.createdAtTime
    );

  const uniqueReporterSet =
    new Set<string>();

  const counts =
    createEmptyCounts();

  for (const report of recentReports) {
    if (report.user_fingerprint) {
      uniqueReporterSet.add(
        report.user_fingerprint
      );
    }

    switch (report.report_type) {
      case "iqamah":
      case "iqamah_started":
      case "started":
        counts.iqamah += 1;
        break;

      case "khutbah":
      case "khutbah_live":
        counts.khutbah += 1;
        break;

      case "full":
        counts.full += 1;
        break;

      case "correction":
        counts.correction += 1;
        break;

      case "parking_full":
        counts.parking_full += 1;
        break;

      case "delayed":
        counts.delayed += 1;
        break;

      case "jumuah_first":
        counts.jumuah_first += 1;
        break;

      case "jumuah_second":
        counts.jumuah_second += 1;
        break;

      case "jumuah_third":
        counts.jumuah_third += 1;
        break;

      default: {
        const exhaustiveCheck: never =
          report.report_type;

        return exhaustiveCheck;
      }
    }
  }

  const totalRecent =
    recentReports.length;

  const uniqueReporters =
    uniqueReporterSet.size;

  const confidence =
    getConfidence(
      totalRecent,
      uniqueReporters
    );

  const trustScore =
    calculateTrustScore(
      counts,
      uniqueReporters,
      confidence
    );

  const latestReport =
    recentReports[0] ?? null;

  const latestReportAt =
    latestReport?.created_at ?? null;

  const latestReportMinutesAgo =
    getMinutesAgo(
      latestReport?.createdAtTime ??
        null,
      nowTime
    );

  return {
    counts,
    totalRecent,
    uniqueReporters,
    confidence,
    trustScore,
    hasLive: totalRecent > 0,
    dominantStatus:
      getDominantStatus(counts),
    latestReportAt,
    latestReportMinutesAgo,
  };
}

export function formatLiveStatusLabel(
  status: MosqueLiveDominantStatus
): string {
  const labels: Record<
    MosqueLiveDominantStatus,
    string
  > = {
    iqamah: "Iqamah started",
    khutbah: "Khutbah live",
    full: "Mosque reported full",
    parking_full:
      "Parking reported full",
    correction:
      "Timetable correction reported",
    delayed: "Iqamah delayed",
    jumuah: "Jumu’ah update",
    none: "No recent activity",
  };

  return labels[status];
}

export function formatLiveConfidenceLabel(
  confidence: LiveConfidence
): string {
  const labels: Record<
    LiveConfidence,
    string
  > = {
    none: "No confidence",
    low: "Low confidence",
    medium: "Medium confidence",
    strong: "Strong confidence",
  };

  return labels[confidence];
}

export function formatLiveFreshnessLabel(
  minutesAgo: number | null
): string | null {
  if (minutesAgo === null) {
    return null;
  }

  if (minutesAgo <= 0) {
    return "Updated just now";
  }

  if (minutesAgo === 1) {
    return "Updated 1 minute ago";
  }

  return `Updated ${minutesAgo} minutes ago`;
}