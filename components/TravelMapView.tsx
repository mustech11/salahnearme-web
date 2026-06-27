"use client";

import { useEffect, useRef, useState } from "react";

type MapItem = {
  type: "mosque" | "business";
  id: string;
  name: string | null;
  slug: string | null;
  category?: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_meters: number;
  verified_status?: string | null;
  is_verified?: boolean | null;
  featured?: boolean | null;
  halal_confidence?: string | null;
  maps_url?: string | null;
  website?: string | null;
  phone?: string | null;
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
  mosques?: MapItem[];
  businesses?: MapItem[];
};

declare global {
  interface Window {
    L: any;
  }
}

function miles(meters: number) {
  return (meters / 1609.344).toFixed(1);
}

function itemHref(item: MapItem) {
  if (!item.slug) return "#";
  return item.type === "mosque"
    ? `/mosque/${item.slug}`
    : `/business/${item.slug}`;
}

export default function TravelMapView() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);
  const markerLayerRef = useRef<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radius, setRadius] = useState(8000);
  const [mosques, setMosques] = useState<MapItem[]>([]);
  const [businesses, setBusinesses] = useState<MapItem[]>([]);
  const [filter, setFilter] = useState<"all" | "mosques" | "businesses">("all");

  useEffect(() => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      css.remove();
      script.remove();
    };
  }, []);

  async function getLocation() {
    setLoading(true);
    setError("");

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported on this device."));
            return;
          }

          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 300000,
          });
        }
      );

      const nextLat = position.coords.latitude;
      const nextLng = position.coords.longitude;

      setLat(nextLat);
      setLng(nextLng);

      await loadMapData(nextLat, nextLng, radius);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not access your current location."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadMapData(nextLat: number, nextLng: number, nextRadius: number) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/travel/map?lat=${nextLat}&lng=${nextLng}&radius=${nextRadius}`,
        { cache: "no-store" }
      );

      const data = (await res.json()) as ApiResponse;

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not load map results.");
        return;
      }

      setMosques(data.mosques ?? []);
      setBusinesses(data.businesses ?? []);

      setTimeout(() => {
        renderMap(nextLat, nextLng, data.mosques ?? [], data.businesses ?? []);
      }, 100);
    } finally {
      setLoading(false);
    }
  }

  function renderMap(
    centerLat: number,
    centerLng: number,
    mosqueItems: MapItem[],
    businessItems: MapItem[]
  ) {
    if (!mapRef.current || !window.L) return;

    const L = window.L;

    if (!leafletMapRef.current) {
      leafletMapRef.current = L.map(mapRef.current).setView(
        [centerLat, centerLng],
        13
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(leafletMapRef.current);

      markerLayerRef.current = L.layerGroup().addTo(leafletMapRef.current);
    }

    leafletMapRef.current.setView([centerLat, centerLng], 13);
    markerLayerRef.current.clearLayers();

    L.circle([centerLat, centerLng], {
      radius,
      color: "#eab308",
      fillColor: "#eab308",
      fillOpacity: 0.08,
    }).addTo(markerLayerRef.current);

    L.marker([centerLat, centerLng])
      .addTo(markerLayerRef.current)
      .bindPopup("<strong>You are here</strong>");

    const selectedItems = [
      ...(filter === "all" || filter === "mosques" ? mosqueItems : []),
      ...(filter === "all" || filter === "businesses" ? businessItems : []),
    ];

    for (const item of selectedItems) {
      if (
        typeof item.latitude !== "number" ||
        typeof item.longitude !== "number"
      ) {
        continue;
      }

      const emoji = item.type === "mosque" ? "🕌" : "🍽️";
      const href = itemHref(item);

      L.marker([item.latitude, item.longitude])
        .addTo(markerLayerRef.current)
        .bindPopup(`
          <div style="min-width:180px">
            <strong>${emoji} ${item.name ?? "Place"}</strong><br/>
            ${[item.category, item.area, item.city].filter(Boolean).join(" • ")}<br/>
            <small>${miles(item.distance_meters)} miles away</small><br/>
            <a href="${href}">View details</a>
          </div>
        `);
    }
  }

  useEffect(() => {
    if (lat !== null && lng !== null) {
      renderMap(lat, lng, mosques, businesses);
    }
  }, [filter]);

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xl font-semibold text-yellow-400">
            Live travel map
          </div>
          <p className="mt-2 text-sm text-white/60">
            Shows nearby mosques and halal businesses using your current
            location.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm text-white"
          >
            <option value={3000}>3 km</option>
            <option value={5000}>5 km</option>
            <option value={8000}>8 km</option>
            <option value={15000}>15 km</option>
          </select>

          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as "all" | "mosques" | "businesses")
            }
            className="rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm text-white"
          >
            <option value="all">Mosques + businesses</option>
            <option value="mosques">Mosques only</option>
            <option value="businesses">Businesses only</option>
          </select>

          <button
            type="button"
            onClick={() => {
              if (lat !== null && lng !== null) {
                loadMapData(lat, lng, radius);
              } else {
                getLocation();
              }
            }}
            disabled={loading}
            className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Use my location"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      <div
        ref={mapRef}
        className="mt-6 h-[560px] overflow-hidden rounded-3xl border border-white/10 bg-black"
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <ResultColumn title="Nearby Mosques" items={mosques} />
        <ResultColumn title="Nearby Halal Businesses" items={businesses} />
      </div>
    </section>
  );
}

function ResultColumn({ title, items }: { title: string; items: MapItem[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="text-lg font-semibold text-yellow-400">{title}</div>

      <div className="mt-4 space-y-3">
        {items.slice(0, 8).map((item) => (
          <a
            key={`${item.type}-${item.id}`}
            href={itemHref(item)}
            className="block rounded-xl border border-white/10 bg-black/40 p-4 hover:border-yellow-500/30"
          >
            <div className="font-semibold text-white">{item.name}</div>
            <div className="mt-1 text-sm text-white/60">
              {[item.category, item.area, item.city].filter(Boolean).join(" • ")}
            </div>
            <div className="mt-2 text-xs text-yellow-400">
              {miles(item.distance_meters)} miles away
            </div>
          </a>
        ))}

        {!items.length && (
          <div className="text-sm text-white/50">No results found yet.</div>
        )}
      </div>
    </div>
  );
}

