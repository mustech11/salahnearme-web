import Link from "next/link";
import ImportAdminClient from "@/components/ImportAdminClient";

export const revalidate = 0;

export default async function AdminImportPage() {
  return (
    <div className="space-y-8">
      <section className="luxe-card rounded-3xl p-8">
        <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
          Admin
        </div>

        <h1 className="mt-4 text-4xl font-black text-white">
          Bulk Import System
        </h1>

        <p className="mt-4 max-w-3xl text-white/70">
          Upload CSV files, validate rows, preview inserts and updates, then
          safely confirm imports into Supabase.
        </p>

        <div className="mt-6">
          <Link
            href="/admin"
            className="text-sm font-semibold text-yellow-400 hover:text-yellow-300"
          >
            ← Back to admin
          </Link>
        </div>
      </section>

      <ImportAdminClient />
    </div>
  );
}

