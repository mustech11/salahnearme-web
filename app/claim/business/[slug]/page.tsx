import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import BusinessClaimForm from "@/components/BusinessClaimForm";
import { supabasePublic } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type BusinessRow = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  postcode: string | null;
};

function cleanSlug(value: string) {
  return value.trim().toLowerCase();
}

function businessTitle(name: string | null) {
  return name?.trim() || "this business";
}

async function getBusinessBySlug(slug: string) {
  const supabase = supabasePublic();

  const { data, error } = await supabase
    .from("businesses")
    .select("id,name,slug,city,area,address,postcode")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("claim business lookup error:", error);
    return null;
  }

  return data as BusinessRow | null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusinessBySlug(cleanSlug(slug));

  if (!business) {
    return {
      title: "Claim Business | SalahNearMe",
      description: "Claim and verify a business listing on SalahNearMe.",
    };
  }

  const name = businessTitle(business.name);

  return {
    title: `Claim ${name} | SalahNearMe`,
    description: `Claim and verify ownership of ${name} on SalahNearMe.`,
  };
}

export default async function ClaimBusinessPage({ params }: PageProps) {
  const { slug } = await params;
  const business = await getBusinessBySlug(cleanSlug(slug));

  if (!business) {
    notFound();
  }

  const name = businessTitle(business.name);
  const location = [business.area, business.city, business.postcode]
    .filter(Boolean)
    .join(" • ");

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="space-y-8">
        <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
          <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
            Claim Business
          </div>

          <h1 className="mt-3 text-4xl font-black text-white">
            Claim {name}
          </h1>

          {location && <div className="mt-3 text-white/70">{location}</div>}

          {business.address && (
            <div className="mt-4 text-white/80">{business.address}</div>
          )}

          <div className="mt-6">
            <Link
              href={business.slug ? `/business/${business.slug}` : "/businesses"}
              className="inline-flex rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-bold text-yellow-400 hover:bg-yellow-500/10"
            >
              ← Back to business page
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
          <div className="text-2xl font-bold text-yellow-400">
            Ownership verification request
          </div>

          <p className="mt-2 max-w-3xl text-white/70">
            Submit your ownership claim for review. Once approved, you can manage
            this listing and access business dashboard features.
          </p>

          <div className="mt-6">
            <BusinessClaimForm
              businessId={business.id}
              businessSlug={business.slug ?? ""}
              businessName={name}
            />
          </div>
        </section>
      </div>
    </main>
  );
}