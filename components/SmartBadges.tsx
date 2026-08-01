import type { SmartBadge } from "@/lib/smartBadges";

type Props = {
  badges: SmartBadge[];
  ariaLabel?: string;
  maxVisible?: number;
};

type NormalisedBadge = {
  label: string;
  className: string;
};

const DEFAULT_MAX_VISIBLE = 12;

function cleanText(
  value: unknown,
  maxLength = 120
): string {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u001F\u007F]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength)
    : "";
}

function normaliseMaxVisible(
  value: number | undefined
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return DEFAULT_MAX_VISIBLE;
  }

  return Math.min(
    50,
    Math.max(1, Math.trunc(value))
  );
}

function normaliseBadges(
  badges: SmartBadge[],
  maxVisible: number
): NormalisedBadge[] {
  const seen = new Set<string>();
  const normalised: NormalisedBadge[] = [];

  for (const badge of badges ?? []) {
    const label = cleanText(
      badge?.label,
      120
    );

    const className = cleanText(
      badge?.className,
      500
    );

    const dedupeKey =
      label.toLocaleLowerCase("en-GB");

    if (
      !label ||
      seen.has(dedupeKey)
    ) {
      continue;
    }

    seen.add(dedupeKey);

    normalised.push({
      label,
      className,
    });

    if (
      normalised.length >= maxVisible
    ) {
      break;
    }
  }

  return normalised;
}

export default function SmartBadges({
  badges,
  ariaLabel = "Smart status badges",
  maxVisible = DEFAULT_MAX_VISIBLE,
}: Props) {
  const safeMaxVisible =
    normaliseMaxVisible(maxVisible);

  const usableBadges =
    normaliseBadges(
      badges,
      safeMaxVisible
    );

  if (usableBadges.length === 0) {
    return null;
  }

  return (
    <div
      role="list"
      aria-label={
        cleanText(ariaLabel, 160) ||
        "Smart status badges"
      }
      className="flex flex-wrap gap-2"
    >
      {usableBadges.map((badge) => (
        <span
          key={badge.label}
          role="listitem"
          className={`inline-flex min-h-7 items-center rounded-full border px-3 py-1 text-[10px] font-black leading-none ${badge.className}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}