import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";

export const revalidate = 0;

type ImportRunRow = {
  id: string;
  entity_type: "mosques" | "businesses";
  mode: "dry-run" | "confirm";
  file_name: string | null;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  insert_count: number;
  update_count: number;
  duplicate_candidates_queued: number;
  errors: Array<{
    row: number;
    message: string;
    data: Record<string, unknown>;
  }>;
  created_at: string;
};

export default async function AdminImportHistoryPage() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("import_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return <pre className="text-white/80">{error.message}</pre>;
  }

  const runs = (data ?? []) as ImportRunRow[];

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Admin
        </div>
        <h1 className="mt-3 text-4xl font-bold text-white">Import history</h1>
        <p className="mt-3 text-white/70">
          Review past imports, row counts, errors, and duplicate queue results.
        </p>

        <div className="mt-6">
          <Link
            href="/admin/import"
            className="text-sm font-medium text-yellow-400 hover:text-yellow-300"
          >
            ← Back to import
          </Link>
        </div>
      </section>

      {runs.length === 0 ? (
        <section className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-8 text-white/60">
          No import runs yet.
        </section>
      ) : (
        <div className="space-y-6">
          {runs.map((run) => (
            <section
              key={run.id}
              className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-2xl font-semibold text-white">
                      {run.entity_type} · {run.mode}
                    </div>

                    {run.file_name && (
                      <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
                        {run.file_name}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 text-sm text-white/50">
                    {new Date(run.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="text-xs text-white/40">{run.id}</div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-6">
                <Stat title="Rows" value={run.total_rows} />
                <Stat title="Valid" value={run.valid_rows} />
                <Stat title="Invalid" value={run.invalid_rows} />
                <Stat title="Insert" value={run.insert_count} />
                <Stat title="Update" value={run.update_count} />
                <Stat title="Duplicates" value={run.duplicate_candidates_queued} />
              </div>

              {run.errors?.length > 0 && (
                <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-5">
                  <div className="text-sm uppercase tracking-[0.2em] text-red-200">
                    Errors
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-red-100">
                    {run.errors.slice(0, 10).map((error, index) => (
                      <div key={`${run.id}-${index}`}>
                        Row {error.row}: {error.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
        {title}
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

