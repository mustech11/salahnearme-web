import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { decideBusinessQuality } from "@/lib/businessImportQuality";

type CityRow = {
  id: number;
  name: string;
  slug: string;
  country: string | null;
  country_code: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
};

type MosqueAnchor = {
  id: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
};

type OverpassElement = {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

type GooglePlace = {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  primaryType?: string;
  types?: string[];
};

type GoogleTextSearchResponse = {
  places?: GooglePlace[];
};

type HalalClassification = {
  include: boolean;
  confidence: "high" | "medium" | "low";
  score: number;
  category: string;
  signals: string[];
  notes: string | null;
};

type HybridSourceRow = {
  source: "osm" | "google";
  uniqueKey: string;
  osmType: string | null;
  osmId: number | null;
  googlePlaceId: string | null;
  name: string;
  area: string | null;
  address: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  phone: string | null;
  mapsUrl: string | null;
  matchedQuery: string;
  classification: HalalClassification;
};

export type ImportBusinessesResult = {
  success: true;
  city: string;
  radiusMeters: number;
  minConfidence: string;
  raw_matches: number;
  found: number;
  inserted: number;
  skipped: number;
  invalid: number;
  auto_approved: number;
  needs_review: number;
  auto_rejected: number;
  source_breakdown: {
    osm_raw: number;
    google_raw: number;
    osm_used: number;
    google_used: number;
  };
};

const GOOGLE_PLACES_API_URL =
  "https://places.googleapis.com/v1/places:searchText";

const GOOGLE_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.location",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.primaryType",
  "places.types",
].join(",");

const OSM_CITY_SCAN_TIMEOUT = 45;
const OSM_CLUSTER_SCAN_TIMEOUT = 25;
const OSM_CLUSTER_RADIUS_METERS = 700;
const OSM_MAX_MOSQUE_CLUSTER_SCANS = 20;
const OSM_CLUSTER_DELAY_MS = 300;
const GOOGLE_QUERY_DELAY_MS = 250;
const OSM_ACCEPTED_THRESHOLD = 8;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalize(text: string | null | undefined) {
  return (text ?? "").toLowerCase().trim();
}

function normalizeForDedup(text: string | null | undefined) {
  return normalize(text).replace(/[^a-z0-9]/g, "");
}

function buildSlug(name: string, citySlug: string, sourceId: string) {
  return `${slugify(`${name}-${citySlug}`)}-${slugify(sourceId).slice(0, 24)}`;
}

function containsAny(text: string, values: string[]) {
  return values.some((v) => text.includes(v));
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const radiusKm = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * radiusKm * Math.asin(Math.sqrt(a));
}

function getDistanceFromCityKm(city: CityRow, lat: number | null, lng: number | null) {
  if (
    typeof city.latitude !== "number" ||
    typeof city.longitude !== "number" ||
    typeof lat !== "number" ||
    typeof lng !== "number"
  ) {
    return null;
  }

  return haversineKm(city.latitude, city.longitude, lat, lng);
}

function getNearestMosqueDistanceKm(
  latitude: number | null,
  longitude: number | null,
  mosques: MosqueAnchor[]
) {
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;

  let best: number | null = null;

  for (const mosque of mosques) {
    if (
      typeof mosque.latitude !== "number" ||
      typeof mosque.longitude !== "number"
    ) {
      continue;
    }

    const distance = haversineKm(
      latitude,
      longitude,
      mosque.latitude,
      mosque.longitude
    );

    if (best === null || distance < best) best = distance;
  }

  return best;
}

function inferCategoryFromText(all: string) {
  if (containsAny(all, ["butcher", "meat"])) return "halal_butcher";

  if (
    containsAny(all, [
      "supermarket",
      "grocery",
      "convenience",
      "grocery_store",
      "convenience_store",
      "food store",
    ])
  ) {
    return "halal_grocery";
  }

  if (
    containsAny(all, [
      "book_store",
      "bookstore",
      "book shop",
      "quran",
      "islamic bookstore",
    ])
  ) {
    return "islamic_bookstore";
  }

  if (
    containsAny(all, [
      "clothing_store",
      "abaya",
      "hijab",
      "thobe",
      "jubbah",
      "modest fashion",
    ])
  ) {
    return "muslim_clothing";
  }

  if (
    containsAny(all, [
      "takeaway",
      "meal_takeaway",
      "fast_food",
      "kebab",
      "shawarma",
      "grill",
      "chicken",
      "pizza",
    ])
  ) {
    return "halal_takeaway";
  }

  if (
    containsAny(all, [
      "restaurant",
      "cafe",
      "biryani",
      "karahi",
      "nihari",
      "diner",
    ])
  ) {
    return "halal_restaurant";
  }

  return "halal_business";
}

function classifyHalalFromStrings(args: {
  name: string;
  extra: string;
  matchedQuery: string;
  nearestMosqueDistanceKm: number | null;
}): HalalClassification {
  const signals: string[] = [];
  const name = normalize(args.name);
  const extra = normalize(args.extra);
  const matchedQuery = normalize(args.matchedQuery);
  const combined = `${name} ${extra} ${matchedQuery}`;

  let score = 0;

  if (matchedQuery.includes("halal")) {
    score += 5;
    signals.push("matched-halal-query");
  }

  if (name.includes("halal")) {
    score += 10;
    signals.push("name:halal");
  }

  if (
    containsAny(combined, [
      "pakistani",
      "indian",
      "bangladeshi",
      "afghan",
      "turkish",
      "arab",
      "middle eastern",
      "persian",
      "lebanese",
      "shawarma",
      "kebab",
      "biryani",
      "karahi",
      "nihari",
      "desi",
      "madina",
      "medina",
      "makkah",
      "mecca",
      "makka",
      "islamic",
      "muslim",
      "ummah",
      "noor",
      "nur",
      "deen",
      "barakah",
      "rahma",
      "rahmah",
      "zamzam",
      "safa",
      "marwa",
      "abaya",
      "hijab",
      "jubbah",
      "thobe",
      "quran",
      "halal meat",
      "butcher",
    ])
  ) {
    score += 5;
    signals.push("muslim-keywords");
  }

  if (containsAny(combined, ["restaurant", "fast_food", "cafe", "takeaway"])) {
    score += 2;
    signals.push("food-type");
  }

  if (containsAny(combined, ["supermarket", "grocery", "convenience"])) {
    score += 2;
    signals.push("grocery-type");
  }

  if (containsAny(combined, ["butcher", "meat"])) {
    score += 5;
    signals.push("butcher-pattern");
  }

  if (args.nearestMosqueDistanceKm !== null) {
    if (args.nearestMosqueDistanceKm <= 0.25) {
      score += 4;
      signals.push("near-mosque:250m");
    } else if (args.nearestMosqueDistanceKm <= 0.5) {
      score += 3;
      signals.push("near-mosque:500m");
    } else if (args.nearestMosqueDistanceKm <= 1) {
      score += 2;
      signals.push("near-mosque:1km");
    }
  }

  let confidence: "high" | "medium" | "low" = "low";
  let include = false;

  if (score >= 11) {
    confidence = "high";
    include = true;
  } else if (score >= 7) {
    confidence = "medium";
    include = true;
  } else if (score >= 4) {
    confidence = "low";
    include = true;
  }

  return {
    include,
    confidence,
    score,
    category: inferCategoryFromText(combined),
    signals: Array.from(new Set(signals)),
    notes:
      args.nearestMosqueDistanceKm !== null
        ? `Hybrid importer score ${score}; nearest mosque ${args.nearestMosqueDistanceKm.toFixed(
            2
          )}km`
        : `Hybrid importer score ${score}`,
  };
}

function buildGoogleMapsUrl(
  latitude: number | null,
  longitude: number | null,
  label: string
) {
  if (typeof latitude === "number" && typeof longitude === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    label
  )}`;
}

function parsePostcode(address: string | null | undefined) {
  if (!address) return null;
  const uk = address.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i);
  return uk?.[1] ? uk[1].toUpperCase() : null;
}

function extractAreaFromAddress(address: string | null, cityName: string) {
  if (!address) return null;

  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const cityLower = cityName.toLowerCase();

  const area = parts.find((part) => {
    const lower = part.toLowerCase();
    return (
      lower !== cityLower &&
      !lower.includes("united kingdom") &&
      !lower.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i)
    );
  });

  return area ?? null;
}

async function geocodeCityFallback(city: CityRow) {
  const q = [city.name, city.country].filter(Boolean).join(", ");
  if (!q) return null;

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(
    q
  )}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "SalahNearMe/1.0 admin-importer",
    },
    cache: "no-store",
  });

  if (!res.ok) return null;

  const rows = (await res.json()) as Array<{ lat: string; lon: string }>;
  const first = rows[0];
  if (!first) return null;

  const latitude = Number(first.lat);
  const longitude = Number(first.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  await supabaseAdmin
    .from("cities")
    .update({ latitude, longitude })
    .eq("id", city.id);

  return { latitude, longitude };
}

async function getCityOrThrow(citySlug: string): Promise<CityRow> {
  const { data, error } = await supabaseAdmin
    .from("cities")
    .select("id,name,slug,country,country_code,timezone,latitude,longitude")
    .eq("slug", citySlug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("City not found");

  const city = data as CityRow;

  if (
    typeof city.latitude === "number" &&
    typeof city.longitude === "number"
  ) {
    return city;
  }

  const fallback = await geocodeCityFallback(city);

  if (!fallback) {
    throw new Error(
      "City is missing latitude/longitude and fallback geocoding failed"
    );
  }

  return {
    ...city,
    latitude: fallback.latitude,
    longitude: fallback.longitude,
  };
}

async function getMosqueAnchors(cityName: string) {
  const { data, error } = await supabaseAdmin
    .from("mosques")
    .select("id,name,latitude,longitude")
    .eq("city", cityName)
    .eq("is_active", true)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .limit(200);

  if (error) throw new Error(error.message);

  return (data ?? []) as MosqueAnchor[];
}

function buildOsmCityQuery(latitude: number, longitude: number, radiusMeters: number) {
  return `
[out:json][timeout:${OSM_CITY_SCAN_TIMEOUT}];
(
  node(around:${radiusMeters},${latitude},${longitude})["amenity"~"restaurant|fast_food|cafe",i];
  way(around:${radiusMeters},${latitude},${longitude})["amenity"~"restaurant|fast_food|cafe",i];
  relation(around:${radiusMeters},${latitude},${longitude})["amenity"~"restaurant|fast_food|cafe",i];

  node(around:${radiusMeters},${latitude},${longitude})["shop"~"butcher|supermarket|convenience|grocery|clothes|books",i];
  way(around:${radiusMeters},${latitude},${longitude})["shop"~"butcher|supermarket|convenience|grocery|clothes|books",i];
  relation(around:${radiusMeters},${latitude},${longitude})["shop"~"butcher|supermarket|convenience|grocery|clothes|books",i];
);
out center tags;
`.trim();
}

function buildOsmClusterQuery(latitude: number, longitude: number, radiusMeters: number) {
  return `
[out:json][timeout:${OSM_CLUSTER_SCAN_TIMEOUT}];
(
  node(around:${radiusMeters},${latitude},${longitude})["amenity"~"restaurant|fast_food|cafe",i];
  way(around:${radiusMeters},${latitude},${longitude})["amenity"~"restaurant|fast_food|cafe",i];
  relation(around:${radiusMeters},${latitude},${longitude})["amenity"~"restaurant|fast_food|cafe",i];

  node(around:${radiusMeters},${latitude},${longitude})["shop"~"butcher|supermarket|convenience|grocery|clothes|books",i];
  way(around:${radiusMeters},${latitude},${longitude})["shop"~"butcher|supermarket|convenience|grocery|clothes|books",i];
  relation(around:${radiusMeters},${latitude},${longitude})["shop"~"butcher|supermarket|convenience|grocery|clothes|books",i];
);
out center tags;
`.trim();
}

async function tryOverpassEndpoint(endpoint: string, query: string) {
  const body = new URLSearchParams({ data: query }).toString();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "application/json",
      "User-Agent": "SalahNearMe/1.0 admin-importer",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  return (await response.json()) as OverpassResponse;
}

async function fetchOverpass(query: string): Promise<OverpassResponse> {
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
  ];

  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      return await tryOverpassEndpoint(endpoint, query);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `All Overpass endpoints failed. Last error: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

function pickOsmName(tags?: Record<string, string>) {
  if (!tags) return null;
  return (
    tags["name:en"] ||
    tags.name ||
    tags.official_name ||
    tags.brand ||
    tags.operator ||
    null
  );
}

function pickOsmAddress(tags?: Record<string, string>) {
  if (!tags) return null;

  const houseNumber = tags["addr:housenumber"];
  const street = tags["addr:street"];
  const unit = tags["addr:unit"];
  const city = tags["addr:city"];
  const postcode = tags["addr:postcode"];

  const composed = [unit, houseNumber, street, city, postcode]
    .filter(Boolean)
    .join(", ")
    .trim();

  return composed || tags["addr:full"] || tags["contact:address"] || null;
}

function pickOsmPostcode(tags?: Record<string, string>) {
  return tags?.["addr:postcode"] ?? null;
}

function pickOsmPhone(tags?: Record<string, string>) {
  return tags?.phone || tags?.["contact:phone"] || null;
}

function pickOsmWebsite(tags?: Record<string, string>) {
  return tags?.website || tags?.["contact:website"] || null;
}

function pickOsmCoordinates(element: OverpassElement) {
  if (typeof element.lat === "number" && typeof element.lon === "number") {
    return { latitude: element.lat, longitude: element.lon };
  }

  if (
    element.center &&
    typeof element.center.lat === "number" &&
    typeof element.center.lon === "number"
  ) {
    return { latitude: element.center.lat, longitude: element.center.lon };
  }

  return { latitude: null, longitude: null };
}

async function importOsmCandidates(args: {
  city: CityRow;
  mosques: MosqueAnchor[];
  radiusMeters: number;
  acceptedConfidence: Set<string>;
}) {
  const { city, mosques, radiusMeters, acceptedConfidence } = args;

  const seenRaw = new Set<string>();
  const rows: HybridSourceRow[] = [];
  let rawMatches = 0;
  let invalid = 0;

  const cityScan = await fetchOverpass(
    buildOsmCityQuery(city.latitude as number, city.longitude as number, radiusMeters)
  );

  const allElements: OverpassElement[] = [];

  for (const element of cityScan.elements ?? []) {
    const key = `${element.type}:${element.id}`;
    if (seenRaw.has(key)) continue;
    seenRaw.add(key);
    allElements.push(element);
  }

  const mosqueScans = mosques
    .filter(
      (m) =>
        typeof m.latitude === "number" &&
        typeof m.longitude === "number"
    )
    .slice(0, OSM_MAX_MOSQUE_CLUSTER_SCANS);

  for (const mosque of mosqueScans) {
    const clusterScan = await fetchOverpass(
      buildOsmClusterQuery(
        mosque.latitude as number,
        mosque.longitude as number,
        OSM_CLUSTER_RADIUS_METERS
      )
    );

    for (const element of clusterScan.elements ?? []) {
      const key = `${element.type}:${element.id}`;
      if (seenRaw.has(key)) continue;
      seenRaw.add(key);
      allElements.push(element);
    }

    await sleep(OSM_CLUSTER_DELAY_MS);
  }

  for (const element of allElements) {
    rawMatches++;

    const tags = element.tags ?? {};
    const name = pickOsmName(tags);

    if (!name) {
      invalid++;
      continue;
    }

    const { latitude, longitude } = pickOsmCoordinates(element);
    const address = pickOsmAddress(tags);
    const postcode = pickOsmPostcode(tags) ?? parsePostcode(address);
    const phone = pickOsmPhone(tags);
    const website = pickOsmWebsite(tags);
    const area = tags["addr:suburb"] || tags["addr:district"] || null;

    const nearestMosqueDistanceKm = getNearestMosqueDistanceKm(
      latitude,
      longitude,
      mosques
    );

    const extra = [
      tags.amenity,
      tags.shop,
      tags.cuisine,
      tags.description,
      tags.brand,
      tags.operator,
      tags["diet:halal"],
      tags["halal"],
      address,
    ]
      .filter(Boolean)
      .join(" ");

    const classification = classifyHalalFromStrings({
      name,
      extra,
      matchedQuery: "osm broad poi import",
      nearestMosqueDistanceKm,
    });

    if (!classification.include) continue;
    if (!acceptedConfidence.has(classification.confidence)) continue;

    rows.push({
      source: "osm",
      uniqueKey: `osm:${element.type}:${element.id}`,
      osmType: element.type,
      osmId: element.id,
      googlePlaceId: null,
      name,
      area,
      address,
      postcode,
      latitude,
      longitude,
      website,
      phone,
      mapsUrl: buildGoogleMapsUrl(latitude, longitude, name),
      matchedQuery: "osm broad poi import",
      classification,
    });
  }

  return { rows, rawMatches, invalid };
}

async function googleTextSearch(args: {
  textQuery: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GOOGLE_PLACES_API_KEY in environment");
  }

  const body = {
    textQuery: args.textQuery,
    maxResultCount: 20,
    languageCode: "en",
    locationBias: {
      circle: {
        center: {
          latitude: args.latitude,
          longitude: args.longitude,
        },
        radius: args.radiusMeters,
      },
    },
  };

  const res = await fetch(GOOGLE_PLACES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": GOOGLE_FIELD_MASK,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as
    | GoogleTextSearchResponse
    | { error?: { message?: string } };

  if (!res.ok) {
    const message =
      "error" in data && data.error?.message
        ? data.error.message
        : `Google Places request failed with status ${res.status}`;
    throw new Error(message);
  }

  if (!("places" in data)) return [];
  return data.places ?? [];
}

async function importGoogleCandidates(args: {
  city: CityRow;
  mosques: MosqueAnchor[];
  radiusMeters: number;
  acceptedConfidence: Set<string>;
}) {
  const { city, mosques, radiusMeters, acceptedConfidence } = args;

  const queries = [
    `halal restaurant in ${city.name}`,
    `halal takeaway in ${city.name}`,
    `halal food in ${city.name}`,
    `halal butcher in ${city.name}`,
    `halal supermarket in ${city.name}`,
    `halal grocery in ${city.name}`,
    `islamic clothing in ${city.name}`,
    `islamic bookstore in ${city.name}`,
  ];

  const seenPlaceIds = new Set<string>();
  const rows: HybridSourceRow[] = [];
  let rawMatches = 0;
  let invalid = 0;

  for (const query of queries) {
    const places = await googleTextSearch({
      textQuery: query,
      latitude: city.latitude as number,
      longitude: city.longitude as number,
      radiusMeters,
    });

    for (const place of places) {
      rawMatches++;

      if (!place.id) {
        invalid++;
        continue;
      }

      if (seenPlaceIds.has(place.id)) continue;
      seenPlaceIds.add(place.id);

      const name = place.displayName?.text?.trim() ?? null;

      if (!name) {
        invalid++;
        continue;
      }

      const latitude = place.location?.latitude ?? null;
      const longitude = place.location?.longitude ?? null;
      const address =
        place.formattedAddress ?? place.shortFormattedAddress ?? null;
      const postcode = parsePostcode(address);
      const phone =
        place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? null;
      const website = place.websiteUri ?? null;
      const mapsUrl = place.googleMapsUri ?? null;
      const area = extractAreaFromAddress(address, city.name);

      const nearestMosqueDistanceKm = getNearestMosqueDistanceKm(
        latitude,
        longitude,
        mosques
      );

      const extra = [place.primaryType, ...(place.types ?? []), address]
        .filter(Boolean)
        .join(" ");

      const classification = classifyHalalFromStrings({
        name,
        extra,
        matchedQuery: query,
        nearestMosqueDistanceKm,
      });

      if (!classification.include) continue;
      if (!acceptedConfidence.has(classification.confidence)) continue;

      rows.push({
        source: "google",
        uniqueKey: `google:${place.id}`,
        osmType: null,
        osmId: null,
        googlePlaceId: place.id,
        name,
        area,
        address,
        postcode,
        latitude,
        longitude,
        website,
        phone,
        mapsUrl,
        matchedQuery: query,
        classification,
      });
    }

    await sleep(GOOGLE_QUERY_DELAY_MS);
  }

  return { rows, rawMatches, invalid };
}

function dedupeHybridRows(rows: HybridSourceRow[]) {
  const byUnique = new Map<string, HybridSourceRow>();
  const byLoose = new Map<string, HybridSourceRow>();

  function scoreValue(row: HybridSourceRow) {
    const confidenceBonus =
      row.classification.confidence === "high"
        ? 100
        : row.classification.confidence === "medium"
          ? 50
          : 10;

    const sourceBonus = row.source === "google" ? 5 : 0;

    return row.classification.score + confidenceBonus + sourceBonus;
  }

  for (const row of rows) {
    if (!byUnique.has(row.uniqueKey)) {
      byUnique.set(row.uniqueKey, row);
    }
  }

  for (const row of Array.from(byUnique.values())) {
    const looseKey = [
      normalizeForDedup(row.name),
      normalizeForDedup(row.address),
      normalizeForDedup(row.postcode),
    ].join("|");

    const existing = byLoose.get(looseKey);

    if (!existing || scoreValue(row) > scoreValue(existing)) {
      byLoose.set(looseKey, row);
    }
  }

  return Array.from(byLoose.values());
}

async function rowExists(cityName: string, row: HybridSourceRow) {
  if (row.googlePlaceId) {
    const { data, error } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("google_place_id", row.googlePlaceId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return true;
  }

  if (row.osmType && typeof row.osmId === "number") {
    const { data, error } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("osm_type", row.osmType)
      .eq("osm_id", row.osmId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return true;
  }

  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("id,name,address,postcode")
    .eq("city", cityName)
    .limit(500);

  if (error) throw new Error(error.message);

  const rowName = normalizeForDedup(row.name);
  const rowAddress = normalizeForDedup(row.address);
  const rowPostcode = normalizeForDedup(row.postcode);

  return (data ?? []).some((b) => {
    const existing = b as {
      name?: string | null;
      address?: string | null;
      postcode?: string | null;
    };

    const bName = normalizeForDedup(existing.name);
    const bAddress = normalizeForDedup(existing.address);
    const bPostcode = normalizeForDedup(existing.postcode);

    return (
      rowName &&
      bName &&
      rowName === bName &&
      ((rowAddress && bAddress && rowAddress === bAddress) ||
        (rowPostcode && bPostcode && rowPostcode === bPostcode))
    );
  });
}

export async function importBusinessesForCity(args: {
  citySlug: string;
  radiusMeters: number;
  minConfidence: string;
}): Promise<ImportBusinessesResult> {
  const { citySlug, radiusMeters, minConfidence } = args;

  const city = await getCityOrThrow(citySlug);
  const mosques = await getMosqueAnchors(city.name);

  const acceptedConfidence =
    minConfidence === "high"
      ? new Set(["high"])
      : minConfidence === "low"
        ? new Set(["high", "medium", "low"])
        : new Set(["high", "medium"]);

  let osmRows: HybridSourceRow[] = [];
  let osmRawMatches = 0;
  let osmInvalid = 0;

  try {
    const osmResult = await importOsmCandidates({
      city,
      mosques,
      radiusMeters,
      acceptedConfidence,
    });

    osmRows = osmResult.rows;
    osmRawMatches = osmResult.rawMatches;
    osmInvalid = osmResult.invalid;
  } catch {
    osmRows = [];
    osmRawMatches = 0;
    osmInvalid = 0;
  }

  let googleRows: HybridSourceRow[] = [];
  let googleRawMatches = 0;
  let googleInvalid = 0;

  if (osmRows.length < OSM_ACCEPTED_THRESHOLD) {
    const googleResult = await importGoogleCandidates({
      city,
      mosques,
      radiusMeters,
      acceptedConfidence,
    });

    googleRows = googleResult.rows;
    googleRawMatches = googleResult.rawMatches;
    googleInvalid = googleResult.invalid;
  }

  const mergedRows = dedupeHybridRows([...osmRows, ...googleRows]);

  let inserted = 0;
  let skipped = 0;
  let autoApproved = 0;
  let needsReview = 0;
  let autoRejected = 0;
  let osmUsed = 0;
  let googleUsed = 0;

  for (const row of mergedRows) {
    const exists = await rowExists(city.name, row);

    if (exists) {
      skipped++;
      continue;
    }

    const distanceKm = getDistanceFromCityKm(
      city,
      row.latitude,
      row.longitude
    );

    const quality = decideBusinessQuality({
      name: row.name,
      category: row.classification.category,
      halal_confidence: row.classification.confidence,
      halal_score: row.classification.score,
      distance_km: distanceKm,
      imported_for_city: city.name,
      address: row.address,
    });

    if (quality.quality_status === "auto_approved") autoApproved++;
    if (quality.quality_status === "needs_review") needsReview++;
    if (quality.quality_status === "auto_rejected") autoRejected++;

    const sourceId =
      row.googlePlaceId ?? `${row.osmType ?? "osm"}-${String(row.osmId)}`;

    const { error } = await supabaseAdmin.from("businesses").insert({
      id: randomUUID(),
      name: row.name,
      slug: buildSlug(row.name, city.slug, sourceId),
      category: row.classification.category,
      city: city.name,
      area: row.area,
      address: row.address,
      postcode: row.postcode,
      latitude: row.latitude,
      longitude: row.longitude,
      website: row.website,
      phone: row.phone,
      maps_url:
        row.mapsUrl ?? buildGoogleMapsUrl(row.latitude, row.longitude, row.name),

      country: city.country,
      country_code: city.country_code,
      timezone: city.timezone,

      is_verified: false,
      featured: false,
      pricing_tier: "free",
      is_active: true,

      google_place_id: row.googlePlaceId,
      osm_type: row.osmType,
      osm_id: row.osmId,

      halal_confidence: row.classification.confidence,
      halal_score: row.classification.score,
      halal_signals: row.classification.signals,

      import_source:
        row.source === "google"
          ? "hybrid_google_places_fallback"
          : "hybrid_openstreetmap_primary",
      import_notes: row.classification.notes,
      import_distance_km: distanceKm,
      imported_for_city: city.name,

      review_status: quality.review_status,
      is_live: quality.is_live,
      quality_status: quality.quality_status,
      quality_reason: quality.quality_reason,
    });

    if (error) throw new Error(error.message);

    if (row.source === "osm") osmUsed++;
    if (row.source === "google") googleUsed++;

    inserted++;
  }

  return {
    success: true,
    city: city.slug,
    radiusMeters,
    minConfidence,
    raw_matches: osmRawMatches + googleRawMatches,
    found: mergedRows.length,
    inserted,
    skipped,
    invalid: osmInvalid + googleInvalid,
    auto_approved: autoApproved,
    needs_review: needsReview,
    auto_rejected: autoRejected,
    source_breakdown: {
      osm_raw: osmRawMatches,
      google_raw: googleRawMatches,
      osm_used: osmUsed,
      google_used: googleUsed,
    },
  };
}

