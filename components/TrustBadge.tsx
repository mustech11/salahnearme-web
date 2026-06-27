import {
  trustBadgeClass,
  trustLabel,
  type TrustScoreResult,
} from "@/lib/trustScore";

type Props = {
  result: TrustScoreResult;
};

export default function TrustBadge({ result }: Props) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${trustBadgeClass(
        result.level
      )}`}
      title={result.reasons.join(", ")}
    >
      <span>{trustLabel(result.level)}</span>
      <span className="opacity-70">{result.score}/100</span>
    </div>
  );
}

