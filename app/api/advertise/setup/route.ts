import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = {
  advertising_type?: string;
  selected_city_id?: number | null;
  selected_mosque_id?: string | null;
  selected_mosque_ids?: string[] | null;
  selected_city_ids?: number[] | null;
  notes?: string | null;
  owner_email?: string | null;
  business_id?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const advertisingType = (body.advertising_type ?? "").trim();

    if (!advertisingType) {
      return NextResponse.json(
        { error: "Missing advertising_type" },
        { status: 400 }
      );
    }

    const payload = {
      advertising_type: advertisingType,
      selected_city_id: body.selected_city_id ?? null,
      selected_mosque_id: body.selected_mosque_id ?? null,
      selected_mosque_ids: body.selected_mosque_ids ?? null,
      selected_city_ids: body.selected_city_ids ?? null,
      notes: body.notes?.trim() || null,
      owner_email: body.owner_email?.trim() || null,
      business_id: body.business_id?.trim() || null,
      status: "draft",
      payment_status: "unpaid",
    };

    const { data, error } = await supabaseAdmin
      .from("advertising_campaign_requests")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error("advertise setup error:", error);
    return NextResponse.json(
      { error: "Could not create campaign setup" },
      { status: 500 }
    );
  }
}

