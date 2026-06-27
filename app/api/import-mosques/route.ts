import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_RADIUS_METERS = 1000;
const MAX_RADIUS_METERS = 30000;
const DEFAULT_RADIUS_METERS = 5000;
const MAX_OVERPASS_ELEMENTS = 500;

type CityRow = {
  id: string | number;
  slug: string;
  name: string;
  country: string | null;
  country_code: string | null;
  timezone: string | null;
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

type ExistingMosque = Record<string, unknown> & {
  id: string;
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source?: string | null;
  verified_status?: string | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function hasImporterAccess(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const requestSecret = req.headers.get("x-cron-secret");

  if (cronSecret && requestSecret && requestSecret === cronSecret) {
    return true;
  }

  const permission = await requireAdmin();

  return permission.ok;
}

function normalizeForDedup(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[āáàäâ]/g, "a")
    .replace(/[ēéèëê]/g, "e")
    .replace(/[īíìïî]/g, "i")
    .replace(/[ōóòöô]/g, "o")
    .replace(/[ūúùüû]/g, "u")
    .replace(/[^a-z0-9]/g, "");
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

function cleanRadius(value: string | null) {
  const number = Number(value ?? DEFAULT_RADIUS_METERS);

  if (!Number.isFinite(number)) {
    return DEFAULT_RADIUS_METERS;
  }

  return Math.max(
    MIN_RADIUS_METERS,
    Math.min(MAX_RADIUS_METERS, Math.round(number))
  );
}

function pickBestName(tags?: Record<string, string>, cityName?: string) {
  if (!tags) {
    return null;
  }

  const directName =
    tags["name:en"] ||
    tags.name ||
    tags.official_name ||
    tags.alt_name ||
    tags.operator ||
    tags.brand;

  if (directName?.trim()) {
    return directName.trim().slice(0, 180);
  }

  const area =
    tags["addr:suburb"] ||
    tags["addr:neighbourhood"] ||
    tags["addr:district"] ||
    tags["is_in:suburb"] ||
    tags.is_in;

  if (area && cityName) {
    return `Mosque in ${area}, ${cityName}`.slice(0, 180);
  }

  if (cityName) {
    return `Mosque in ${cityName}`.slice(0, 180);
  }

  return null;
}

function pickArea(tags?: Record<string, string>) {
  if (!tags) {
    return null;
  }

  return (
    tags["addr:suburb"] ||
    tags["addr:neighbourhood"] ||
    tags["addr:district"] ||
    tags["is_in:suburb"] ||
    tags.is_in ||
    null
  );
}

function pickAddress(tags?: Record<string, string>) {
  if (!tags) {
    return null;
  }

  const unit = tags["addr:unit"];
  const houseNumber = tags["addr:housenumber"];
  const street = tags["addr:street"];

  const line = [unit, houseNumber, street].filter(Boolean).join(" ").trim();

  return line || tags["addr:full"] || tags["contact:address"] || null;
}

function pickPostcode(tags?: Record<string, string>) {
  return tags?.["addr:postcode"] ?? null;
}

function pickPhone(tags?: Record<string, string>) {
  return tags?.phone ?? tags?.["contact:phone"] ?? null;
}

function pickWebsite(tags?: Record<string, string>) {
  return tags?.website ?? tags?.["contact:website"] ?? null;
}

function pickCoordinates(element: OverpassElement) {
  if (typeof element.lat === "number" && typeof element.lon === "number") {
    return {
      latitude: element.lat,
      longitude: element.lon,
    };
  }

  if (
    element.center &&
    typeof element.center.lat === "number" &&
    typeof element.center.lon === "number"
  ) {
    return {
      latitude: element.center.lat,
      longitude: element.center.lon,
    };
  }

  return {
    latitude: null,
    longitude: null,
  };
}

function buildMosqueSlug(
  name: string,
  citySlug: string,
  osmType: string,
  osmId: number
) {
  return `${slugify(`${name}-${citySlug}`)}-${osmType}-${osmId}`.slice(0, 220);
}

function buildMapsUrl(
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

function isLikelyMosque(tags?: Record<string, string>) {
  if (!tags) {
    return false;
  }

  const amenity = tags.amenity;
  const religion = tags.religion;
  const building = tags.building;

  const name = `${tags.name ?? ""} ${tags["name:en"] ?? ""} ${
    tags.official_name ?? ""
  }`.toLowerCase();

  return (
    (amenity === "place_of_worship" && religion === "muslim") ||
    building === "mosque" ||
    name.includes("mosque") ||
    name.includes("masjid") ||
    name.includes("jamia") ||
    name.includes("islamic centre") ||
    name.includes("islamic center")
  );
}

function buildOverpassQuery(
  latitude: number,
  longitude: number,
  radiusMeters: number
) {
  return `
[out:json][timeout:40];
(
  node(around:${radiusMeters},${latitude},${longitude})["amenity"="place_of_worship"]["religion"="muslim"];
  way(around:${radiusMeters},${latitude},${longitude})["amenity"="place_of_worship"]["religion"="muslim"];
  relation(around:${radiusMeters},${latitude},${longitude})["amenity"="place_of_worship"]["religion"="muslim"];

  node(around:${radiusMeters},${latitude},${longitude})["building"="mosque"];
  way(around:${radiusMeters},${latitude},${longitude})["building"="mosque"];
  relation(around:${radiusMeters},${latitude},${longitude})["building"="mosque"];
);
out center tags;
`.trim();
}

async function fetchOverpass(query: string): Promise<OverpassResponse> {
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
  ];

  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const body = new URLSearchParams({ data: query }).toString();

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Accept: "application/json",
          "User-Agent": "SalahNearMe/1.0 mosque-importer",
        },
        body,
        cache: "no-store",
      });

      if (!response.ok) {
        lastError = await response.text();
        continue;
      }

      return (await response.json()) as OverpassResponse;
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

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const radius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function findExistingMosque(args: {
  cityName: string;
  name: string;
  address: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  osmType: string;
  osmId: number;
}) {
  const {
    cityName,
    name,
    address,
    postcode,
    latitude,
    longitude,
    osmType,
    osmId,
  } = args;

  const normalizedName = normalizeForDedup(name);
  const normalizedAddress = normalizeForDedup(address);

  const byOsm = await supabaseAdmin
    .from("mosques")
    .select(
      "id,name,address,area,postcode,latitude,longitude,maps_url,phone,website,osm_type,osm_id,source,verified_status,normalized_name,normalized_address"
    )
    .eq("osm_type", osmType)
    .eq("osm_id", osmId)
    .maybeSingle();

  if (byOsm.error) {
    throw new Error(byOsm.error.message);
  }

  if (byOsm.data) {
    return byOsm.data as ExistingMosque;
  }

  if (normalizedName && normalizedAddress) {
    const exact = await supabaseAdmin
      .from("mosques")
      .select(
        "id,name,address,area,postcode,latitude,longitude,maps_url,phone,website,osm_type,osm_id,source,verified_status,normalized_name,normalized_address"
      )
      .eq("city", cityName)
      .eq("normalized_name", normalizedName)
      .eq("normalized_address", normalizedAddress)
      .maybeSingle();

    if (exact.error) {
      throw new Error(exact.error.message);
    }

    if (exact.data) {
      return exact.data as ExistingMosque;
    }
  }

  if (normalizedName && postcode) {
    const byPostcode = await supabaseAdmin
      .from("mosques")
      .select(
        "id,name,address,area,postcode,latitude,longitude,maps_url,phone,website,osm_type,osm_id,source,verified_status,normalized_name,normalized_address"
      )
      .eq("city", cityName)
      .eq("normalized_name", normalizedName)
      .eq("postcode", postcode)
      .maybeSingle();

    if (byPostcode.error) {
      throw new Error(byPostcode.error.message);
    }

    if (byPostcode.data) {
      return byPostcode.data as ExistingMosque;
    }
  }

  if (typeof latitude === "number" && typeof longitude === "number") {
    const nearby = await supabaseAdmin
      .from("mosques")
      .select(
        "id,name,address,area,postcode,latitude,longitude,maps_url,phone,website,osm_type,osm_id,source,verified_status,normalized_name,normalized_address"
      )
      .eq("city", cityName)
      .limit(500);

    if (nearby.error) {
      throw new Error(nearby.error.message);
    }

    for (const mosque of nearby.data ?? []) {
      if (
        typeof mosque.latitude !== "number" ||
        typeof mosque.longitude !== "number"
      ) {
        continue;
      }

      const distance = haversineMeters(
        latitude,
        longitude,
        mosque.latitude,
        mosque.longitude
      );

      const existingName = normalizeForDedup(mosque.name);
      const nameLooksSame =
        existingName === normalizedName ||
        existingName.includes(normalizedName) ||
        normalizedName.includes(existingName);

      if (distance <= 120 && nameLooksSame) {
        return mosque as ExistingMosque;
      }
    }
  }

  return null;
}

async function mergeMosque(args: {
  existing: ExistingMosque;
  incoming: Record<string, unknown>;
}) {
  const { existing, incoming } = args;

  const payload = {
    address: existing.address ?? incoming.address,
    area: existing.area ?? incoming.area,
    postcode: existing.postcode ?? incoming.postcode,
    latitude: existing.latitude ?? incoming.latitude,
    longitude: existing.longitude ?? incoming.longitude,
    maps_url: existing.maps_url ?? incoming.maps_url,
    phone: existing.phone ?? incoming.phone,
    website: existing.website ?? incoming.website,
    osm_type: existing.osm_type ?? incoming.osm_type,
    osm_id: existing.osm_id ?? incoming.osm_id,
    normalized_name: existing.normalized_name ?? incoming.normalized_name,
    normalized_address:
      existing.normalized_address ?? incoming.normalized_address,
    source:
      existing.source === "verified_from_directory"
        ? existing.source
        : "merged_openstreetmap_import",
    verified_status:
      existing.verified_status === "verified_from_directory"
        ? existing.verified_status
        : existing.verified_status ?? incoming.verified_status,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("mosques")
    .update(payload)
    .eq("id", existing.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function GET(req: Request) {
  try {
    const hasAccess = await hasImporterAccess(req);

    if (!hasAccess) {
      return jsonResponse(
        {
          ok: false,
          error: "Unauthorized.",
        },
        401
      );
    }

    const { searchParams } = new URL(req.url);

    const citySlug = searchParams.get("city")?.trim();
    const radiusMeters = cleanRadius(searchParams.get("radius"));

    if (!citySlug) {
      return jsonResponse(
        {
          ok: false,
          error: 'Missing required query parameter: "city".',
        },
        400
      );
    }

    const { data: cityRaw, error: cityError } = await supabaseAdmin
      .from("cities")
      .select("id,name,slug,country,country_code,timezone,latitude,longitude")
      .eq("slug", citySlug)
      .eq("is_active", true)
      .maybeSingle();

    if (cityError) {
      console.error("import mosques city lookup error:", cityError);

      return jsonResponse(
        {
          ok: false,
          error: "Could not load city.",
        },
        500
      );
    }

    if (!cityRaw) {
      return jsonResponse(
        {
          ok: false,
          error: "City not found.",
        },
        404
      );
    }

    const city = cityRaw as CityRow;

    if (
      typeof city.latitude !== "number" ||
      typeof city.longitude !== "number"
    ) {
      return jsonResponse(
        {
          ok: false,
          error: "City is missing latitude/longitude.",
        },
        400
      );
    }

    const overpassQuery = buildOverpassQuery(
      city.latitude,
      city.longitude,
      radiusMeters
    );

    const overpass = await fetchOverpass(overpassQuery);

    const elements = (overpass.elements ?? [])
      .filter((element) => isLikelyMosque(element.tags))
      .slice(0, MAX_OVERPASS_ELEMENTS);

    let inserted = 0;
    let merged = 0;
    let skipped = 0;
    let invalid = 0;

    for (const element of elements) {
      const tags = element.tags ?? {};
      const name = pickBestName(tags, city.name);

      if (!name) {
        invalid++;
        continue;
      }

      const { latitude, longitude } = pickCoordinates(element);

      const address = pickAddress(tags);
      const area = pickArea(tags);
      const postcode = pickPostcode(tags);
      const phone = pickPhone(tags);
      const website = pickWebsite(tags);

      const normalizedName = normalizeForDedup(name);
      const normalizedAddress = normalizeForDedup(address);

      const slug = buildMosqueSlug(name, city.slug, element.type, element.id);

      const mapsUrl = buildMapsUrl(
        latitude,
        longitude,
        [name, address, city.name, postcode].filter(Boolean).join(", ")
      );

      const mosqueRow = {
        id: crypto.randomUUID(),
        name,
        slug,
        address,
        area,
        city: city.name,
        postcode,
        latitude,
        longitude,
        phone,
        website,
        maps_url: mapsUrl,
        normalized_name: normalizedName,
        normalized_address: normalizedAddress,
        status: "listed",
        area_hint: area,
        verified_status: "auto_imported_osm",
        source: "openstreetmap_overpass_v5_identity",
        country: city.country,
        country_code: city.country_code,
        timezone: city.timezone,
        is_travel_visible: true,
        city_id: city.id,
        is_active: true,
        osm_type: element.type,
        osm_id: element.id,
      };

      const existingMosque = await findExistingMosque({
        cityName: city.name,
        name,
        address,
        postcode,
        latitude,
        longitude,
        osmType: element.type,
        osmId: element.id,
      });

      if (existingMosque) {
        await mergeMosque({
          existing: existingMosque,
          incoming: mosqueRow,
        });

        merged++;
        skipped++;
        continue;
      }

      const { error: insertError } = await supabaseAdmin
        .from("mosques")
        .insert(mosqueRow);

      if (insertError) {
        if (
          insertError.message.toLowerCase().includes("duplicate") ||
          insertError.message.toLowerCase().includes("unique")
        ) {
          skipped++;
          continue;
        }

        console.error("import mosques insert error:", insertError);

        return jsonResponse(
          {
            ok: false,
            error: "Could not insert imported mosque.",
            mosque: name,
            osm_type: element.type,
            osm_id: element.id,
          },
          500
        );
      }

      inserted++;
    }

    return jsonResponse({
      ok: true,
      success: true,
      city: city.slug,
      radiusMeters,
      found: elements.length,
      inserted,
      merged,
      skipped,
      invalid,
    });
  } catch (error) {
    console.error("import mosques route error:", error);

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unexpected importer error.",
      },
      500
    );
  }
}

