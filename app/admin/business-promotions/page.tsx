import { supabaseServer } from "@/lib/supabaseServer";
import AdminBusinessesClient from "@/components/AdminBusinessesClient";

export const revalidate = 0;

type PageProps = {
  searchParams: Promise<{
    mosque?: string;
    plan?: string;
  }>;
};

export default async function AdminBusinessPromotionsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const selectedMosqueId = params.mosque ?? "";
  const selectedPlan = params.plan ?? "";
  const supabase = await supabaseServer();

  const [
    { data: businesses, error: businessesError },
    { data: mosques, error: mosquesError },
  ] = await Promise.all([
    supabase
      .from("businesses")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),

    supabase
      .from("mosques")
      .select("id,name,area,postcode,city")
      .order("name", { ascending: true })
      .limit(500),
  ]);

  if (businessesError) {
    return <pre className="text-white/80">{businessesError.message}</pre>;
  }

  if (mosquesError) {
    return <pre className="text-white/80">{mosquesError.message}</pre>;
  }

  return (
    <AdminBusinessesClient
      initialBusinesses={businesses ?? []}
      mosques={mosques ?? []}
      selectedMosqueId={selectedMosqueId}
      selectedPlan={selectedPlan}
    />
  );
}

