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

type FacilityStatus = "available" | "unavailable" | "unknown";

type FacilityItem = {
  label: string;
  value: string;
  status?: FacilityStatus;
};

const MAX_DISPLAY_LANGUAGES = 12;

function cleanText(
  value: string | null | undefined
): string | null {
  const cleaned = value?.trim();

  return cleaned ? cleaned : null;
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

function getStatusLabel(status: FacilityStatus): string {
  if (status === "available") {
    return "Available";
  }

  if (status === "unavailable") {
    return "Not available";
  }

  return "Not confirmed";
}

function getStatusClasses(status: FacilityStatus): string {
  if (status === "available") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "unavailable") {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }

  return "border-white/10 bg-white/5 text-white/55";
}

function normaliseLanguages(
  languages: string[] | null | undefined
): string[] {
  if (!Array.isArray(languages)) {
    return [];
  }

  const unique = new Map<string, string>();

  for (const language of languages) {
    const cleaned = cleanText(language);

    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLocaleLowerCase("en-GB");

    if (!unique.has(key)) {
      unique.set(key, cleaned);
    }
  }

  return Array.from(unique.values())
    .sort((first, second) =>
      first.localeCompare(second, "en-GB")
    )
    .slice(0, MAX_DISPLAY_LANGUAGES);
}

function buildBooleanFacility(
  label: string,
  value: boolean | null | undefined
): FacilityItem {
  const status = getFacilityStatus(value);

  return {
    label,
    value: getStatusLabel(status),
    status,
  };
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
  const cleanImamName = cleanText(imam_name);
  const cleanNotes = cleanText(facilities_notes);
  const cleanLanguages = normaliseLanguages(languages);

  const items: FacilityItem[] = [
    buildBooleanFacility(
      "Women’s space",
      womens_space
    ),
    buildBooleanFacility("Parking", parking),
    buildBooleanFacility(
      "Wheelchair access",
      wheelchair_access
    ),
    buildBooleanFacility(
      "Children’s classes",
      children_classes
    ),
    buildBooleanFacility(
      "Nikah service",
      nikah_service
    ),
    buildBooleanFacility(
      "Janazah service",
      janazah_service
    ),
    buildBooleanFacility(
      "Wudu facilities",
      wudu_facilities
    ),
    buildBooleanFacility(
      "Sisters’ entrance",
      sisters_entrance
    ),
    {
      label: "Imam",
      value: cleanImamName ?? "Not confirmed",
    },
    {
      label: "Languages",
      value:
        cleanLanguages.length > 0
          ? cleanLanguages.join(", ")
          : "Not confirmed",
    },
  ];

  const confirmedFacilities = items.filter(
    (item) => item.status === "available"
  ).length;

  const unavailableFacilities = items.filter(
    (item) => item.status === "unavailable"
  ).length;

  return (
    <section
      aria-labelledby="mosque-facilities-heading"
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.24em] text-yellow-400">
            Mosque information
          </div>

          <h2
            id="mosque-facilities-heading"
            className="mt-2 text-2xl font-semibold text-white"
          >
            Facilities &amp; Services
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
            Facilities are shown from mosque-provided or
            community-verified information. Contact the mosque
            directly before relying on accessibility or service
            details.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            {confirmedFacilities} confirmed
          </span>

          {unavailableFacilities > 0 ? (
            <span className="rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
              {unavailableFacilities} unavailable
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.label}
            className="rounded-2xl border border-white/10 bg-black/30 p-5"
          >
            <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
              {item.label}
            </div>

            {item.status ? (
              <div
                className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${getStatusClasses(
                  item.status
                )}`}
              >
                {item.value}
              </div>
            ) : (
              <div
                dir="auto"
                className="mt-3 break-words text-lg font-semibold text-white"
              >
                {item.value}
              </div>
            )}
          </article>
        ))}
      </div>

      {cleanNotes ? (
        <aside className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
            Additional notes
          </div>

          <p
            dir="auto"
            className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-white/80"
          >
            {cleanNotes}
          </p>
        </aside>
      ) : null}
    </section>
  );
}