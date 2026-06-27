import type { ReactNode } from "react";

import Link from "next/link";

import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

function AdminAccessDenied({
  message,
  status,
}: {
  message: string;
  status: number;
}) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8">
        <div className="text-sm uppercase tracking-[0.25em] text-red-300">
          Admin access denied
        </div>

        <h1 className="mt-3 text-3xl font-black text-white">
          Access restricted
        </h1>

        <p className="mt-3 text-sm leading-7 text-red-100/80">{message}</p>

        <div className="mt-5 text-xs text-red-100/50">Status: {status}</div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className="luxe-button text-sm">
            Return home
          </Link>

          <Link
            href="/business-dashboard"
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/80 hover:bg-white/10"
          >
            Business dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const permission = await requireAdmin();

  if (!permission.ok) {
    return (
      <AdminAccessDenied
        message={permission.error}
        status={permission.status}
      />
    );
  }

  return <>{children}</>;
}

