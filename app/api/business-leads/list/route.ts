import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  try {
    const { searchParams } =
      new URL(req.url);

    const businessId =
      searchParams.get(
        "business_id"
      );

    if (!businessId) {
      return NextResponse.json(
        {
          error:
            "Missing business_id",
        },
        {
          status: 400,
        }
      );
    }

    const { data, error } =
      await supabaseAdmin
        .from("business_leads")
        .select("*")
        .eq(
          "business_id",
          businessId
        )
        .order("created_at", {
          ascending: false,
        });

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      leads: data ?? [],
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          "Could not fetch leads",
      },
      {
        status: 500,
      }
    );
  }
}

