import Link from "next/link";
import TravelNearMeClient from "@/components/TravelNearMeClient";
import NearMeHalalBusinessesClient from "@/components/NearMeHalalBusinessesClient";

export const revalidate = 0;

export default function TravelNearMePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Travel Near Me
        </div>

        <h1 className="mt-3 text-4xl font-bold text-white">
          Find Muslim essentials near you
        </h1>

        <p className="mt-3 max-w-3xl text-white/70">
          Use your current location to discover nearby mosques, halal
          businesses, and trusted Muslim essentials wherever you are.
        </p>

        <div className="mt-6">
          <Link
            href="/travel"
            className="text-sm font-medium text-yellow-400 hover:text-yellow-300"
          >
            ← Back to travel
          </Link>
        </div>
      </section>

      <TravelNearMeClient />

      <NearMeHalalBusinessesClient />
    </div>
  );
}

