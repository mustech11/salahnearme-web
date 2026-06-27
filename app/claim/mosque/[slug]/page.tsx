import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import ClaimMosqueForm from "@/components/ClaimMosqueForm";

export const revalidate = 300;

export const dynamic = "force-dynamic";

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
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("mosques")
    .select("name,city,area")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  const mosque = data as Pick<MosqueRow, "name" | "city" | "area"> | null;

  if (!mosque) {
    return {
      title: "Claim Mosque Not Found | SalahNearMe",
    };
  }

  return {
    title: `Claim ${mosque.name} | SalahNearMe`,
    description: `Submit a claim request for ${mosque.name} so mosque management can manage prayer times, iqamah times, Friday sessions, and live mosque updates.`,
    alternates: {
      canonical: `/claim/mosque/${slug}`,
    },
  };
}

export default async function ClaimMosquePage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("mosques")
    .select("id,name,slug,city,area,postcode,address")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  const mosque = data as MosqueRow | null;

  if (!mosque) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-yellow-500/20 bg-[#020826] p-8 md:p-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.12),transparent_30%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent_35%)]" />
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent" />
      <div className="relative z-10"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.16),transparent_38%)]" />

        <div className="relative z-10">
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Claim Mosque
          </div>

         <h1 className="mt-4 max-w-5xl text-3xl font-extrabold leading-tight tracking-tight text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.12)] md:text-5xl">
            Claim {mosque.name}
          </h1>

          <div className="mt-2 text-lg text-white/70">
            {[mosque.area, mosque.city, mosque.postcode]
              .filter(Boolean)
              .join(" • ")}
          </div>

          {mosque.address && (
            <div className="mt-4 max-w-3xl text-white/80">
              {mosque.address}
            </div>
          )}

          <p className="mt-6 max-w-3xl text-white/70">
            If you are part of this mosque’s management team, submit a request to
            claim this page. Once approved, you will be able to manage prayer
            times, iqamah times, Friday sessions, and live mosque updates.
          </p>

          <div className="mt-8">
            <Link
              href={`/mosque/${mosque.slug}`}
              className="luxe-button-outline text-sm"
            >
              ← Back to mosque page
            </Link>
          </div>
        </div>
      </section>

      <section className="luxe-card rounded-3xl p-8">
        <div className="text-2xl font-bold text-yellow-400">
          Claim Request Form
        </div>

        <p className="mt-3 max-w-3xl text-white/70">
          Submit your request for review. Once approved, mosque management will
          be able to update prayer times, iqamah times, Friday sessions, and
          live mosque updates.
        </p>

        <div className="mt-6">
          <ClaimMosqueForm
            mosqueId={mosque.id}
            mosqueSlug={mosque.slug}
            mosqueName={mosque.name}
          />
        </div>
      </section>
    </div>
  );
}