import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ClaimMosqueForm from "@/components/ClaimMosqueForm";
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
  name: string;
  slug: string;
  city: string | null;
  area: string | null;
  postcode: string | null;
  address: string | null;
  verified_status: string | null;
};

const SLUG_REGEX =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function cleanSlug(value: string): string | null {
  const cleaned = decodeURIComponent(value)
    .trim()
    .toLowerCase()
    .slice(0, 220);

  return SLUG_REGEX.test(cleaned)
    ? cleaned
    : null;
}

function cleanText(
  value: string | null | undefined
): string {
  return value?.trim() ?? "";
}

async function loadMosque(
  slug: string
): Promise<MosqueRow | null> {
  const supabase = supabasePublic();

  const { data, error } = await supabase
    .from("mosques")
    .select(
      `
      id,
      name,
      slug,
      city,
      area,
      postcode,
      address,
      verified_status
    `
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Claim mosque page lookup error:", {
      slug,
      code: error.code,
      message: error.message,
    });

    return null;
  }

  if (
    !data ||
    !cleanText(data.id) ||
    !cleanText(data.name) ||
    !cleanText(data.slug)
  ) {
    return null;
  }

  return data as MosqueRow;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = cleanSlug(resolvedParams.slug);

  if (!slug) {
    return {
      title: "Claim Mosque Not Found | SalahNearMe",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const mosque = await loadMosque(slug);

  if (!mosque) {
    return {
      title: "Claim Mosque Not Found | SalahNearMe",
      description:
        "The requested mosque claim page could not be found.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const location = [
    mosque.area,
    mosque.city,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(", ");

  const description = `Submit a management claim request for ${
    mosque.name
  }${
    location ? ` in ${location}` : ""
  }. Approved managers can maintain prayer times, iqamah times, Jumu’ah sessions and mosque information.`;

  return {
    title: `Claim ${mosque.name} | SalahNearMe`,
    description,
    alternates: {
      canonical: `/claim/mosque/${mosque.slug}`,
    },
    robots: {
      index: false,
      follow: false,
      nocache: true,
    },
  };
}

export default async function ClaimMosquePage({
  params,
}: PageProps) {
  const resolvedParams = await params;
  const slug = cleanSlug(resolvedParams.slug);

  if (!slug) {
    notFound();
  }

  const mosque = await loadMosque(slug);

  if (!mosque) {
    notFound();
  }

  const location = [
    mosque.area,
    mosque.city,
    mosque.postcode,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(" • ");

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-yellow-500/20 bg-[#020826] p-8 md:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.14),transparent_34%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent_38%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent" />

        <div className="relative z-10">
          <div className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
            Claim mosque
          </div>

          <h1 className="mt-4 max-w-5xl text-4xl font-black leading-tight tracking-tight text-white md:text-6xl">
            Claim {mosque.name}
          </h1>

          {location ? (
            <div className="mt-4 text-lg text-white/70">
              {location}
            </div>
          ) : null}

          {mosque.address ? (
            <div className="mt-4 max-w-3xl text-lg leading-7 text-white/80">
              {mosque.address}
            </div>
          ) : null}

          <p className="mt-6 max-w-3xl leading-7 text-white/70">
            Submit this form only if you are authorised by the mosque’s
            management team. Claims are reviewed before dashboard access is
            granted.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={`/mosque/${mosque.slug}`}
              className="rounded-xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-bold text-yellow-400 transition hover:bg-yellow-500/10"
            >
              ← Back to mosque page
            </Link>

            <Link
              href="/claim/mosque"
              className="rounded-xl border border-white/10 bg-black px-5 py-3 text-sm font-bold text-white/75 transition hover:border-yellow-500/30 hover:text-yellow-300"
            >
              Search another mosque
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
        <div className="text-sm font-semibold uppercase tracking-[0.25em] text-yellow-400">
          Management verification
        </div>

        <h2 className="mt-3 text-3xl font-black text-white">
          Claim request form
        </h2>

        <p className="mt-3 max-w-3xl leading-7 text-white/65">
          Provide accurate contact and management details. SalahNearMe may
          contact the mosque or request additional evidence before approving
          access.
        </p>

        <ClaimMosqueForm
          mosqueId={mosque.id}
          mosqueSlug={mosque.slug}
          mosqueName={mosque.name}
        />
      </section>
    </div>
  );
}