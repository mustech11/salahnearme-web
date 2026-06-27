import Link from "next/link";

type Props = {
  mosqueId: string;
  mosqueSlug?: string | null;
  reportType: string;
};

type ActionItem = {
  label: string;
  description: string;
  href?: string;
  tone: "gold" | "cyan" | "green" | "red" | "purple";
};

function formatReportType(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getActionItems({
  mosqueId,
  mosqueSlug,
  reportType,
}: Props): ActionItem[] {
  const type = reportType.toLowerCase();

  if (type === "prayer_time_wrong" || type === "iqamah_missing") {
    return [
      {
        label: "Edit prayer times",
        description:
          "Open the mosque prayer-times editor and correct the affected daily timetable or iqamah field.",
        href: `/business-dashboard/mosques/${mosqueId}/prayer-times`,
        tone: "gold",
      },
      {
        label: "Check data quality",
        description:
          "Review missing timetable days, iqamah gaps, and low-confidence rows before resolving this report.",
        href: `/business-dashboard/mosques/${mosqueId}/data-quality`,
        tone: "cyan",
      },
      ...(mosqueSlug
        ? [
            {
              label: "View public timetable",
              description:
                "Open the public timetable to confirm what users currently see.",
              href: `/mosque/${mosqueSlug}/timetable`,
              tone: "green" as const,
            },
          ]
        : []),
    ];
  }

  if (type === "jumuah_time_wrong") {
    return [
      {
        label: "Edit Jumuʿah times",
        description:
          "Open the Jumuʿah editor and correct khutbah/salah session times.",
        href: `/business-dashboard/mosques/${mosqueId}/jumuah-times`,
        tone: "gold",
      },
      ...(mosqueSlug
        ? [
            {
              label: "View public mosque page",
              description:
                "Check how the Jumuʿah information appears to public users.",
              href: `/mosque/${mosqueSlug}`,
              tone: "green" as const,
            },
          ]
        : []),
    ];
  }

  if (type === "location_wrong") {
    return [
      ...(mosqueSlug
        ? [
            {
              label: "View public mosque page",
              description:
                "Check the visible address, map, and directions shown to users.",
              href: `/mosque/${mosqueSlug}`,
              tone: "green" as const,
            },
          ]
        : []),
      {
        label: "Admin review required",
        description:
          "Location changes should be checked carefully before public data is changed.",
        tone: "red",
      },
    ];
  }

  if (type === "facilities_wrong") {
    return [
      ...(mosqueSlug
        ? [
            {
              label: "View public mosque page",
              description:
                "Check the public facilities section and compare it with the report.",
              href: `/mosque/${mosqueSlug}`,
              tone: "green" as const,
            },
          ]
        : []),
      {
        label: "Facilities editor coming soon",
        description:
          "A dedicated mosque profile/facilities editor will be added in a later phase.",
        tone: "cyan",
      },
    ];
  }

  if (type === "mosque_closed_or_moved") {
    return [
      ...(mosqueSlug
        ? [
            {
              label: "View public mosque page",
              description:
                "Check the public listing before deciding whether the mosque should be hidden, moved, or updated.",
              href: `/mosque/${mosqueSlug}`,
              tone: "green" as const,
            },
          ]
        : []),
      {
        label: "Admin review required",
        description:
          "Closure or relocation reports should be verified before changing public availability.",
        tone: "red",
      },
    ];
  }

  if (type === "duplicate_mosque") {
    return [
      {
        label: "Admin merge review required",
        description:
          "Duplicate mosque listings should be reviewed by an admin before merging or hiding records.",
        tone: "purple",
      },
    ];
  }

  return [
    ...(mosqueSlug
      ? [
          {
            label: "View public mosque page",
            description:
              "Open the public mosque page and compare it with the submitted report.",
            href: `/mosque/${mosqueSlug}`,
            tone: "green" as const,
          },
        ]
      : []),
    {
      label: "Manual review",
      description:
        "Read the report carefully and decide which mosque data needs updating.",
      tone: "cyan",
    },
  ];
}

function toneClass(tone: ActionItem["tone"]) {
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

function buttonClass(tone: ActionItem["tone"]) {
  if (tone === "green") {
    return "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10";
  }

  if (tone === "cyan") {
    return "border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10";
  }

  if (tone === "red") {
    return "border-red-500/30 text-red-300 hover:bg-red-500/10";
  }

  if (tone === "purple") {
    return "border-purple-500/30 text-purple-300 hover:bg-purple-500/10";
  }

  return "border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10";
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
    <section className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-yellow-400">
        Recommended fix
      </div>

      <h4 className="mt-2 text-lg font-black text-white">
        Suggested actions for {formatReportType(reportType)}
      </h4>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {actions.map((action) => (
          <div
            key={action.label}
            className={`rounded-2xl border p-4 ${toneClass(action.tone)}`}
          >
            <div className="font-bold">{action.label}</div>

            <p className="mt-2 text-sm leading-6 opacity-80">
              {action.description}
            </p>

            {action.href ? (
              <Link
                href={action.href}
                className={`mt-4 inline-flex rounded-xl border px-4 py-2 text-xs font-black ${buttonClass(
                  action.tone
                )}`}
              >
                Open
              </Link>
            ) : (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-xs font-bold text-white/50">
                No direct action yet
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

