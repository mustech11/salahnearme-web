import Link from "next/link";
import LogoutButton from "@/components/auth/LogoutButton";
import { requireUser } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <header className="flex flex-col gap-4 rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
            Dashboard
          </div>
          <div className="mt-2 text-white/70">{user.email}</div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/business"
            className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
          >
            Business
          </Link>
          <Link
            href="/dashboard/business/billing"
            className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
          >
            Billing
          </Link>
          <LogoutButton />
        </div>
      </header>

      {children}
    </div>
  );
}

