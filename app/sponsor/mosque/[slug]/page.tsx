import Link from "next/link";
import { notFound } from "next/navigation";
import { supabasePublic } from "@/lib/supabaseServer";
import SponsorMosqueClient from "@/components/SponsorMosqueClient";

export const revalidate = 300;

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

export async function generateStaticParams() {
  const supabase = supabasePublic();

  const { data } = await supabase
    .from("mosques")
    .select("slug")
    .not("slug", "is", null);

  return (data ?? [])
    .filter((m) => !!m.slug)
    .map((m) => ({
      slug: m.slug as string,
    }));
}

export default async function SponsorMosquePage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = supabasePublic();

  const { data: mosque, error: mosqueError } = await supabase
    .from("mosques")
    .select("id,name,slug,city,area,postcode")
    .eq("slug", slug)
    .maybeSingle();

  if (mosqueError) {
    return <pre className="text-white/80">{mosqueError.message}</pre>;
  }

  if (!mosque) {
    notFound();
  }

  const { data: businesses, error: businessesError } = await supabase
    .from("businesses")
    .select("id,name,slug,category,city,featured")
    .eq("city", mosque.city)
    .order("featured", { ascending: false })
    .order("name", { ascending: true });

  if (businessesError) {
    return <pre className="text-white/80">{businessesError.message}</pre>;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Mosque Sponsorship
        </div>

        <h1 className="mt-3 text-4xl font-bold text-white">
          Sponsor {mosque.name}
        </h1>

        <div className="mt-3 text-white/70">
          {[mosque.area, mosque.city, mosque.postcode].filter(Boolean).join(" • ")}
        </div>

        <p className="mt-4 max-w-2xl text-white/70">
          Promote your halal business on this mosque page and help visitors
          discover trusted local services nearby.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/mosque/${mosque.slug}`}
            className="rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
          >
            Back to mosque page
          </Link>
        </div>
      </section>

      <SponsorMosqueClient
        mosqueId={mosque.id}
        mosqueName={mosque.name}
        businesses={(businesses ?? []) as BusinessRow[]}
      />
    </div>
  );
}