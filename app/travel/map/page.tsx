import TravelMapView from "@/components/TravelMapView";

export const dynamic = "force-dynamic";

export default function TravelMapPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Map View
        </div>

        <h1 className="mt-3 text-4xl font-bold text-white">
          Mosques and halal places near you
        </h1>

        <p className="mt-3 max-w-3xl text-white/70">
          Free OpenStreetMap-powered travel map. No Google Maps charges.
        </p>
      </section>

      <TravelMapView />
    </div>
  );
}

