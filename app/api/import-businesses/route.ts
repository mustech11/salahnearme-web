import { NextRequest, NextResponse } from "next/server";
import { importBusinessesForCity } from "@/lib/hybridBusinessImporter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_RADIUS_METERS = 1000;
const MAX_RADIUS_METERS = 25000;

const ALLOWED_CONFIDENCE = ["low", "medium", "high"] as const;

type MinConfidence = (typeof ALLOWED_CONFIDENCE)[number];

function cleanString(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseRadius(value: string | null) {
  const radius = Number(value ?? "7000");

  if (!Number.isFinite(radius)) return 7000;

  return Math.min(Math.max(radius, MIN_RADIUS_METERS), MAX_RADIUS_METERS);
}

function parseMinConfidence(value: string | null): MinConfidence {
  const cleaned = (value ?? "medium").toLowerCase();

  if (ALLOWED_CONFIDENCE.includes(cleaned as MinConfidence)) {
    return cleaned as MinConfidence;
  }

  return "medium";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const citySlug = cleanString(searchParams.get("city"));
    const radiusMeters = parseRadius(searchParams.get("radius"));
    const minConfidence = parseMinConfidence(
      searchParams.get("min_confidence")
    );

    if (!citySlug) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required query parameter: "city"',
          example:
            "/api/import-businesses?city=manchester&radius=10000&min_confidence=low",
        },
        { status: 400 }
      );
    }

    const startedAt = Date.now();

    const result = await importBusinessesForCity({
      citySlug,
      radiusMeters,
      minConfidence,
    });

    return NextResponse.json(
      {
        ...result,
        meta: {
          citySlug,
          radiusMeters,
          minConfidence,
          duration_ms: Date.now() - startedAt,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Hybrid business importer failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected hybrid business importer error",
      },
      { status: 500 }
    );
  }
}

