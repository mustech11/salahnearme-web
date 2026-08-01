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

type ActionPriority = "critical" | "high" | "standard";

type ActionItem = {
  id: string;
  label: string;
  description: string;
  href?: string;
  tone: ActionTone;
  actionLabel?: string;
  external?: boolean;
  priority?: ActionPriority;
  evidenceHint?: string;
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
    type ===
      "prayer_time_wrong" ||
    type === "iqamah_missing" ||
    type ===
      "jumuah_time_wrong" ||
    type === "location_wrong" ||
    type ===
      "facilities_wrong" ||
    type ===
      "mosque_closed_or_moved" ||
    type ===
      "duplicate_mosque"
  ) {
    return type;
  }

  return "other";
}

function formatReportType(
  value: string
): string {
  const cleaned =
    cleanText(value);

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
  const type =
    normaliseReportType(
      reportType
    );

  const safeMosqueId =
    UUID_REGEX.test(mosqueId)
      ? mosqueId
      : null;

  const cleanedSlug =
    cleanText(
      mosqueSlug
    ).toLowerCase();

  const safeMosqueSlug =
    SLUG_REGEX.test(cleanedSlug)
      ? cleanedSlug
      : null;

  const publicMosquePage =
    safeMosqueSlug
      ? `/mosque/${safeMosqueSlug}`
      : null;

  const publicTimetablePage =
    safeMosqueSlug
      ? `/mosque/${safeMosqueSlug}/timetable`
      : null;

  const prayerEditorPage =
    safeMosqueId
      ? `/business-dashboard/mosques/${safeMosqueId}/prayer-times`
      : null;

  const jumuahEditorPage =
    safeMosqueId
      ? `/business-dashboard/mosques/${safeMosqueId}/jumuah-times`
      : null;

  const dataQualityPage =
    safeMosqueId
      ? `/business-dashboard/mosques/${safeMosqueId}/data-quality`
      : null;

  if (
    type ===
      "prayer_time_wrong" ||
    type === "iqamah_missing"
  ) {
    return [
      {
        id: "edit-prayer-times",
        label:
          "Edit prayer times",
        description:
          "Open the mosque prayer-time editor and correct the affected beginning or iqamah value.",
        href:
          prayerEditorPage ??
          undefined,
        actionLabel:
          "Open editor",
        tone: "gold",
        priority: "high",
        evidenceHint: "Check the official timetable or direct mosque confirmation.",
      },
      {
        id: "check-data-quality",
        label:
          "Check timetable quality",
        description:
          "Review coverage, missing iqamah values and low-confidence rows before resolving the report.",
        href:
          dataQualityPage ??
          undefined,
        actionLabel:
          "Review quality",
        tone: "cyan",
        priority: "standard",
        evidenceHint: "Review missing rows, coverage and confidence indicators.",
      },
      ...(publicTimetablePage
        ? [
            {
              id: "view-public-timetable",
              label:
                "View public timetable",
              description:
                "Compare the submitted correction with the timetable currently shown to visitors.",
              href:
                publicTimetablePage,
              actionLabel:
                "View timetable",
              tone:
                "green" as const,
            },
          ]
        : []),
    ];
  }

  if (
    type ===
    "jumuah_time_wrong"
  ) {
    return [
      {
        id: "edit-jumuah-times",
        label:
          "Edit Jumuʿah times",
        description:
          "Open the Jumuʿah editor and correct the relevant khutbah or salah session.",
        href:
          jumuahEditorPage ??
          undefined,
        actionLabel:
          "Open editor",
        tone: "gold",
      },
      ...(publicMosquePage
        ? [
            {
              id: "view-jumuah-public",
              label:
                "Check public information",
              description:
                "Review how the Jumuʿah sessions currently appear on the mosque profile.",
              href:
                publicMosquePage,
              actionLabel:
                "View mosque",
              tone:
                "green" as const,
            },
          ]
        : []),
      {
        id: "verify-jumuah-source",
        label:
          "Confirm official source",
        description:
          "Check an official mosque timetable, website, announcement or direct mosque confirmation.",
        tone: "cyan",
      },
    ];
  }

  if (
    type === "location_wrong"
  ) {
    return [
      ...(publicMosquePage
        ? [
            {
              id: "view-location-public",
              label:
                "Check public location",
              description:
                "Review the current address, postcode, map destination and directions.",
              href:
                publicMosquePage,
              actionLabel:
                "View mosque",
              tone:
                "green" as const,
            },
          ]
        : []),
      {
        id: "verify-location",
        label:
          "Verify location evidence",
        description:
          "Confirm the address using the official mosque website, direct contact or reliable mapping evidence.",
        tone: "red",
      },
      {
        id: "check-coordinates",
        label:
          "Check map coordinates",
        description:
          "Ensure the latitude and longitude point to the mosque entrance rather than a postcode centre.",
        tone: "cyan",
      },
    ];
  }

  if (
    type ===
    "facilities_wrong"
  ) {
    return [
      ...(publicMosquePage
        ? [
            {
              id: "view-facilities-public",
              label:
                "Review public facilities",
              description:
                "Compare the report with the facilities and services displayed on the public profile.",
              href:
                publicMosquePage,
              actionLabel:
                "View mosque",
              tone:
                "green" as const,
            },
          ]
        : []),
      {
        id: "verify-facilities",
        label:
          "Confirm facility details",
        description:
          "Check accessibility, parking, women’s space and other facilities with an official mosque source.",
        tone: "cyan",
      },
      {
        id: "avoid-assumptions",
        label:
          "Do not infer availability",
        description:
          "Only mark a facility available or unavailable when reliable evidence exists.",
        tone: "gold",
      },
    ];
  }

  if (
    type ===
    "mosque_closed_or_moved"
  ) {
    return [
      ...(publicMosquePage
        ? [
            {
              id: "view-closure-public",
              label:
                "Review public listing",
              description:
                "Inspect the current public page before changing its visibility or address.",
              href:
                publicMosquePage,
              actionLabel:
                "View mosque",
              tone:
                "green" as const,
            },
          ]
        : []),
      {
        id: "verify-closure",
        label:
          "Admin verification required",
        description:
          "Closure or relocation must be independently verified before the listing is hidden or moved.",
        tone: "red",
      },
      {
        id: "preserve-history",
        label:
          "Preserve useful history",
        description:
          "Where possible, redirect an old listing to the verified replacement rather than deleting it immediately.",
        tone: "cyan",
      },
    ];
  }

  if (
    type === "duplicate_mosque"
  ) {
    return [
      {
        id: "duplicate-review",
        label:
          "Duplicate review required",
        description:
          "Compare names, addresses, coordinates, contacts, timetable data and source quality.",
        tone: "purple",
      },
      {
        id: "choose-primary",
        label:
          "Choose the strongest record",
        description:
          "Keep the most complete and trusted record before transferring missing information.",
        tone: "gold",
      },
      {
        id: "protect-linked-data",
        label:
          "Protect linked records",
        description:
          "Confirm claims, timetables, reports and sponsorships are safely reassigned before merging.",
        tone: "red",
      },
    ];
  }

  return [
    ...(publicMosquePage
      ? [
          {
            id: "view-public-general",
            label:
              "Review public mosque page",
            description:
              "Compare the displayed mosque information with the submitted report.",
            href:
              publicMosquePage,
            actionLabel:
              "View mosque",
            tone:
              "green" as const,
          },
        ]
      : []),
    {
      id: "manual-review",
      label: "Manual review",
      description:
        "Read the complete report, verify the evidence and identify which mosque information requires attention.",
      tone: "cyan",
    },
    {
      id: "record-outcome",
      label:
        "Record the evidence",
      description:
        "Add manager notes explaining what was checked and why the report was resolved or rejected.",
      tone: "gold",
    },
  ];
}

function getPriorityLabel(
  priority: ActionPriority | undefined
): string {
  if (priority === "critical") {
    return "Critical";
  }

  if (priority === "high") {
    return "High priority";
  }

  return "Recommended";
}

function getPriorityClass(
  priority: ActionPriority | undefined
): string {
  if (priority === "critical") {
    return "border-red-400/30 bg-red-400/10 text-red-200";
  }

  if (priority === "high") {
    return "border-yellow-400/30 bg-yellow-400/10 text-yellow-100";
  }

  return "border-white/10 bg-black/20 text-white/55";
}

function toneClass(
  tone: ActionTone
): string {
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

function buttonClass(
  tone: ActionTone
): string {
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
  const actions =
    getActionItems({
      mosqueId,
      mosqueSlug,
      reportType,
    });

  return (
    <section
      aria-labelledby="recommended-correction-actions-heading"
      className="overflow-hidden rounded-3xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 via-black/35 to-black/20 p-5 shadow-[0_24px_80px_-42px_rgba(234,179,8,0.65)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-black uppercase tracking-[0.2em] text-yellow-300">
          Recommended resolution plan
        </div>

        <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-white/55">
          {actions.length} {actions.length === 1 ? "action" : "actions"}
        </div>
      </div>

      <h4
        id="recommended-correction-actions-heading"
        className="mt-2 text-lg font-black text-white"
      >
        Suggested actions for{" "}
        {formatReportType(
          reportType
        )}
      </h4>

      <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
        Verify the report, compare it with a reliable source and record the evidence before changing public mosque information.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <WorkflowStep number="1" label="Review the report" />
        <WorkflowStep number="2" label="Verify the evidence" />
        <WorkflowStep number="3" label="Record the outcome" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => (
          <article
            key={action.id}
            className={`group flex h-full flex-col rounded-2xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-30px_rgba(255,255,255,0.35)] ${toneClass(
              action.tone
            )}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="font-black">
                {action.label}
              </div>

              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${getPriorityClass(
                  action.priority
                )}`}
              >
                {getPriorityLabel(action.priority)}
              </span>
            </div>

            <p className="mt-2 flex-1 text-sm leading-6 opacity-80">
              {action.description}
            </p>

            {action.evidenceHint ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-white/60">
                <span className="font-black text-white/75">Evidence:</span>{" "}
                {action.evidenceHint}
              </div>
            ) : null}

            {action.href ? (
              <Link
                href={action.href}
                target={
                  action.external
                    ? "_blank"
                    : undefined
                }
                rel={
                  action.external
                    ? "noopener noreferrer"
                    : undefined
                }
                className={`mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border bg-black/20 px-4 py-2 text-xs font-black transition group-hover:bg-black/30 focus-visible:outline-none focus-visible:ring-2 sm:w-fit ${buttonClass(
                  action.tone
                )}`}
              >
                {action.actionLabel ??
                  "Open"}
              </Link>
            ) : (
              <div className="mt-4 w-fit rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-xs font-bold text-white/50">
                Verification required
              </div>
            )}
          </article>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-xs leading-5 text-white/50">
        Recommended actions are guidance only. Mosque data should be changed only after the report has been checked against reliable evidence and the decision has been documented.
      </div>
    </section>
  );
}

function WorkflowStep({
  number,
  label,
}: {
  number: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-yellow-400/30 bg-yellow-400/10 text-xs font-black text-yellow-200">
        {number}
      </span>
      <span className="text-xs font-bold text-white/70">
        {label}
      </span>
    </div>
  );
}