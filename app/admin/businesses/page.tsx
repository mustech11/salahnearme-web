import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";
import AdminGate from "@/components/AdminGate";
import AdminBusinessesClient from "@/components/AdminBusinessesClient";
import BusinessReviewQueueClient from "@/components/BusinessReviewQueueClient";

export const revalidate = 0;

type BusinessRow = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  city: string | null;
  address: string | null;
  postcode: string | null;
  phone: string | null;
  website: string | null;
  maps_url: string | null;
  is_verified: boolean | null;
  is_claimed: boolean | null;
  claimed_by_email: string | null;
  pricing_tier: string | null;
  subscription_type: string | null;
  paid_until: string | null;
  featured: boolean | null;
  featured_rank: number | null;
  sponsorship_active: boolean | null;
  city_sponsor: boolean | null;
  mosque_sponsor: boolean | null;
  sponsor_mosque_id: string | null;
  review_status: string | null;
  is_live: boolean | null;
};

type MosqueRow = {
  id: string;
  name: string | null;
  area: string | null;
  postcode: string | null;
};

function isPaidActive(value: string | null | undefined) {
  if (!value) return false;

  const time = new Date(value).getTime();

  return Number.isFinite(time) && time > Date.now();
}

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    mosque_id?: string;
    plan?: string;
  }>;
}) {
  const params = await searchParams;
  const selectedMosqueId = params?.mosque_id;
  const selectedPlan = params?.plan;

  const supabase = await supabaseServer();

  const [{ data: businessData, error: businessError }, { data: mosqueData }] =
    await Promise.all([
      supabase
        .from("businesses")
        .select(
          `
          id,
          name,
          slug,
          category,
          city,
          address,
          postcode,
          phone,
          website,
          maps_url,
          is_verified,
          is_claimed,
          claimed_by_email,
          pricing_tier,
          subscription_type,
          paid_until,
          featured,
          featured_rank,
          sponsorship_active,
          city_sponsor,
          mosque_sponsor,
          sponsor_mosque_id,
          review_status,
          is_live
        `
        )
        .order("created_at", { ascending: false })
        .limit(500),

      supabase
        .from("mosques")
        .select("id,name,area,postcode")
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ]);

  if (businessError) {
    return <pre className="text-white">{businessError.message}</pre>;
  }

  const businesses = (businessData ?? []) as BusinessRow[];
  const mosques = (mosqueData ?? []) as MosqueRow[];

  const total = businesses.length;
  const live = businesses.filter((b) => b.is_live).length;
  const verified = businesses.filter((b) => b.is_verified).length;
  const claimed = businesses.filter((b) => b.is_claimed).length;
  const featured = businesses.filter((b) => b.featured).length;
  const activePaid = businesses.filter((b) => isPaidActive(b.paid_until)).length;
  const pending = businesses.filter((b) => b.review_status === "pending").length;

  return (
    <AdminGate>
      <div className="space-y-8">
        <section className="luxe-card rounded-3xl p-8 md:p-10">
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Admin
          </div>

          <h1 className="dashboard-hero-glow mt-4 text-4xl font-black tracking-[-0.04em] text-white md:text-6xl">
            Businesses
          </h1>

          <p className="mt-4 max-w-3xl text-white/70">
            Review, approve, verify, hide, sponsor, feature, and manage halal
            business listings.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/admin" className="luxe-button-outline text-sm">
              ← Back to admin
            </Link>

            <Link href="/admin/business-claims" className="luxe-button text-sm">
              Business claims
            </Link>

            <Link
              href="/admin/campaigns"
              className="luxe-button-outline text-sm"
            >
              Campaigns
            </Link>

            <Link
              href="/admin/businesses?plan=sponsor"
              className="luxe-button-outline text-sm"
            >
              Sponsorship mode
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-7">
          <Stat title="Total" value={total} />
          <Stat title="Live" value={live} />
          <Stat title="Pending" value={pending} />
          <Stat title="Verified" value={verified} />
          <Stat title="Claimed" value={claimed} />
          <Stat title="Featured" value={featured} />
          <Stat title="Paid Active" value={activePaid} />
        </section>

        <AdminBusinessesClient
          initialBusinesses={businesses}
          mosques={mosques}
          selectedMosqueId={selectedMosqueId}
          selectedPlan={selectedPlan}
        />

        <BusinessReviewQueueClient />
      </div>
    </AdminGate>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="luxe-card-soft rounded-2xl p-5">
      <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
        {title}
      </div>

      <div className="mt-3 text-3xl font-black text-white">{value}</div>
    </div>
  );
}

