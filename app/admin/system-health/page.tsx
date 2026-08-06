import type { Metadata } from "next";

import SystemHealthDashboard from "@/components/operations-centre/SystemHealthDashboard";

export const metadata: Metadata = {
  title:
    "Operations Centre | SalahNearMe Admin",
  description:
    "Internal SalahNearMe platform health, monitoring, alerts and operational intelligence.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function SystemHealthPage() {
  return (
    <main className="min-h-screen bg-[#020617] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px]">
        <SystemHealthDashboard />
      </div>
    </main>
  );
}