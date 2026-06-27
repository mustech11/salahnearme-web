import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      business_id,
      customer_name,
      customer_email,
      customer_phone,
      subject,
      message,
      lead_type,
    } = body;

    if (!business_id || !message) {
      return NextResponse.json(
        {
          error: "Missing required fields",
        },
        {
          status: 400,
        }
      );
    }

    const { error } =
      await supabaseAdmin
        .from("business_leads")
        .insert({
          business_id,

          customer_name,
          customer_email,
          customer_phone,

          subject,
          message,

          lead_type:
            lead_type ?? "general",
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
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          "Could not create lead",
      },
      {
        status: 500,
      }
    );
  }
}

