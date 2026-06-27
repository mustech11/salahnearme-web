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

type GooglePlace = {
  id?: string;
  displayName?: {
    text?: string;
    languageCode?: string;
  };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  primaryType?: string;
  types?: string[];
};

type TextSearchResponse = {
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

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildSlug(name: string, citySlug: string, googlePlaceId: string) {
  return `${slugify(`${name}-${citySlug}`)}-${googlePlaceId.toLowerCase()}`;
}

function normalize(text: string | null | undefined) {
  return (text ?? "").toLowerCase().trim();
}

function containsAny(text: string, values: string[]) {
  return values.some((v) => text.includes(v));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function inferCategory(place: GooglePlace, matchedQuery: string) {
  const primaryType = normalize(place.primaryType);
  const types = (place.types ?? []).map((t) => normalize(t));
  const name = normalize(place.displayName?.text);
  const query = normalize(matchedQuery);

  const all = [primaryType, ...types, name, query].join(" ");

  if (containsAny(all, ["butcher"])) return "halal_butcher";
  if (containsAny(all, ["supermarket", "grocery", "convenience_store"])) {
    return "halal_grocery";
  }
  if (containsAny(all, ["book_store", "bookstore", "islamic bookstore", "quran"])) {
    return "islamic_bookstore";
  }
  if (containsAny(all, ["clothing_store", "abaya", "hijab", "thobe", "jubbah"])) {
    return "muslim_clothing";
  }
  if (containsAny(all, ["restaurant", "cafe", "meal_takeaway", "fast_food"])) {
    return "halal_restaurant";
  }

  return "halal_business";
}

function classifyHalal(
  place: GooglePlace,
  matchedQuery: string,
  nearestMosqueDistanceKm: number | null
): HalalClassification {
  const signals: string[] = [];

  const name = normalize(place.displayName?.text);
  const address = normalize(place.formattedAddress);
  const primaryType = normalize(place.primaryType);
  const types = (place.types ?? []).map((t) => normalize(t));
  const query = normalize(matchedQuery);

  const combined = [name, address, primaryType, ...types, query].join(" ");

  let score = 0;

  if (query.includes("halal")) {
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
      "islamic",
      "muslim",
      "ummah",
      "noor",
      "nur",
      "deen",
      "barakah",
      "zamzam",
      "abaya",
      "hijab",
      "jubbah",
      "thobe",
      "quran",
    ])
  ) {
    score += 5;
    signals.push("muslim-keywords");
  }

  if (
    containsAny(primaryType, [
      "restaurant",
      "cafe",
      "meal_takeaway",
      "fast_food",
      "supermarket",
      "grocery_store",
      "convenience_store",
      "butcher_shop",
      "clothing_store",
      "book_store",
    ])
  ) {
    score += 2;
    signals.push(`primaryType:${primaryType}`);
  }

  if (
    types.some((t) =>
      [
        "restaurant",
        "cafe",
        "meal_takeaway",
        "fast_food_restaurant",
        "supermarket",
        "grocery_store",
        "convenience_store",
        "clothing_store",
        "book_store",
      ].includes(t)
    )
  ) {
    score += 2;
    signals.push("type-match");
  }

  if (containsAny(combined, ["butcher", "halal meat"])) {
    score += 5;
    signals.push("butcher-pattern");
  }

  if (nearestMosqueDistanceKm !== null) {
    if (nearestMosqueDistanceKm <= 0.25) {
      score += 4;
      signals.push("near-mosque:250m");
    } else if (nearestMosqueDistanceKm <= 0.5) {
      score += 3;
      signals.push("near-mosque:500m");
    } else if (nearestMosqueDistanceKm <= 1) {
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
    category: inferCategory(place, matchedQuery),
    signals: Array.from(new Set(signals)),
    notes:
      nearestMosqueDistanceKm !== null
        ? `Google Places smart import; score ${score}; nearest mosque ${nearestMosqueDistanceKm.toFixed(
            2
          )}km`
        : `Google Places smart import; score ${score}`,
  };
}

function parsePostcode(address: string | null | undefined) {
  if (!address) return null;

  const ukPostcodeMatch = address.match(
    /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i
  );
  if (ukPostcodeMatch?.[1]) return ukPostcodeMatch[1].toUpperCase();

  return null;
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

  await supabaseAdmin
    .from("cities")
    .update({ latitude, longitude })
    .eq("id", city.id);

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

  if (
    typeof city.latitude === "number" &&
    typeof city.longitude === "number"
  ) {
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
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as MosqueAnchor[];
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
    | TextSearchResponse
    | { error?: { message?: string } };

  if (!res.ok) {
    const message =
      "error" in data && data.error?.message
        ? data.error.message
        : `Google Places request failed with status ${res.status}`;
    throw new Error(message);
  }

  if (!("places" in data)) {
    return [];
  }

  return data.places ?? [];
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

  const queries = [
    `halal restaurant in ${city.name}`,
    `halal food in ${city.name}`,
    `halal butcher in ${city.name}`,
    `halal supermarket in ${city.name}`,
    `halal grocery in ${city.name}`,
    `islamic clothing in ${city.name}`,
    `islamic bookstore in ${city.name}`,
  ];

  const rawPlaces: Array<{ place: GooglePlace; matchedQuery: string }> = [];
  const seenPlaceIds = new Set<string>();

  for (const query of queries) {
    const rows = await googleTextSearch({
      textQuery: query,
      latitude: city.latitude as number,
      longitude: city.longitude as number,
      radiusMeters,
    });

    for (const place of rows) {
      if (!place.id) continue;
      if (seenPlaceIds.has(place.id)) continue;
      seenPlaceIds.add(place.id);
      rawPlaces.push({ place, matchedQuery: query });
    }

    await sleep(250);
  }

  let rawMatches = 0;
  let found = 0;
  let inserted = 0;
  let skipped = 0;
  let invalid = 0;

  for (const row of rawPlaces) {
    rawMatches++;

    const place = row.place;
    const matchedQuery = row.matchedQuery;

    const name = place.displayName?.text?.trim() ?? null;
    if (!name || !place.id) {
      invalid++;
      continue;
    }

    const latitude = place.location?.latitude ?? null;
    const longitude = place.location?.longitude ?? null;

    const nearestMosqueDistanceKm = getNearestMosqueDistanceKm(
      latitude,
      longitude,
      mosques
    );

    const classification = classifyHalal(place, matchedQuery, nearestMosqueDistanceKm);

    if (!classification.include) {
      skipped++;
      continue;
    }

    if (!acceptedConfidence.has(classification.confidence)) {
      skipped++;
      continue;
    }

    found++;

    const address = place.formattedAddress ?? place.shortFormattedAddress ?? null;
    const postcode = parsePostcode(address);
    const phone =
      place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? null;
    const website = place.websiteUri ?? null;
    const mapsUrl = place.googleMapsUri ?? null;
    const slug = buildSlug(name, city.slug, place.id);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("google_place_id", place.id)
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
      maps_url: mapsUrl,
      country: city.country,
      country_code: city.country_code,
      timezone: city.timezone,
      is_verified: false,
      featured: false,
      is_active: true,
      google_place_id: place.id,
      halal_confidence: classification.confidence,
      halal_score: classification.score,
      halal_signals: classification.signals,
      import_source: "google_places_smart_importer",
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

