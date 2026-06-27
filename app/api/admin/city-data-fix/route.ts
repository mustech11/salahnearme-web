import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function normalizeCityName(name: string | null) {
  return (name ?? "")
    .toLowerCase()
    .trim()
    .replace(/[āáàäâ]/g, "a")
    .replace(/[ēéèëê]/g, "e")
    .replace(/[īíìïî]/g, "i")
    .replace(/[ōóòöô]/g, "o")
    .replace(/[ūúùüû]/g, "u")
    .replace(/[^a-z0-9]/g, "");
}

export async function GET() {
  try {
    const permission = await requireAdmin();

    if (!permission.ok) {
      return jsonResponse(
        {
          ok: false,
          error: permission.error,
        },
        permission.status
      );
    }

    const { data: cities, error } = await supabaseAdmin
      .from("cities")
      .select("id,name,slug,country,timezone,latitude,longitude,is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("city-data-fix lookup error:", error);

      return jsonResponse(
        {
          ok: false,
          error: "Could not load city data.",
        },
        500
      );
    }

    const cityRows = cities ?? [];

    const missingCoordinates = cityRows.filter(
      (city) => city.latitude === null || city.longitude === null
    );

    const missingTimezone = cityRows.filter((city) => !city.timezone);

    const duplicateMap = new Map<string, typeof cityRows>();

    for (const city of cityRows) {
      const key = normalizeCityName(city.name);

      if (!key) {
        continue;
      }

      const existing = duplicateMap.get(key) ?? [];
      existing.push(city);
      duplicateMap.set(key, existing);
    }

    const possibleDuplicateCities = Array.from(duplicateMap.values()).filter(
      (group) => group.length > 1
    );

    return jsonResponse({
      ok: true,
      totals: {
        cities: cityRows.length,
        missingCoordinates: missingCoordinates.length,
        missingTimezone: missingTimezone.length,
        possibleDuplicateGroups: possibleDuplicateCities.length,
      },
      issues: {
        missingCoordinates,
        missingTimezone,
        possibleDuplicateCities,
      },
    });
  } catch (error) {
    console.error("city-data-fix route error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not inspect city data.",
      },
      500
    );
  }
}

