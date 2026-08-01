import {
  trustBadgeClass,
  trustLabel,
  type TrustScoreResult,
} from "@/lib/trustScore";

type Props = { result: TrustScoreResult; showReasons?: boolean };

export default function TrustBadge({
  result,
  showReasons = false,
}: Props) {
  const score = Number.isFinite(result.score)
    ? Math.min(100, Math.max(0, Math.round(result.score)))
    : 0;

  const reasons = (result.reasons ?? [])
    .filter((reason) => typeof reason === "string" && reason.trim())
    .map((reason) => reason.trim());

  const reasonText = reasons.join(", ");

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${trustBadgeClass(
        result.level
      )}`}
      title={reasonText || undefined}
      aria-label={`${trustLabel(result.level)} trust score: ${score} out of 100${
        showReasons && reasonText ? `. ${reasonText}` : ""
      }`}
    >
      <span>{trustLabel(result.level)}</span>
      <span aria-hidden="true" className="opacity-70">{score}/100</span>
    </span>
  );
}