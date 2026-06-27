"use client";

import { useRouter } from "next/navigation";

type Props = {
  slug: string;
  name: string;
  category?: string | null;
  address?: string | null;
  postcode?: string | null;
  featured?: boolean | null;
};

export default function BusinessCardLink({
  slug,
  name,
  category,
  address,
  postcode,
  featured,
}: Props) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/business/${slug}`)}
      className="block cursor-pointer rounded-2xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 transition hover:border-yellow-500/40 hover:bg-yellow-500/[0.03]"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          router.push(`/business/${slug}`);
        }
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-white hover:text-yellow-400">
            {name}
          </div>
          <div className="mt-1 text-sm text-white/60">
            {category ?? "Business"}
          </div>
        </div>

        {featured && (
          <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
            Featured
          </div>
        )}
      </div>

      {address && <div className="mt-2 text-sm text-white/70">{address}</div>}

      {postcode && <div className="mt-1 text-sm text-white/60">{postcode}</div>}
    </div>
  );
}

