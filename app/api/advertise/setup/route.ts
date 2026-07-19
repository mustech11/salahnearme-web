import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdvertisingType =
  | "city_featured"
  | "mosque_sponsor"
  | "multi_mosque"
  | "multi_city";

type Body = {
  advertising_type?: unknown;
  selected_city_id?: unknown;
  selected_mosque_id?: unknown;
  selected_mosque_ids?: unknown;
  selected_city_ids?: unknown;
  notes?: unknown;
  owner_email?: unknown;
  business_id?: unknown;
  website_honeypot?: unknown;
};

const ADVERTISING_TYPES = [
  "city_featured",
  "mosque_sponsor",
  "multi_mosque",
  "multi_city",
] as const;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function cleanString(value: unknown, maxLength = 500) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function nullableString(value: unknown, maxLength = 500) {
  const cleaned = cleanString(value, maxLength);

  return cleaned ? cleaned : null;
}

function isAdvertisingType(value: string): value is AdvertisingType {
  return (ADVERTISING_TYPES as readonly string[]).includes(value);
}

function isValidEmail(value: string | null) {
  if (!value) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUuid(value: string | null) {
  return Boolean(value && UUID_REGEX.test(value));
}

function normaliseNumberId(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const numberValue = Number(value.trim());

    if (Number.isInteger(numberValue) && numberValue > 0) {
      return numberValue;
    }
  }

  return null;
}

function normaliseUuidArray(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const ids = value
    .map((item) => cleanString(item, 80))
    .filter((item) => UUID_REGEX.test(item));

  return ids.length > 0 ? Array.from(new Set(ids)).slice(0, 25) : null;
}

function normaliseNumberArray(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const ids = value
    .map((item) => normaliseNumberId(item))
    .filter((item): item is number => typeof item === "number");

  return ids.length > 0 ? Array.from(new Set(ids)).slice(0, 25) : null;
}

export async function GET() {
  return jsonResponse({
    ok: true,
    route: "/api/advertise/setup",
    method: "POST",
    body: {
      advertising_type: ADVERTISING_TYPES,
      selected_city_id: "optional number",
      selected_mosque_id: "optional UUID",
      selected_mosque_ids: "optional UUID[]",
      selected_city_ids: "optional number[]",
      notes: "optional",
      owner_email: "optional",
      business_id: "optional UUID",
      website_honeypot: "optional anti-spam; leave empty",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    if (!body) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing request body.",
        },
        400
      );
    }

    if (cleanString(body.website_honeypot, 100)) {
      return jsonResponse(
        {
          ok: false,
          error: "Submission rejected.",
        },
        400
      );
    }

    const advertisingTypeRaw = cleanString(body.advertising_type, 80);

    if (!advertisingTypeRaw || !isAdvertisingType(advertisingTypeRaw)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid advertising_type.",
          allowed: ADVERTISING_TYPES,
        },
        400
      );
    }

    const selectedCityId = normaliseNumberId(body.selected_city_id);
    const selectedMosqueId = nullableString(body.selected_mosque_id, 80);
    const selectedMosqueIds = normaliseUuidArray(body.selected_mosque_ids);
    const selectedCityIds = normaliseNumberArray(body.selected_city_ids);
    const notes = nullableString(body.notes, 2000);
    const ownerEmail = nullableString(body.owner_email, 180);
    const businessId = nullableString(body.business_id, 80);

    if (selectedMosqueId && !isUuid(selectedMosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid selected_mosque_id.",
        },
        400
      );
    }

    if (businessId && !isUuid(businessId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid business_id.",
        },
        400
      );
    }

    if (!isValidEmail(ownerEmail)) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid owner_email.",
        },
        400
      );
    }

    if (advertisingTypeRaw === "city_featured" && !selectedCityId) {
      return jsonResponse(
        {
          ok: false,
          error: "City featured advertising requires selected_city_id.",
        },
        400
      );
    }

    if (advertisingTypeRaw === "mosque_sponsor" && !selectedMosqueId) {
      return jsonResponse(
        {
          ok: false,
          error: "Mosque sponsorship requires selected_mosque_id.",
        },
        400
      );
    }

    if (advertisingTypeRaw === "multi_mosque" && !selectedMosqueIds) {
      return jsonResponse(
        {
          ok: false,
          error: "Multiple mosque sponsorship requires selected_mosque_ids.",
        },
        400
      );
    }

    if (advertisingTypeRaw === "multi_city" && !selectedCityIds) {
      return jsonResponse(
        {
          ok: false,
          error: "Multi-city campaigns require selected_city_ids.",
        },
        400
      );
    }

    const payload = {
      advertising_type: advertisingTypeRaw,
      selected_city_id: selectedCityId,
      selected_mosque_id: selectedMosqueId,
      selected_mosque_ids: selectedMosqueIds,
      selected_city_ids: selectedCityIds,
      notes,
      owner_email: ownerEmail,
      business_id: businessId,
      status: "draft",
      payment_status: "unpaid",
    };

    const { data, error } = await supabaseAdmin
      .from("advertising_campaign_requests")
      .insert(payload)
      .select("id, advertising_type, status, payment_status, created_at")
      .single();

    if (error) {
      console.error("advertise setup insert error:", error);

      return jsonResponse(
        {
          ok: false,
          error: error.message,
        },
        500
      );
    }

    return jsonResponse(
      {
        ok: true,
        campaign: data,
        campaign_id: data.id,
      },
      201
    );
  } catch (error) {
    console.error("advertise setup route error:", error);

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not create campaign setup.",
      },
      500
    );
  }
}