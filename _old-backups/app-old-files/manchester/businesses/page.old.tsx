import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const revalidate = 0;

export default async function BusinessesPage() {
  const { data, error } = await supabase
    .from("businesses")
    .select("name,category,area,website,phone,is_featured")
    .eq("city", "Manchester")
    .order("is_featured", { ascending: false })
    .order("name", { ascending: true });

  if (error) return <pre className="text-white/80">{error.message}</pre>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Halal Businesses (Manchester)</h1>
      <p className="text-sm text-white/70">
        Local halal businesses support the platform so mosques stay free.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((b: any, idx: number) => (
          <div key={idx} className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="font-semibold">{b.name}</div>
              {b.is_featured && (
                <span className="rounded-full bg-amber-300 px-2 py-1 text-[10px] font-semibold text-neutral-950">
                  Featured
                </span>
              )}
            </div>
            <div className="mt-2 text-sm text-white/70">
              {[b.category, b.area].filter(Boolean).join(" • ")}
            </div>

            <div className="mt-3 text-xs text-white/60 space-y-1">
              {b.phone && <div>📞 {b.phone}</div>}
              {b.website && (
                <div>
                  🌐 <a className="underline" target="_blank" rel="noreferrer" href={b.website}>{b.website}</a>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

