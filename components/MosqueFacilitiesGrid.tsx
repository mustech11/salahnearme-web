import type { ReactNode } from "react";

type Props = {
  womens_space?: boolean | null;
  parking?: boolean | null;
  wheelchair_access?: boolean | null;
  children_classes?: boolean | null;
  nikah_service?: boolean | null;
  janazah_service?: boolean | null;
  wudu_facilities?: boolean | null;
  sisters_entrance?: boolean | null;
  imam_name?: string | null;
  languages?: string[] | null;
  facilities_notes?: string | null;
};

type FacilityStatus =
  | "available"
  | "unavailable"
  | "unknown";

type FacilityCategory =
  | "prayer"
  | "accessibility"
  | "community"
  | "services";

type FacilityItem = {
  key: string;
  label: string;
  description: string;
  status: FacilityStatus;
  category: FacilityCategory;
  icon: ReactNode;
};

type StatusSummary = {
  available: number;
  unavailable: number;
  unknown: number;
  total: number;
  confirmed: number;
  completeness: number;
};

const MAX_DISPLAY_LANGUAGES = 12;
const MAX_LANGUAGE_LENGTH = 80;
const MAX_IMAM_NAME_LENGTH = 160;
const MAX_NOTES_LENGTH = 2_500;

function cleanText(
  value: string | null | undefined,
  maxLength = 500
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, maxLength);

  return cleaned || null;
}

function getFacilityStatus(
  value: boolean | null | undefined
): FacilityStatus {
  if (value === true) {
    return "available";
  }

  if (value === false) {
    return "unavailable";
  }

  return "unknown";
}

function getStatusLabel(
  status: FacilityStatus
): string {
  if (status === "available") {
    return "Available";
  }

  if (status === "unavailable") {
    return "Not available";
  }

  return "Not confirmed";
}

function getStatusDescription(
  status: FacilityStatus
): string {
  if (status === "available") {
    return "This facility has been confirmed.";
  }

  if (status === "unavailable") {
    return "This facility is currently recorded as unavailable.";
  }

  return "Information for this facility has not yet been confirmed.";
}

function getStatusClasses(
  status: FacilityStatus
): string {
  if (status === "available") {
    return [
      "border-emerald-500/30",
      "bg-emerald-500/10",
      "text-emerald-200",
    ].join(" ");
  }

  if (status === "unavailable") {
    return [
      "border-red-500/25",
      "bg-red-500/10",
      "text-red-200",
    ].join(" ");
  }

  return [
    "border-white/10",
    "bg-white/[0.04]",
    "text-white/55",
  ].join(" ");
}

function getStatusIcon(
  status: FacilityStatus
): ReactNode {
  if (status === "available") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  if (status === "unavailable") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.7 9a2.5 2.5 0 0 1 4.8 1c0 1.7-2.5 2-2.5 3.7" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function normaliseLanguages(
  languages: string[] | null | undefined
): string[] {
  if (!Array.isArray(languages)) {
    return [];
  }

  const unique = new Map<string, string>();

  for (const language of languages) {
    const cleaned = cleanText(
      language,
      MAX_LANGUAGE_LENGTH
    );

    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLocaleLowerCase(
      "en-GB"
    );

    if (!unique.has(key)) {
      unique.set(key, cleaned);
    }
  }

  return Array.from(unique.values())
    .sort((first, second) =>
      first.localeCompare(
        second,
        "en-GB",
        {
          sensitivity: "base",
        }
      )
    )
    .slice(0, MAX_DISPLAY_LANGUAGES);
}

function buildFacility({
  key,
  label,
  description,
  value,
  category,
  icon,
}: {
  key: string;
  label: string;
  description: string;
  value: boolean | null | undefined;
  category: FacilityCategory;
  icon: ReactNode;
}): FacilityItem {
  return {
    key,
    label,
    description,
    status: getFacilityStatus(value),
    category,
    icon,
  };
}

function getStatusSummary(
  items: FacilityItem[]
): StatusSummary {
  const available = items.filter(
    (item) =>
      item.status === "available"
  ).length;

  const unavailable = items.filter(
    (item) =>
      item.status === "unavailable"
  ).length;

  const unknown = items.filter(
    (item) =>
      item.status === "unknown"
  ).length;

  const total = items.length;
  const confirmed =
    available + unavailable;

  const completeness =
    total > 0
      ? Math.round(
          (confirmed / total) * 100
        )
      : 0;

  return {
    available,
    unavailable,
    unknown,
    total,
    confirmed,
    completeness,
  };
}

function getCompletenessLabel(
  completeness: number
): string {
  if (completeness >= 90) {
    return "Highly complete";
  }

  if (completeness >= 65) {
    return "Mostly complete";
  }

  if (completeness >= 35) {
    return "Partially complete";
  }

  return "Limited information";
}

function getCompletenessClasses(
  completeness: number
): string {
  if (completeness >= 65) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
  }

  if (completeness >= 35) {
    return "border-yellow-500/25 bg-yellow-500/10 text-yellow-200";
  }

  return "border-white/10 bg-white/[0.04] text-white/55";
}

function getCategoryLabel(
  category: FacilityCategory
): string {
  if (category === "prayer") {
    return "Prayer facilities";
  }

  if (category === "accessibility") {
    return "Access";
  }

  if (category === "community") {
    return "Community";
  }

  return "Services";
}

function FacilityIcon({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.08] text-yellow-300"
    >
      {children}
    </span>
  );
}

function WomenIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <circle cx="12" cy="6" r="3" />
      <path d="M8 21l1.5-8h5L16 21" />
      <path d="M9 15h6" />
    </svg>
  );
}

function ParkingIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <rect
        x="4"
        y="3"
        width="16"
        height="18"
        rx="3"
      />
      <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
    </svg>
  );
}

function AccessibilityIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <circle cx="12" cy="4" r="2" />
      <path d="M8 8h8" />
      <path d="m12 6-1 7 4 3" />
      <path d="m11 13-4 5" />
      <path d="M15 20a5 5 0 1 0-7-7" />
    </svg>
  );
}

function ChildrenIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <circle cx="8" cy="7" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 21v-3a5 5 0 0 1 10 0v3" />
      <path d="M14 21v-2a4 4 0 0 1 7-2.6V21" />
    </svg>
  );
}

function NikahIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M12 21s-7-4.4-9-9a5 5 0 0 1 9-4 5 5 0 0 1 9 4c-2 4.6-9 9-9 9Z" />
    </svg>
  );
}

function JanazahIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M4 20h16" />
      <path d="M6 20v-8h12v8" />
      <path d="M8 12V8h8v4" />
      <path d="M12 4v4" />
    </svg>
  );
}

function WuduIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M12 3s5 5.3 5 10a5 5 0 0 1-10 0c0-4.7 5-10 5-10Z" />
      <path d="M9.5 14.5a3 3 0 0 0 4.5 1.8" />
    </svg>
  );
}

function EntranceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M4 21h16" />
      <path d="M7 21V4h10v17" />
      <path d="M12 12h.01" />
      <path d="m3 9 3-3" />
      <path d="m3 9 3 3" />
    </svg>
  );
}

export default function MosqueFacilitiesGrid({
  womens_space,
  parking,
  wheelchair_access,
  children_classes,
  nikah_service,
  janazah_service,
  wudu_facilities,
  sisters_entrance,
  imam_name,
  languages,
  facilities_notes,
}: Props) {
  const cleanImamName = cleanText(
    imam_name,
    MAX_IMAM_NAME_LENGTH
  );

  const cleanNotes = cleanText(
    facilities_notes,
    MAX_NOTES_LENGTH
  );

  const cleanLanguages =
    normaliseLanguages(languages);

  const items: FacilityItem[] = [
    buildFacility({
      key: "womens-space",
      label: "Women’s prayer space",
      description:
        "A dedicated prayer space for women.",
      value: womens_space,
      category: "prayer",
      icon: <WomenIcon />,
    }),

    buildFacility({
      key: "sisters-entrance",
      label: "Sisters’ entrance",
      description:
        "A separate or clearly identified entrance for sisters.",
      value: sisters_entrance,
      category: "accessibility",
      icon: <EntranceIcon />,
    }),

    buildFacility({
      key: "wudu",
      label: "Wudu facilities",
      description:
        "On-site facilities for performing wudu.",
      value: wudu_facilities,
      category: "prayer",
      icon: <WuduIcon />,
    }),

    buildFacility({
      key: "parking",
      label: "Parking",
      description:
        "Parking is recorded as available at or near the mosque.",
      value: parking,
      category: "accessibility",
      icon: <ParkingIcon />,
    }),

    buildFacility({
      key: "wheelchair-access",
      label: "Wheelchair access",
      description:
        "Step-free or wheelchair-accessible entry is recorded.",
      value: wheelchair_access,
      category: "accessibility",
      icon: <AccessibilityIcon />,
    }),

    buildFacility({
      key: "children-classes",
      label: "Children’s classes",
      description:
        "Islamic learning or Qur’an classes for children.",
      value: children_classes,
      category: "community",
      icon: <ChildrenIcon />,
    }),

    buildFacility({
      key: "nikah-service",
      label: "Nikah service",
      description:
        "Nikah or Islamic marriage services are provided.",
      value: nikah_service,
      category: "services",
      icon: <NikahIcon />,
    }),

    buildFacility({
      key: "janazah-service",
      label: "Janazah service",
      description:
        "Janazah support or funeral prayer services are provided.",
      value: janazah_service,
      category: "services",
      icon: <JanazahIcon />,
    }),
  ];

  const summary =
    getStatusSummary(items);

  return (
    <section
      aria-labelledby="mosque-facilities-heading"
      className="premium-panel relative overflow-hidden rounded-[2rem] p-5 sm:p-7 lg:p-8"
    >
      <div
        aria-hidden="true"
        className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-yellow-400/10 bg-yellow-400/[0.025]"
      />

      <div className="relative">
        <div className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="section-kicker">
              Mosque information
            </div>

            <h2
              id="mosque-facilities-heading"
              className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl"
            >
              Facilities &amp; services
            </h2>

            <p className="mt-3 text-sm leading-7 text-white/55 sm:text-base">
              Check the facilities, access
              arrangements and community
              services currently recorded for
              this mosque. Contact the mosque
              before relying on accessibility,
              parking or service information.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:max-w-md lg:justify-end">
            <SummaryBadge
              label="Available"
              value={summary.available}
              tone="good"
            />

            <SummaryBadge
              label="Not available"
              value={summary.unavailable}
              tone="danger"
            />

            <SummaryBadge
              label="Not confirmed"
              value={summary.unknown}
              tone="neutral"
            />

            <span
              title={`${summary.confirmed} of ${summary.total} facility records have been confirmed`}
              className={`inline-flex min-h-12 flex-col justify-center rounded-2xl border px-4 py-2 ${getCompletenessClasses(
                summary.completeness
              )}`}
            >
              <span className="text-[0.6rem] font-black uppercase tracking-[0.15em] opacity-70">
                Data completeness
              </span>

              <span className="mt-0.5 text-sm font-black">
                {summary.completeness}% ·{" "}
                {getCompletenessLabel(
                  summary.completeness
                )}
              </span>
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <FacilityCard
              key={item.key}
              item={item}
            />
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <article className="premium-inset rounded-3xl p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <FacilityIcon>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <circle
                    cx="12"
                    cy="7"
                    r="3"
                  />
                  <path d="M5 21a7 7 0 0 1 14 0" />
                </svg>
              </FacilityIcon>

              <div className="min-w-0">
                <div className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-yellow-400/80">
                  Mosque leadership
                </div>

                <h3 className="mt-2 text-lg font-black text-white">
                  Imam
                </h3>

                <p
                  dir="auto"
                  className={[
                    "mt-2 break-words text-sm leading-7",
                    cleanImamName
                      ? "font-semibold text-white/80"
                      : "text-white/45",
                  ].join(" ")}
                >
                  {cleanImamName ??
                    "The imam’s name has not yet been confirmed."}
                </p>
              </div>
            </div>
          </article>

          <article className="premium-inset rounded-3xl p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <FacilityIcon>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M4 5h16v11H8l-4 4V5Z" />
                  <path d="M8 9h8" />
                  <path d="M8 12h5" />
                </svg>
              </FacilityIcon>

              <div className="min-w-0">
                <div className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-yellow-400/80">
                  Communication
                </div>

                <h3 className="mt-2 text-lg font-black text-white">
                  Languages
                </h3>

                {cleanLanguages.length > 0 ? (
                  <ul
                    aria-label="Languages used at this mosque"
                    className="mt-3 flex flex-wrap gap-2"
                  >
                    {cleanLanguages.map(
                      (language) => (
                        <li
                          key={language.toLocaleLowerCase(
                            "en-GB"
                          )}
                          dir="auto"
                          className="rounded-full border border-yellow-400/20 bg-yellow-400/[0.07] px-3 py-1.5 text-xs font-bold text-yellow-200"
                        >
                          {language}
                        </li>
                      )
                    )}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm leading-7 text-white/45">
                    Languages used by the mosque
                    have not yet been confirmed.
                  </p>
                )}
              </div>
            </div>
          </article>
        </div>

        {cleanNotes ? (
          <aside
            aria-labelledby="facility-notes-heading"
            className="premium-inset mt-6 rounded-3xl p-5 sm:p-6"
          >
            <div className="flex items-start gap-4">
              <FacilityIcon>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M5 4h14v16H5z" />
                  <path d="M8 8h8" />
                  <path d="M8 12h8" />
                  <path d="M8 16h5" />
                </svg>
              </FacilityIcon>

              <div className="min-w-0">
                <div className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-yellow-400/80">
                  Additional information
                </div>

                <h3
                  id="facility-notes-heading"
                  className="mt-2 text-lg font-black text-white"
                >
                  Facilities notes
                </h3>

                <p
                  dir="auto"
                  className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-white/70"
                >
                  {cleanNotes}
                </p>
              </div>
            </div>
          </aside>
        ) : null}

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-yellow-400/20 bg-yellow-400/10 text-yellow-300"
          >
            i
          </span>

          <p className="text-xs leading-6 text-white/45 sm:text-sm">
            Information may come from mosque
            management, trusted timetable
            sources or community contributions.
            Availability can change, especially
            during busy prayers, Jumu’ah,
            Ramadan and major events.
          </p>
        </div>
      </div>
    </section>
  );
}

function FacilityCard({
  item,
}: {
  item: FacilityItem;
}) {
  return (
    <article className="group premium-inset relative overflow-hidden rounded-3xl p-5 transition duration-300 hover:-translate-y-0.5 hover:border-yellow-400/25">
      <div
        aria-hidden="true"
        className="absolute -right-12 -top-12 h-28 w-28 rounded-full border border-yellow-400/[0.07] bg-yellow-400/[0.02] transition duration-500 group-hover:scale-110"
      />

      <div className="relative flex items-start justify-between gap-3">
        <FacilityIcon>
          {item.icon}
        </FacilityIcon>

        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[0.58rem] font-black uppercase tracking-[0.12em] text-white/38">
          {getCategoryLabel(
            item.category
          )}
        </span>
      </div>

      <h3 className="relative mt-4 text-base font-black text-white">
        {item.label}
      </h3>

      <p className="relative mt-2 min-h-12 text-xs leading-6 text-white/45">
        {item.description}
      </p>

      <div
        title={getStatusDescription(
          item.status
        )}
        className={`relative mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${getStatusClasses(
          item.status
        )}`}
      >
        {getStatusIcon(item.status)}

        <span>
          {getStatusLabel(item.status)}
        </span>
      </div>
    </article>
  );
}

function SummaryBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "danger" | "neutral";
}) {
  const className =
    tone === "good"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
      : tone === "danger"
        ? "border-red-500/25 bg-red-500/10 text-red-200"
        : "border-white/10 bg-white/[0.04] text-white/55";

  return (
    <span
      className={`inline-flex min-h-12 flex-col justify-center rounded-2xl border px-4 py-2 ${className}`}
    >
      <span className="text-[0.6rem] font-black uppercase tracking-[0.15em] opacity-70">
        {label}
      </span>

      <span className="mt-0.5 text-sm font-black">
        {value}
      </span>
    </span>
  );
}