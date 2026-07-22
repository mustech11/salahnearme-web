import Link from "next/link";
import { notFound } from "next/navigation";

import SponsorMosqueClient from "@/components/SponsorMosqueClient";
import { supabasePublic } from "@/lib/supabaseServer";

export const revalidate = 300;
export const dynamicParams = true;

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type MosqueRow = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
  area: string | null;
  postcode: string | null;
};

type BusinessRow = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  city: string | null;
  featured: boolean | null;
};

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned.length > 0 ? cleaned : null;
}

function isSafeSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export default async function SponsorMosquePage({
  params,
}: PageProps) {
  const { slug } = await params;

  if (!isSafeSlug(slug)) {
    notFound();
  }

  const supabase = supabasePublic();

  const { data: mosqueRaw, error: mosqueError } =
    await supabase
      .from("mosques")
      .select("id,name,slug,city,area,postcode")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

  if (mosqueError) {
    console.error(
      "sponsor mosque profile load error:",
      mosqueError
    );

    return (
      <ErrorPanel
        title="Sponsorship page temporarily unavailable"
        message="We could not load this mosque sponsorship page. Please try again shortly."
      />
    );
  }

  if (!mosqueRaw) {
    notFound();
  }

  const mosque = mosqueRaw as MosqueRow;

  const businessesQuery = supabase
    .from("businesses")
    .select("id,name,slug,category,city,featured")
    .eq("is_active", true)
    .eq("is_live", true)
    .order("featured", {
      ascending: false,
    })
    .order("name", {
      ascending: true,
    })
    .limit(200);

  const city = cleanString(mosque.city);

  const { data: businessesRaw, error: businessesError } =
    city
      ? await businessesQuery.eq("city", city)
      : await businessesQuery;

  if (businessesError) {
    console.error(
      "sponsor mosque businesses load error:",
      businessesError
    );
  }

  const businesses = (businessesRaw ?? []) as BusinessRow[];

  const location = [
    mosque.area,
    mosque.city,
    mosque.postcode,
  ]
    .map(cleanString)
    .filter((value): value is string => Boolean(value))
    .join(" • ");

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Mosque Sponsorship
        </div>

        <h1 className="mt-3 text-4xl font-bold text-white">
          Sponsor {mosque.name ?? "this mosque"}
        </h1>

        {location ? (
          <div className="mt-3 text-white/70">
            {location}
          </div>
        ) : null}

        <p className="mt-4 max-w-2xl text-white/70">
          Promote your halal business on this mosque page and
          help visitors discover trusted local services nearby.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          {mosque.slug ? (
            <Link
              href={`/mosque/${mosque.slug}`}
              className="rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-semibold text-yellow-400 transition hover:bg-yellow-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
            >
              Back to mosque page
            </Link>
          ) : null}
        </div>
      </section>

      {businessesError ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Business listings could not be loaded at the moment.
          You can refresh the page and try again.
        </div>
      ) : null}

      <SponsorMosqueClient
        mosqueId={mosque.id}
        mosqueName={mosque.name}
        businesses={businesses}
      />
    </div>
  );
}

function ErrorPanel({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
      <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
        SalahNearMe
      </div>

      <h1 className="mt-3 text-3xl font-bold text-white">
        {title}
      </h1>

      <p className="mt-4 max-w-2xl text-white/70">
        {message}
      </p>

      <div className="mt-6">
        <Link
          href="/"
          className="rounded-xl bg-yellow-500 px-4 py-3 text-sm font-bold text-black transition hover:bg-yellow-400"
        >
          Homepage
        </Link>
      </div>
    </section>
  );
}