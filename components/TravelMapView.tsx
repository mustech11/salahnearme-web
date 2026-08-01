"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

type Filter = "all" | "mosques" | "businesses";

type LeafletMap = {
  setView: (coordinates: [number, number], zoom: number) => LeafletMap;
  remove: () => void;
  invalidateSize: () => void;
  fitBounds: (bounds: unknown, options?: Record<string, unknown>) => void;
};

type LeafletLayerGroup = {
  clearLayers: () => void;
};

type LeafletGlobal = {
  map: (element: HTMLElement) => LeafletMap;
  tileLayer: (
    url: string,
    options: Record<string, unknown>
  ) => { addTo: (map: LeafletMap) => unknown };
  layerGroup: () => { addTo: (map: LeafletMap) => LeafletLayerGroup };
  marker: (
    coordinates: [number, number]
  ) => {
    addTo: (layer: LeafletLayerGroup) => {
      bindPopup: (content: string) => unknown;
    };
  };
  circle: (
    coordinates: [number, number],
    options: Record<string, unknown>
  ) => { addTo: (layer: LeafletLayerGroup) => unknown };
  latLngBounds: (coordinates: [number, number][]) => unknown;
};

declare global {
  interface Window {
    L?: LeafletGlobal;
  }
}

const LEAFLET_CSS =
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS =
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const REQUEST_TIMEOUT_MS = 20_000;

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function miles(meters: number): string {
  const value =
    typeof meters === "number" && Number.isFinite(meters)
      ? Math.max(0, meters)
      : 0;

  return (value / 1609.344).toFixed(1);
}

function itemHref(item: MapItem): string | null {
  const slug = cleanText(item.slug);

  if (!slug) return null;

  return item.type === "mosque"
    ? `/mosque/${encodeURIComponent(slug)}`
    : `/business/${encodeURIComponent(slug)}`;
}

function escapeHtml(value: unknown): string {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function loadLeaflet(): Promise<LeafletGlobal> {
  if (window.L) {
    return Promise.resolve(window.L);
  }

  return new Promise((resolve, reject) => {
    let css = document.querySelector<HTMLLinkElement>(
      'link[data-salahnearme-leaflet="true"]'
    );

    if (!css) {
      css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = LEAFLET_CSS;
      css.dataset.salahnearmeLeaflet = "true";
      document.head.appendChild(css);
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-salahnearme-leaflet="true"]'
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (window.L) resolve(window.L);
      });
      existingScript.addEventListener("error", () =>
        reject(new Error("Leaflet could not be loaded."))
      );
      return;
    }

    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.dataset.salahnearmeLeaflet = "true";
    script.onload = () => {
      if (window.L) {
        resolve(window.L);
      } else {
        reject(new Error("Leaflet did not initialise."));
      }
    };
    script.onerror = () => reject(new Error("Leaflet could not be loaded."));
    document.body.appendChild(script);
  });
}

export default function TravelMapView() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LeafletLayerGroup | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radius, setRadius] = useState(8_000);
  const [mosques, setMosques] = useState<MapItem[]>([]);
  const [businesses, setBusinesses] = useState<MapItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const visibleItems = useMemo(
    () => [
      ...(filter === "all" || filter === "mosques" ? mosques : []),
      ...(filter === "all" || filter === "businesses" ? businesses : []),
    ],
    [businesses, filter, mosques]
  );

  useEffect(() => {
    let active = true;

    void loadLeaflet()
      .then(() => {
        if (active) setMapReady(true);
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "The map library could not be loaded."
          );
        }
      });

    return () => {
      active = false;
      abortControllerRef.current?.abort();

      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        markerLayerRef.current = null;
      }
    };
  }, []);

  const renderMap = useCallback(
    (
      centerLat: number,
      centerLng: number,
      items: MapItem[],
      nextRadius: number
    ) => {
      if (!mapRef.current || !window.L || !mapReady) return;

      const leaflet = window.L;

      if (!leafletMapRef.current) {
        leafletMapRef.current = leaflet
          .map(mapRef.current)
          .setView([centerLat, centerLng], 13);

        leaflet
          .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors",
            maxZoom: 19,
          })
          .addTo(leafletMapRef.current);

        markerLayerRef.current = leaflet
          .layerGroup()
          .addTo(leafletMapRef.current);
      }

      const map = leafletMapRef.current;
      const layer = markerLayerRef.current;

      if (!layer) return;

      layer.clearLayers();

      leaflet
        .circle([centerLat, centerLng], {
          radius: nextRadius,
          color: "#eab308",
          fillColor: "#eab308",
          fillOpacity: 0.08,
        })
        .addTo(layer);

      leaflet
        .marker([centerLat, centerLng])
        .addTo(layer)
        .bindPopup("<strong>You are here</strong>");

      const bounds: [number, number][] = [[centerLat, centerLng]];

      for (const item of items) {
        if (
          typeof item.latitude !== "number" ||
          typeof item.longitude !== "number" ||
          !Number.isFinite(item.latitude) ||
          !Number.isFinite(item.longitude)
        ) {
          continue;
        }

        bounds.push([item.latitude, item.longitude]);

        const emoji = item.type === "mosque" ? "🕌" : "🍽️";
        const href = itemHref(item);
        const detail = [item.category, item.area, item.city]
          .map(cleanText)
          .filter(Boolean)
          .join(" • ");

        const link = href
          ? `<a href="${escapeHtml(href)}">View details</a>`
          : "";

        leaflet
          .marker([item.latitude, item.longitude])
          .addTo(layer)
          .bindPopup(`
            <div style="min-width:180px">
              <strong>${emoji} ${escapeHtml(item.name) || "Place"}</strong><br/>
              ${escapeHtml(detail)}<br/>
              <small>${miles(item.distance_meters)} miles away</small><br/>
              ${link}
            </div>
          `);
      }

      if (bounds.length > 1) {
        map.fitBounds(leaflet.latLngBounds(bounds), {
          padding: [30, 30],
          maxZoom: 14,
        });
      } else {
        map.setView([centerLat, centerLng], 13);
      }

      window.setTimeout(() => map.invalidateSize(), 50);
    },
    [mapReady]
  );

  useEffect(() => {
    if (lat !== null && lng !== null) {
      renderMap(lat, lng, visibleItems, radius);
    }
  }, [lat, lng, radius, renderMap, visibleItems]);

  const loadMapData = useCallback(
    async (nextLat: number, nextLng: number, nextRadius: number) => {
      abortControllerRef.current?.abort();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      let timedOut = false;
      const timeoutId = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS);

      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          lat: String(nextLat),
          lng: String(nextLng),
          radius: String(nextRadius),
        });

        const response = await fetch(`/api/travel/map?${params.toString()}`, {
          headers: { Accept: "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        const data = (await response.json().catch(() => ({}))) as ApiResponse;

        if (!response.ok || data.ok !== true) {
          setError(cleanText(data.error) || "Could not load map results.");
          return;
        }

        setMosques(Array.isArray(data.mosques) ? data.mosques : []);
        setBusinesses(Array.isArray(data.businesses) ? data.businesses : []);
        setLastUpdatedAt(new Date());
      } catch (requestError) {
        setError(
          requestError instanceof DOMException &&
            requestError.name === "AbortError"
            ? timedOut
              ? "The map request timed out."
              : "The map request was cancelled."
            : "Could not load map results."
        );
      } finally {
        window.clearTimeout(timeoutId);

        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }

        setLoading(false);
      }
    },
    []
  );

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
            timeout: 15_000,
            maximumAge: 300_000,
          });
        }
      );

      const nextLat = position.coords.latitude;
      const nextLng = position.coords.longitude;

      setLat(nextLat);
      setLng(nextLng);

      await loadMapData(nextLat, nextLng, radius);
    } catch (locationError) {
      setLoading(false);
      setError(
        locationError instanceof Error
          ? locationError.message
          : "Could not access your current location."
      );
    }
  }

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xl font-black text-yellow-400">
            Live travel map
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
            View nearby mosques and halal businesses using your current
            location.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={radius}
            disabled={loading}
            onChange={(event) => setRadius(Number(event.target.value))}
            className="rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm text-white"
          >
            <option value={3000}>3 km</option>
            <option value={5000}>5 km</option>
            <option value={8000}>8 km</option>
            <option value={15000}>15 km</option>
          </select>

          <select
            value={filter}
            disabled={loading}
            onChange={(event) => setFilter(event.target.value as Filter)}
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
                void loadMapData(lat, lng, radius);
              } else {
                void getLocation();
              }
            }}
            disabled={loading || !mapReady}
            className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-black hover:bg-yellow-400 disabled:opacity-50"
          >
            {loading
              ? "Loading…"
              : mapReady
                ? "Use my location"
                : "Preparing map…"}
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
        >
          {error}
        </div>
      ) : null}

      {lastUpdatedAt ? (
        <p className="mt-3 text-xs text-white/35">
          Updated{" "}
          {lastUpdatedAt.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      ) : null}

      <div
        ref={mapRef}
        aria-label="Map showing nearby mosques and halal businesses"
        className="mt-6 h-[420px] overflow-hidden rounded-3xl border border-white/10 bg-black sm:h-[560px]"
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <ResultColumn title="Nearby Mosques" items={mosques} />
        <ResultColumn title="Nearby Halal Businesses" items={businesses} />
      </div>
    </section>
  );
}

function ResultColumn({
  title,
  items,
}: {
  title: string;
  items: MapItem[];
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-black text-yellow-400">{title}</h3>
        <span className="text-xs text-white/40">
          {items.length.toLocaleString("en-GB")}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {items.slice(0, 8).map((item) => {
          const href = itemHref(item);

          const card = (
            <>
              <div className="font-bold text-white">
                {cleanText(item.name) || "Unnamed place"}
              </div>
              <div className="mt-1 text-sm text-white/60">
                {[item.category, item.area, item.city]
                  .map(cleanText)
                  .filter(Boolean)
                  .join(" • ")}
              </div>
              <div className="mt-2 text-xs text-yellow-400">
                {miles(item.distance_meters)} miles away
              </div>
            </>
          );

          return href ? (
            <Link
              key={`${item.type}-${item.id}`}
              href={href}
              className="block rounded-xl border border-white/10 bg-black/40 p-4 transition hover:border-yellow-500/30"
            >
              {card}
            </Link>
          ) : (
            <div
              key={`${item.type}-${item.id}`}
              className="rounded-xl border border-white/10 bg-black/40 p-4"
            >
              {card}
            </div>
          );
        })}

        {items.length === 0 ? (
          <div className="text-sm text-white/50">No results found yet.</div>
        ) : null}
      </div>
    </section>
  );
}