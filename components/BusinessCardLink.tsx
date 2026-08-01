import Link from "next/link";

type Props = {
  slug: string;
  name: string;
  category?: string | null;
  address?: string | null;
  postcode?: string | null;
  featured?: boolean | null;
};

function cleanText(
  value: string | null | undefined
): string {
  return value?.trim() ?? "";
}

function isSafeSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value);
}

export default function BusinessCardLink({
  slug,
  name,
  category,
  address,
  postcode,
  featured,
}: Props) {
  const cleanSlug = cleanText(slug);
  const cleanName =
    cleanText(name) || "Unnamed business";
  const cleanCategory =
    cleanText(category) || "Business";
  const cleanAddress = cleanText(address);
  const cleanPostcode = cleanText(postcode);

  if (!isSafeSlug(cleanSlug)) {
    return (
      <article className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-6">
        <div className="font-bold text-white">
          {cleanName}
        </div>

        <div className="mt-1 text-sm text-white/60">
          {cleanCategory}
        </div>

        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
          This business profile is not currently available.
        </div>
      </article>
    );
  }

  return (
    <Link
      href={`/business/${encodeURIComponent(cleanSlug)}`}
      prefetch
      aria-label={`View ${cleanName}`}
      className="group block rounded-2xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 transition duration-200 hover:-translate-y-0.5 hover:border-yellow-500/40 hover:bg-yellow-500/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-black text-white transition group-hover:text-yellow-400">
            {cleanName}
          </h3>

          <div className="mt-1 text-sm text-white/60">
            {cleanCategory}
          </div>
        </div>

        {featured ? (
          <span className="shrink-0 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-black text-yellow-400">
            Featured
          </span>
        ) : null}
      </div>

      {cleanAddress ? (
        <address
          dir="auto"
          className="mt-3 not-italic text-sm leading-6 text-white/70"
        >
          {cleanAddress}
        </address>
      ) : null}

      {cleanPostcode ? (
        <div className="mt-1 text-sm font-medium text-white/50">
          {cleanPostcode}
        </div>
      ) : null}

      <div className="mt-5 inline-flex items-center text-sm font-bold text-yellow-400">
        View business
        <span
          aria-hidden="true"
          className="ml-2 transition-transform group-hover:translate-x-1"
        >
          →
        </span>
      </div>
    </Link>
  );
}