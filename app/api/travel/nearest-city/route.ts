import { NextResponse } from "next/server";
import { supabasePublic } from "@/lib/supabaseServer";
import { haversineKm } from "@/lib/travel";

export const runtime = "nodejs";

type CityRow = {
  id: number;
  name: string;
  slug: string;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
  is_travel_enabled: boolean | null;
};

type CountryRow = {
  name: string;
  slug: string;
  country_code: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      latitude?: number;
      longitude?: number;
    };

    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json(
        { error: "Missing or invalid latitude/longitude" },
        { status: 400 }
      );
    }

    const supabase = supabasePublic();

    const { data: cities, error: citiesError } = await supabase
      .from("cities")
      .select("id,name,slug,country_code,latitude,longitude,is_travel_enabled")
      .eq("is_travel_enabled", true)
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (citiesError) {
      return NextResponse.json({ error: citiesError.message }, { status: 500 });
    }

    const cityRows = (cities ?? []) as CityRow[];

    if (cityRows.length === 0) {
      return NextResponse.json(
        { error: "No travel-enabled cities with coordinates found" },
        { status: 404 }
      );
    }

    let nearest: (CityRow & { distance_km: number }) | null = null;

    for (const city of cityRows) {
      if (city.latitude === null || city.longitude === null) continue;

      const distanceKm = haversineKm(
        latitude,
        longitude,
        city.latitude,
        city.longitude
      );

      if (!nearest || distanceKm < nearest.distance_km) {
        nearest = {
          ...city,
          distance_km: distanceKm,
        };
      }
    }

    if (!nearest || !nearest.country_code) {
      return NextResponse.json(
        { error: "Could not determine nearest city" },
        { status: 404 }
      );
    }

    const { data: country, error: countryError } = await supabase
      .from("travel_countries")
      .select("name,slug,country_code")
      .eq("country_code", nearest.country_code)
      .eq("is_active", true)
      .maybeSingle();

    if (countryError) {
      return NextResponse.json({ error: countryError.message }, { status: 500 });
    }

    if (!country) {
      return NextResponse.json(
        { error: "Nearest city found but matching travel country missing" },
        { status: 404 }
      );
    }

    const countryRow = country as CountryRow;

    return NextResponse.json({
      ok: true,
      country: countryRow,
      city: {
        id: nearest.id,
        name: nearest.name,
        slug: nearest.slug,
        country_code: nearest.country_code,
        distance_km: Number(nearest.distance_km.toFixed(2)),
      },
      url: `/travel/${countryRow.slug}/${nearest.slug}`,
    });
  } catch (error) {
    console.error("nearest-city error:", error);
    return NextResponse.json(
      { error: "Could not resolve nearest travel city" },
      { status: 500 }
    );
  }
}

