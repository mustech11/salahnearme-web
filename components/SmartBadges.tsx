import type { SmartBadge } from "@/lib/smartBadges";

type Props = {
  badges: SmartBadge[];
};

export default function SmartBadges({ badges }: Props) {
  if (!badges.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={`rounded-full border px-3 py-1 text-[10px] font-semibold ${badge.className}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

