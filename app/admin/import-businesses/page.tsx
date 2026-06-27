import { supabasePublic } from "@/lib/supabaseServer";
import OsmBulkImportPanel from "@/components/OsmBulkImportPanel";

export const revalidate = 0;

type CityRow = {
  slug: string;
  name: string;
  country: string | null;
};

export default async function ImportBusinessesPage() {
  const supabase = supabasePublic();

  const { data, error } = await supabase
    .from("cities")
    .select("slug,name,country")
    .eq("is_active", true)
    .order("country", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return <pre className="text-white/80">{error.message}</pre>;
  }

  return (
    <div className="space-y-8">
      <OsmBulkImportPanel
        entity="businesses"
        cities={(data ?? []) as CityRow[]}
      />
    </div>
  );
}

