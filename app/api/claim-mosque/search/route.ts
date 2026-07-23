import { NextResponse } from "next/server";

import { supabasePublic } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MosqueSearchRow = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
  area: string | null;
  postcode: string | null;
  address: string | null;
  verified_status: string | null;
};

const MIN_SEARCH_LENGTH = 2;
const MAX_QUERY_LENGTH = 160;
const MAX_CITY_LENGTH = 120;
const RESULT_LIMIT = 24;

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function cleanSearchValue(
  value: string | null,
  maxLength: number
): string {
  return (value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function escapePostgrestPattern(
  value: string
): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/,/g, " ")
    .replace(/[()]/g, " ");
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const query = cleanSearchValue(
      url.searchParams.get("q"),
      MAX_QUERY_LENGTH
    );

    const city = cleanSearchValue(
      url.searchParams.get("city"),
      MAX_CITY_LENGTH
    );

    if (
      query.length < MIN_SEARCH_LENGTH &&
      city.length < MIN_SEARCH_LENGTH
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Enter at least two characters in the mosque or city search.",
        },
        400
      );
    }

    const supabase = supabasePublic();

    let mosqueQuery = supabase
      .from("mosques")
      .select(
        `
        id,
        name,
        slug,
        city,
        area,
        postcode,
        address,
        verified_status
      `
      )
      .eq("is_active", true)
      .not("slug", "is", null)
      .not("name", "is", null);

    if (query.length >= MIN_SEARCH_LENGTH) {
      const pattern = escapePostgrestPattern(query);

      mosqueQuery = mosqueQuery.or(
        [
          `name.ilike.%${pattern}%`,
          `area.ilike.%${pattern}%`,
          `postcode.ilike.%${pattern}%`,
          `address.ilike.%${pattern}%`,
        ].join(",")
      );
    }

    if (city.length >= MIN_SEARCH_LENGTH) {
      mosqueQuery = mosqueQuery.ilike(
        "city",
        `%${escapePostgrestPattern(city)}%`
      );
    }

    const { data, error } = await mosqueQuery
      .order("name", {
        ascending: true,
      })
      .limit(RESULT_LIMIT);

    if (error) {
      console.error("Claim mosque search query error:", {
        code: error.code,
        message: error.message,
      });

      return jsonResponse(
        {
          ok: false,
          error:
            "Mosque search is temporarily unavailable.",
        },
        500
      );
    }

    const seen = new Set<string>();

    const results = (
      (data ?? []) as MosqueSearchRow[]
    )
      .filter((mosque) => {
        const id = mosque.id?.trim();
        const name = mosque.name?.trim();
        const slug = mosque.slug?.trim();

        if (
          !id ||
          !name ||
          !slug ||
          seen.has(id)
        ) {
          return false;
        }

        seen.add(id);
        return true;
      })
      .map((mosque) => ({
        id: mosque.id,
        name: mosque.name?.trim() ?? "",
        slug: mosque.slug?.trim() ?? "",
        city: mosque.city?.trim() || null,
        area: mosque.area?.trim() || null,
        postcode:
          mosque.postcode?.trim() || null,
        address:
          mosque.address?.trim() || null,
        verified_status:
          mosque.verified_status?.trim() ||
          null,
      }));

    return jsonResponse({
      ok: true,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("Claim mosque search route error:", error);

    return jsonResponse(
      {
        ok: false,
        error:
          "Mosque search is temporarily unavailable.",
      },
      500
    );
  }
}