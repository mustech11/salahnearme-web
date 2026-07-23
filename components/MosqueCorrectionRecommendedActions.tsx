import Link from "next/link";

type Props = {
  mosqueId: string;
  mosqueSlug?: string | null;
  reportType: string;
};

type ActionTone =
  | "gold"
  | "cyan"
  | "green"
  | "red"
  | "purple";

type ActionItem = {
  id: string;
  label: string;
  description: string;
  href?: string;
  tone: ActionTone;
  actionLabel?: string;
};

type ReportType =
  | "prayer_time_wrong"
  | "iqamah_missing"
  | "jumuah_time_wrong"
  | "location_wrong"
  | "facilities_wrong"
  | "mosque_closed_or_moved"
  | "duplicate_mosque"
  | "other";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SLUG_REGEX =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function cleanText(
  value: string | null | undefined
): string {
  return value?.trim() ?? "";
}

function normaliseReportType(
  value: string
): ReportType {
  const type = cleanText(value)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (
    type === "prayer_time_wrong" ||
    type === "iqamah_missing" ||
    type === "jumuah_time_wrong" ||
    type === "location_wrong" ||
    type === "facilities_wrong" ||
    type === "mosque_closed_or_moved" ||
    type === "duplicate_mosque"
  ) {
    return type;
  }

  return "other";
}

function formatReportType(value: string): string {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return "General Report";
  }

  return cleaned
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function getActionItems({
  mosqueId,
  mosqueSlug,
  reportType,
}: Props): ActionItem[] {
  const type = normaliseReportType(reportType);

  const safeMosqueId = UUID_REGEX.test(mosqueId)
    ? mosqueId
    : null;

  const safeMosqueSlug =
    mosqueSlug && SLUG_REGEX.test(mosqueSlug)
      ? mosqueSlug
      : null;

  const publicMosquePage = safeMosqueSlug
    ? `/mosque/${safeMosqueSlug}`
    : null;

  const publicTimetablePage = safeMosqueSlug
    ? `/mosque/${safeMosqueSlug}/timetable`
    : null;

  const prayerEditorPage = safeMosqueId
    ? `/business-dashboard/mosques/${safeMosqueId}/prayer-times`
    : null;

  const jumuahEditorPage = safeMosqueId
    ? `/business-dashboard/mosques/${safeMosqueId}/jumuah-times`
    : null;

  const dataQualityPage = safeMosqueId
    ? `/business-dashboard/mosques/${safeMosqueId}/data-quality`
    : null;

  if (
    type === "prayer_time_wrong" ||
    type === "iqamah_missing"
  ) {
    return [
      {
        id: "edit-prayer-times",
        label: "Edit prayer times",
        description:
          "Open the mosque prayer-time editor and correct the affected beginning or iqamah time.",
        href: prayerEditorPage ?? undefined,
        actionLabel: "Open editor",
        tone: "gold",
      },
      {
        id: "check-data-quality",
        label: "Check timetable quality",
        description:
          "Review timetable coverage, missing iqamah values and low-confidence records before resolving the report.",
        href: dataQualityPage ?? undefined,
        actionLabel: "Review quality",
        tone: "cyan",
      },
      ...(publicTimetablePage
        ? [
            {
              id: "view-public-timetable",
              label: "View public timetable",
              description:
                "Compare the submitted report with the timetable currently shown to visitors.",
              href: publicTimetablePage,
              actionLabel: "View timetable",
              tone: "green" as const,
            },
          ]
        : []),
    ];
  }

  if (type === "jumuah_time_wrong") {
    return [
      {
        id: "edit-jumuah-times",
        label: "Edit Jumu’ah times",
        description:
          "Open the Jumu’ah editor and correct the relevant khutbah or salah session.",
        href: jumuahEditorPage ?? undefined,
        actionLabel: "Open editor",
        tone: "gold",
      },
      ...(publicMosquePage
        ? [
            {
              id: "view-jumuah-public",
              label: "Check public information",
              description:
                "Review how Jumu’ah sessions currently appear on the mosque profile.",
              href: publicMosquePage,
              actionLabel: "View mosque",
              tone: "green" as const,
            },
          ]
        : []),
    ];
  }

  if (type === "location_wrong") {
    return [
      ...(publicMosquePage
        ? [
            {
              id: "view-location-public",
              label: "Check public location",
              description:
                "Review the public address, map destination and directions before making any changes.",
              href: publicMosquePage,
              actionLabel: "View mosque",
              tone: "green" as const,
            },
          ]
        : []),
      {
        id: "verify-location",
        label: "Verify before updating",
        description:
          "Confirm the location through the mosque website, direct contact or reliable mapping evidence.",
        tone: "red",
      },
    ];
  }

  if (type === "facilities_wrong") {
    return [
      ...(publicMosquePage
        ? [
            {
              id: "view-facilities-public",
              label: "Review public facilities",
              description:
                "Compare the report with the facilities currently displayed on the mosque profile.",
              href: publicMosquePage,
              actionLabel: "View mosque",
              tone: "green" as const,
            },
          ]
        : []),
      {
        id: "verify-facilities",
        label: "Confirm facility details",
        description:
          "Check the mosque website or contact the mosque before updating accessibility, women’s space or service information.",
        tone: "cyan",
      },
    ];
  }

  if (type === "mosque_closed_or_moved") {
    return [
      ...(publicMosquePage
        ? [
            {
              id: "view-closure-public",
              label: "Review public listing",
              description:
                "Inspect the listing before deciding whether it should be updated, relocated or hidden.",
              href: publicMosquePage,
              actionLabel: "View mosque",
              tone: "green" as const,
            },
          ]
        : []),
      {
        id: "verify-closure",
        label: "Admin verification required",
        description:
          "Closure and relocation reports should be independently verified before public availability is changed.",
        tone: "red",
      },
    ];
  }

  if (type === "duplicate_mosque") {
    return [
      {
        id: "duplicate-review",
        label: "Duplicate review required",
        description:
          "Compare names, addresses, coordinates, contact details and source quality before merging records.",
        tone: "purple",
      },
    ];
  }

  return [
    ...(publicMosquePage
      ? [
          {
            id: "view-public-general",
            label: "Review public mosque page",
            description:
              "Open the public mosque page and compare the displayed information with the report.",
            href: publicMosquePage,
            actionLabel: "View mosque",
            tone: "green" as const,
          },
        ]
      : []),
    {
      id: "manual-review",
      label: "Manual review",
      description:
        "Read the full report, verify the evidence and identify which mosque information needs to be updated.",
      tone: "cyan",
    },
  ];
}

function toneClass(tone: ActionTone): string {
  if (tone === "green") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
  }

  if (tone === "cyan") {
    return "border-cyan-500/25 bg-cyan-500/10 text-cyan-200";
  }

  if (tone === "red") {
    return "border-red-500/25 bg-red-500/10 text-red-200";
  }

  if (tone === "purple") {
    return "border-purple-500/25 bg-purple-500/10 text-purple-200";
  }

  return "border-yellow-500/25 bg-yellow-500/10 text-yellow-100";
}

function buttonClass(tone: ActionTone): string {
  if (tone === "green") {
    return "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 focus-visible:ring-emerald-300";
  }

  if (tone === "cyan") {
    return "border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 focus-visible:ring-cyan-300";
  }

  if (tone === "red") {
    return "border-red-500/30 text-red-300 hover:bg-red-500/10 focus-visible:ring-red-300";
  }

  if (tone === "purple") {
    return "border-purple-500/30 text-purple-300 hover:bg-purple-500/10 focus-visible:ring-purple-300";
  }

  return "border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10 focus-visible:ring-yellow-300";
}

export default function MosqueCorrectionRecommendedActions({
  mosqueId,
  mosqueSlug,
  reportType,
}: Props) {
  const actions = getActionItems({
    mosqueId,
    mosqueSlug,
    reportType,
  });

  return (
    <section
      aria-labelledby="recommended-correction-actions-heading"
      className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4"
    >
      <div className="text-xs uppercase tracking-[0.18em] text-yellow-400">
        Recommended fix
      </div>

      <h4
        id="recommended-correction-actions-heading"
        className="mt-2 text-lg font-black text-white"
      >
        Suggested actions for{" "}
        {formatReportType(reportType)}
      </h4>

      <p className="mt-2 text-sm leading-6 text-white/55">
        Verify the report before changing public mosque
        information.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => (
          <article
            key={action.id}
            className={`rounded-2xl border p-4 ${toneClass(
              action.tone
            )}`}
          >
            <div className="font-bold">
              {action.label}
            </div>

            <p className="mt-2 text-sm leading-6 opacity-80">
              {action.description}
            </p>

            {action.href ? (
              <Link
                href={action.href}
                className={`mt-4 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 ${buttonClass(
                  action.tone
                )}`}
              >
                {action.actionLabel ?? "Open"}
              </Link>
            ) : (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-xs font-bold text-white/50">
                Verification required
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}