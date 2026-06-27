import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

type HalalClassification = {
  include: boolean;
  confidence: "high" | "medium" | "low";
  score: number;
  category: string;
  signals: string[];
  notes: string | null;
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
};

const MOSQUE_CLUSTER_RADIUS_METERS = 700;
const MAX_MOSQUE_CLUSTER_SCANS = 25;
const CLUSTER_DELAY_MS = 350;

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

function buildSlug(name: string, citySlug: string, osmType: string, osmId: number) {
  return `${slugify(`${name}-${citySlug}`)}-${osmType}-${osmId}`;
}

function normalize(text: string | null | undefined) {
  return (text ?? "").toLowerCase().trim();
}

function containsAny(text: string, values: string[]) {
  return values.some((v) => text.includes(v));
}

function pickName(tags?: Record<string, string>) {
  if (!tags) return null;

  return (
    tags["name:en"] ||
    tags["name"] ||
    tags["official_name"] ||
    tags["brand"] ||
    tags["operator"] ||
    null
  );
}

function pickAddress(tags?: Record<string, string>) {
  if (!tags) return null;

  const houseNumber = tags["addr:housenumber"];
  const street = tags["addr:street"];
  const unit = tags["addr:unit"];
  const composed = [unit, houseNumber, street].filter(Boolean).join(" ").trim();

  if (composed) return composed;

  return tags["addr:full"] || tags["contact:address"] || null;
}

function pickPostcode(tags?: Record<string, string>) {
  if (!tags) return null;
  return tags["addr:postcode"] || null;
}

function pickPhone(tags?: Record<string, string>) {
  if (!tags) return null;
  return tags["phone"] || tags["contact:phone"] || null;
}

function pickWebsite(tags?: Record<string, string>) {
  if (!tags) return null;
  return tags["website"] || tags["contact:website"] || null;
}

function pickCoordinates(element: OverpassElement) {
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

function inferCategory(tags?: Record<string, string>) {
  if (!tags) return "halal_business";

  const shop = normalize(tags["shop"]);
  const amenity = normalize(tags["amenity"]);
  const cuisine = normalize(tags["cuisine"]);
  const name = normalize(`${tags["name"] ?? ""} ${tags["name:en"] ?? ""}`);

  if (shop === "butcher") return "halal_butcher";

  if (shop === "supermarket" || shop === "convenience" || shop === "grocery") {
    return "halal_grocery";
  }

  if (
    containsAny(cuisine, [
      "halal",
      "kebab",
      "shawarma",
      "pakistani",
      "indian",
      "bangladeshi",
      "afghan",
      "turkish",
      "arab",
      "middle eastern",
      "persian",
      "lebanese",
    ])
  ) {
    return "halal_restaurant";
  }

  if (["restaurant", "fast_food", "cafe"].includes(amenity)) {
    return "halal_restaurant";
  }

  if (
    shop === "clothes" ||
    containsAny(name, ["abaya", "hijab", "thobe", "jubbah", "jalabiya"])
  ) {
    return "muslim_clothing";
  }

  if (
    shop === "books" ||
    containsAny(name, ["quran", "islamic books", "sunnah bookstore"])
  ) {
    return "islamic_bookstore";
  }

  return "halal_business";
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const R = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
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

    const d = haversineKm(latitude, longitude, mosque.latitude, mosque.longitude);

    if (best === null || d < best) {
      best = d;
    }
  }

  return best;
}

function classifyHalal(
  tags: Record<string, string> | undefined,
  nearestMosqueDistanceKm: number | null
): HalalClassification {
  const signals: string[] = [];

  if (!tags) {
    return {
      include: false,
      confidence: "low",
      score: 0,
      category: "halal_business",
      signals,
      notes: "No tags available",
    };
  }

  const name = normalize(`${tags["name"] ?? ""} ${tags["name:en"] ?? ""}`);
  const cuisine = normalize(tags["cuisine"]);
  const dietHalal = normalize(tags["diet:halal"]);
  const amenity = normalize(tags["amenity"]);
  const shop = normalize(tags["shop"]);
  const description = normalize(tags["description"]);
  const brand = normalize(tags["brand"]);
  const operator = normalize(tags["operator"]);
  const combined = [name, cuisine, description, brand, operator].join(" ");

  const muslimKeywords = [
    "halal",
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
    "sunnah",
    "deen",
    "barakah",
    "baraka",
    "tayyib",
    "tayyab",
    "rahma",
    "rahmah",
    "zamzam",
    "safa",
    "marwa",
    "hijab",
    "abaya",
    "jubbah",
    "thobe",
    "shawarma",
    "kebab",
    "biryani",
    "karahi",
    "nihari",
    "desi",
    "peshwari",
    "lahori",
    "kashmir",
  ];

  const cuisineSignals = [
    "halal",
    "pakistani",
    "indian",
    "bangladeshi",
    "afghan",
    "turkish",
    "arab",
    "middle eastern",
    "shawarma",
    "kebab",
    "biryani",
    "grill",
    "persian",
    "lebanese",
  ];

  let score = 0;

  if (dietHalal === "yes" || dietHalal === "only") {
    score += 12;
    signals.push("diet:halal");
  }

  if (cuisine.includes("halal")) {
    score += 10;
    signals.push("cuisine:halal");
  }

  if (name.includes("halal")) {
    score += 10;
    signals.push("name:halal");
  }

  if (containsAny(cuisine, cuisineSignals)) {
    score += 5;
    signals.push("cuisine-match");
  }

  if (containsAny(combined, muslimKeywords)) {
    score += 5;
    signals.push("muslim-keywords");
  }

  if (shop === "butcher") {
    score += 5;
    signals.push("shop:butcher");
  }

  if (
    shop === "butcher" &&
    (combined.includes("halal meat") ||
      combined.includes("halal butcher") ||
      combined.includes("fresh meat"))
  ) {
    score += 6;
    signals.push("butcher-halal-pattern");
  }

  if (["restaurant", "fast_food", "cafe"].includes(amenity)) {
    score += 2;
    signals.push(`amenity:${amenity}`);
  }

  if (["supermarket", "convenience", "grocery"].includes(shop)) {
    score += 2;
    signals.push(`shop:${shop}`);
  }

  if (nearestMosqueDistanceKm !== null) {
    if (nearestMosqueDistanceKm <= 0.25) {
      score += 4;
      signals.push("near-mosque:250m");
    } else if (nearestMosqueDistanceKm <= 0.5) {
      score += 3;
      signals.push("near-mosque:500m");
    } else if (nearestMosqueDistanceKm <= 1.0) {
      score += 2;
      signals.push("near-mosque:1km");
    }
  }

  const category = inferCategory(tags);

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
    category,
    signals: Array.from(new Set(signals)),
    notes:
      nearestMosqueDistanceKm !== null
        ? `Auto-classified score ${score}; nearest mosque ${nearestMosqueDistanceKm.toFixed(
            2
          )}km`
        : `Auto-classified score ${score}`,
  };
}

function buildMapsUrl(latitude: number | null, longitude: number | null, name: string) {
  if (typeof latitude === "number" && typeof longitude === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
}

function buildCityQuery(latitude: number, longitude: number, radiusMeters: number) {
  return `
[out:json][timeout:45];
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

function buildMosqueAreaQuery(latitude: number, longitude: number, radiusMeters: number) {
  return `
[out:json][timeout:25];
(
  node(around:${radiusMeters},${latitude},${longitude})["amenity"~"restaurant|fast_food|cafe",i];
  way(around:${radiusMeters},${latitude},${longitude})["amenity"~"restaurant|fast_food|cafe",i];
  relation(around:${radiusMeters},${latitude},${longitude})["amenity"~"restaurant|fast_food|cafe",i];

  node(around:${radiusMeters},${latitude},${longitude})["shop"~"butcher|supermarket|convenience|grocery",i];
  way(around:${radiusMeters},${latitude},${longitude})["shop"~"butcher|supermarket|convenience|grocery",i];
  relation(around:${radiusMeters},${latitude},${longitude})["shop"~"butcher|supermarket|convenience|grocery",i];
);
out center tags;
`.trim();
}

async function tryOverpassEndpoint(endpoint: string, query: string) {
  // Standard Overpass format. This is the important fix.
  const body = new URLSearchParams({ data: query }).toString();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "application/json",
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
  // Removed kumi because your screenshot shows whitelist failure.
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

async function geocodeCityFallback(city: CityRow) {
  const q = [city.name, city.country].filter(Boolean).join(", ");
  if (!q) return null;

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(
    q
  )}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) return null;

  const rows = (await res.json()) as Array<{ lat: string; lon: string }>;
  const first = rows[0];
  if (!first) return null;

  const latitude = Number(first.lat);
  const longitude = Number(first.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  await supabaseAdmin.from("cities").update({ latitude, longitude }).eq("id", city.id);

  return { latitude, longitude };
}

async function getCityOrThrow(citySlug: string): Promise<CityRow> {
  const { data: cityRaw, error: cityError } = await supabaseAdmin
    .from("cities")
    .select("id,name,slug,country,country_code,timezone,latitude,longitude")
    .eq("slug", citySlug)
    .eq("is_active", true)
    .maybeSingle();

  if (cityError) {
    throw new Error(cityError.message);
  }

  if (!cityRaw) {
    throw new Error("City not found");
  }

  const city = cityRaw as CityRow;

  if (typeof city.latitude === "number" && typeof city.longitude === "number") {
    return city;
  }

  const fallback = await geocodeCityFallback(city);
  if (!fallback) {
    throw new Error("City is missing latitude/longitude and fallback geocoding failed");
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
    .limit(150);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as MosqueAnchor[];
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

  const allElements: OverpassElement[] = [];
  const seenRaw = new Set<string>();

  // 1) Broad city scan
  const cityScan = await fetchOverpass(
    buildCityQuery(city.latitude as number, city.longitude as number, radiusMeters)
  );

  for (const element of cityScan.elements ?? []) {
    const key = `${element.type}:${element.id}`;
    if (seenRaw.has(key)) continue;
    seenRaw.add(key);
    allElements.push(element);
  }

  // 2) Mosque cluster scans
  const mosqueScans = mosques
    .filter(
      (m) =>
        typeof m.latitude === "number" &&
        typeof m.longitude === "number"
    )
    .slice(0, MAX_MOSQUE_CLUSTER_SCANS);

  for (const mosque of mosqueScans) {
    const clusterScan = await fetchOverpass(
      buildMosqueAreaQuery(
        mosque.latitude as number,
        mosque.longitude as number,
        MOSQUE_CLUSTER_RADIUS_METERS
      )
    );

    for (const element of clusterScan.elements ?? []) {
      const key = `${element.type}:${element.id}`;
      if (seenRaw.has(key)) continue;
      seenRaw.add(key);
      allElements.push(element);
    }

    await sleep(CLUSTER_DELAY_MS);
  }

  let rawMatches = 0;
  let found = 0;
  let inserted = 0;
  let skipped = 0;
  let invalid = 0;

  for (const element of allElements) {
    rawMatches++;

    const tags = element.tags ?? {};
    const name = pickName(tags);

    if (!name) {
      invalid++;
      continue;
    }

    const { latitude, longitude } = pickCoordinates(element);
    const nearestMosqueDistanceKm = getNearestMosqueDistanceKm(
      latitude,
      longitude,
      mosques
    );

    const classification = classifyHalal(tags, nearestMosqueDistanceKm);

    if (!classification.include) {
      skipped++;
      continue;
    }

    if (!acceptedConfidence.has(classification.confidence)) {
      skipped++;
      continue;
    }

    found++;

    const address = pickAddress(tags);
    const postcode = pickPostcode(tags);
    const phone = pickPhone(tags);
    const website = pickWebsite(tags);
    const slug = buildSlug(name, city.slug, element.type, element.id);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("osm_type", element.type)
      .eq("osm_id", element.id)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existing) {
      skipped++;
      continue;
    }

    const reviewStatus =
      classification.confidence === "high" ? "approved" : "pending";
    const isLive = classification.confidence === "high";

    const { error: insertError } = await supabaseAdmin.from("businesses").insert({
      id: crypto.randomUUID(),
      name,
      slug,
      category: classification.category,
      city: city.name,
      address,
      postcode,
      latitude,
      longitude,
      website,
      phone,
      maps_url: buildMapsUrl(latitude, longitude, name),
      country: city.country,
      country_code: city.country_code,
      timezone: city.timezone,
      is_verified: false,
      featured: false,
      is_active: true,
      osm_type: element.type,
      osm_id: element.id,
      halal_confidence: classification.confidence,
      halal_score: classification.score,
      halal_signals: classification.signals,
      import_source: "openstreetmap_mosque_assisted_importer",
      import_notes: classification.notes,
      review_status: reviewStatus,
      is_live: isLive,
    });

    if (insertError) {
      throw new Error(insertError.message);
    }

    inserted++;
  }

  return {
    success: true,
    city: city.slug,
    radiusMeters,
    minConfidence,
    raw_matches: rawMatches,
    found,
    inserted,
    skipped,
    invalid,
  };
}

