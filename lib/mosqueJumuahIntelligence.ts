export type MosqueJumuahRow = {
  id: string;
  name: string | null;
  slug: string | null;
  area: string | null;
  city: string | null;
  jumuah_enabled: boolean | null;
  jumuah_khutbah_1: string | null;
  jumuah_salah_1: string | null;
  jumuah_khutbah_2: string | null;
  jumuah_salah_2: string | null;
  jumuah_khutbah_3: string | null;
  jumuah_salah_3: string | null;
  jumuah_notes: string | null;
  distanceKm?: number | null;
};

export type JumuahSession = {
  label: string;
  khutbah: string | null;
  salah: string | null;
  khutbahMinutes: number | null;
  salahMinutes: number | null;
};

export type MosqueJumuahInsight = {
  isFriday: boolean;
  hasJumuah: boolean;
  stage:
    | "not_friday"
    | "no_sessions"
    | "before_first"
    | "khutbah_active"
    | "between_sessions"
    | "salah_active"
    | "finished";
  title: string;
  message: string;
  nextSessionLabel: string | null;
  nextSessionTime: string | null;
  sessionCount: number;
  scoreBoost: number;
};

function parseMinutes(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const cleaned = value.trim();

  const match = cleaned.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
}

function makeSession(
  label: string,
  khutbah: string | null,
  salah: string | null
): JumuahSession {
  return {
    label,
    khutbah,
    salah,
    khutbahMinutes: parseMinutes(khutbah),
    salahMinutes: parseMinutes(salah),
  };
}

function buildSessions(mosque: MosqueJumuahRow): JumuahSession[] {
  const sessions: JumuahSession[] = [
    makeSession("1st Jumu’ah", mosque.jumuah_khutbah_1, mosque.jumuah_salah_1),
    makeSession("2nd Jumu’ah", mosque.jumuah_khutbah_2, mosque.jumuah_salah_2),
    makeSession("3rd Jumu’ah", mosque.jumuah_khutbah_3, mosque.jumuah_salah_3),
  ];

  return sessions.filter(
    (session) =>
      session.khutbahMinutes !== null || session.salahMinutes !== null
  );
}

function getCurrentMinutes(now: Date) {
  return now.getHours() * 60 + now.getMinutes();
}

export function buildMosqueJumuahInsight(
  mosque: MosqueJumuahRow,
  now = new Date()
): MosqueJumuahInsight {
  const isFriday = now.getDay() === 5;

  if (!isFriday) {
    return {
      isFriday: false,
      hasJumuah: false,
      stage: "not_friday",
      title: "Standard mosque ranking",
      message:
        "It is not Friday, so mosque-specific Jumu’ah sessions are not being prioritised.",
      nextSessionLabel: null,
      nextSessionTime: null,
      sessionCount: 0,
      scoreBoost: 0,
    };
  }

  if (!mosque.jumuah_enabled) {
    return {
      isFriday: true,
      hasJumuah: false,
      stage: "no_sessions",
      title: "Jumu’ah not configured",
      message:
        "This mosque does not currently have mosque-specific Jumu’ah times configured.",
      nextSessionLabel: null,
      nextSessionTime: null,
      sessionCount: 0,
      scoreBoost: 0,
    };
  }

  const sessions = buildSessions(mosque);

  if (sessions.length === 0) {
    return {
      isFriday: true,
      hasJumuah: false,
      stage: "no_sessions",
      title: "No Jumu’ah sessions available",
      message:
        "This mosque has Jumu’ah enabled but no valid session times are configured yet.",
      nextSessionLabel: null,
      nextSessionTime: null,
      sessionCount: 0,
      scoreBoost: 0,
    };
  }

  const currentMinutes = getCurrentMinutes(now);

  for (let i = 0; i < sessions.length; i += 1) {
    const session = sessions[i];
    const khutbah = session.khutbahMinutes;
    const salah = session.salahMinutes;

    if (khutbah !== null && currentMinutes < khutbah) {
      return {
        isFriday: true,
        hasJumuah: true,
        stage: i === 0 ? "before_first" : "between_sessions",
        title: `${session.label} approaching`,
        message: `${session.label} at this mosque is still upcoming. This mosque should be prioritised for Jumu’ah travel guidance.`,
        nextSessionLabel: session.label,
        nextSessionTime: session.khutbah ?? session.salah,
        sessionCount: sessions.length,
        scoreBoost: 32 - i * 4,
      };
    }

    if (
      khutbah !== null &&
      salah !== null &&
      currentMinutes >= khutbah &&
      currentMinutes < salah
    ) {
      return {
        isFriday: true,
        hasJumuah: true,
        stage: "khutbah_active",
        title: `${session.label} khutbah likely active`,
        message: `This mosque is likely within the khutbah window for ${session.label}.`,
        nextSessionLabel: session.label,
        nextSessionTime: session.salah,
        sessionCount: sessions.length,
        scoreBoost: 42 - i * 4,
      };
    }

    if (
      salah !== null &&
      currentMinutes >= salah &&
      currentMinutes < salah + 20
    ) {
      const nextSession = sessions[i + 1] ?? null;

      return {
        isFriday: true,
        hasJumuah: true,
        stage: "salah_active",
        title: `${session.label} salah likely active`,
        message: `This mosque is likely within the salah window for ${session.label}.`,
        nextSessionLabel: nextSession?.label ?? null,
        nextSessionTime: nextSession
          ? nextSession.khutbah ?? nextSession.salah
          : null,
        sessionCount: sessions.length,
        scoreBoost: 36 - i * 4,
      };
    }
  }

  return {
    isFriday: true,
    hasJumuah: true,
    stage: "finished",
    title: "Jumu’ah sessions likely finished",
    message:
      "This mosque’s configured Jumu’ah sessions have likely finished for today.",
    nextSessionLabel: null,
    nextSessionTime: null,
    sessionCount: sessions.length,
    scoreBoost: 4,
  };
}

export function getMosqueJumuahSessions(mosque: MosqueJumuahRow) {
  return buildSessions(mosque).map((session) => ({
    label: session.label,
    khutbah: session.khutbah,
    salah: session.salah,
  }));
}