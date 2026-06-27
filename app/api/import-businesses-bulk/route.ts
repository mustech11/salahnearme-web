import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { importBusinessesForCity } from "@/lib/hybridBusinessImporter";

export const runtime = "nodejs";

type CityRow = {
  slug: string;
  name: string;
  country: string | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const radius = Number(searchParams.get("radius") ?? "7000");
    const delayMs = Number(searchParams.get("delay_ms") ?? "1500");
    const limitCitiesRaw = searchParams.get("limit");
    const minConfidence = searchParams.get("min_confidence") ?? "medium";

    const { data: citiesRaw, error } = await supabaseAdmin
      .from("cities")
      .select("slug,name,country")
      .eq("is_active", true)
      .in("country", ["United Kingdom", "UK"])
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let cities = (citiesRaw ?? []) as CityRow[];

    if (limitCitiesRaw) {
      const limit = Number(limitCitiesRaw);
      if (Number.isFinite(limit) && limit > 0) {
        cities = cities.slice(0, limit);
      }
    }

    const perCityResults: Array<{
      city: string;
      raw_matches: number;
      found: number;
      inserted: number;
      skipped: number;
      invalid: number;
      status: "success" | "failed";
      error?: string;
    }> = [];

    let totals = {
      cities: 0,
      raw_matches: 0,
      found: 0,
      inserted: 0,
      skipped: 0,
      invalid: 0,
      failed: 0,
    };

    for (const city of cities) {
      try {
        const data = await importBusinessesForCity({
          citySlug: city.slug,
          radiusMeters: radius,
          minConfidence,
        });

        perCityResults.push({
          city: city.slug,
          raw_matches: data.raw_matches,
          found: data.found,
          inserted: data.inserted,
          skipped: data.skipped,
          invalid: data.invalid,
          status: "success",
        });

        totals.raw_matches += data.raw_matches;
        totals.found += data.found;
        totals.inserted += data.inserted;
        totals.skipped += data.skipped;
        totals.invalid += data.invalid;
      } catch (error) {
        perCityResults.push({
          city: city.slug,
          raw_matches: 0,
          found: 0,
          inserted: 0,
          skipped: 0,
          invalid: 0,
          status: "failed",
          error: error instanceof Error ? error.message : "Unexpected failure",
        });

        totals.failed++;
      }

      totals.cities++;

      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }

    return NextResponse.json({
      success: true,
      summary: totals,
      results: perCityResults,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected hybrid bulk importer error",
      },
      { status: 500 }
    );
  }
}

