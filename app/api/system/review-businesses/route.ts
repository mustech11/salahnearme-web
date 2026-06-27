import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calculateBusinessAIReview } from "@/lib/businessAIReview";

export async function POST(req: Request) {
  try {
    const auth =
      req.headers.get("authorization");

    if (
      auth !==
      `Bearer ${process.env.CRON_SECRET}`
    ) {
      return new NextResponse(
        "Unauthorized",
        {
          status: 401,
        }
      );
    }

    const { data, error } =
      await supabaseAdmin
        .from("businesses")
        .select("*")
        .limit(1000);

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

    for (const business of data ?? []) {
      const review =
        calculateBusinessAIReview(
          business
        );

      await supabaseAdmin
        .from("businesses")
        .update({
          ...review,

          ai_reviewed: true,

          ai_reviewed_at:
            new Date().toISOString(),
        })
        .eq("id", business.id);
    }

    return NextResponse.json({
      ok: true,
      reviewed:
        data?.length ?? 0,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          "Business review failed",
      },
      {
        status: 500,
      }
    );
  }
}

