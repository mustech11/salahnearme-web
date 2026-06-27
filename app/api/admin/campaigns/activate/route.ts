import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type PricingTier =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "featured"
  | "mosque_sponsor"
  | "city_sponsor";

type ActivateBody = {
  campaign_id: string;
  business_id: string;
  pricing_tier: PricingTier;
  featured_rank?: number | null;
  sponsor_mosque_id?: string | null;
  sponsor_city_id?: number | null;
  duration_days?: number | null;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isPricingTier(value: string): value is PricingTier {
  return [
    "bronze",
    "silver",
    "gold",
    "platinum",
    "featured",
    "mosque_sponsor",
    "city_sponsor",
  ].includes(value);
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as ActivateBody | null;

    const campaignId = clean(body?.campaign_id);
    const businessId = clean(body?.business_id);
    const pricingTier = clean(body?.pricing_tier);
    const sponsorMosqueId = clean(body?.sponsor_mosque_id);

    const featuredRank =
      typeof body?.featured_rank === "number" &&
      Number.isFinite(body.featured_rank) &&
      body.featured_rank > 0
        ? body.featured_rank
        : null;

    const sponsorCityId =
      typeof body?.sponsor_city_id === "number" &&
      Number.isFinite(body.sponsor_city_id)
        ? body.sponsor_city_id
        : null;

    const durationDays =
      typeof body?.duration_days === "number" &&
      Number.isFinite(body.duration_days) &&
      body.duration_days > 0
        ? Math.min(body.duration_days, 366)
        : 30;

    if (!campaignId || !businessId || !isPricingTier(pricingTier)) {
      return NextResponse.json(
        { error: "Missing or invalid activation fields." },
        { status: 400 }
      );
    }

    const paidUntil = addDays(durationDays);
    const activatedAt = new Date().toISOString();

    const isMosqueSponsor = pricingTier === "mosque_sponsor" || !!sponsorMosqueId;
    const isCitySponsor = pricingTier === "city_sponsor";

    const businessUpdate: Record<string, unknown> = {
      featured: true,
      pricing_tier: pricingTier,
      subscription_type: pricingTier,
      paid_until: paidUntil,
      can_advertise: true,
      status: "approved",
      review_status: "approved",
      is_live: true,
      sponsorship_active: true,
      mosque_sponsor: isMosqueSponsor,
      city_sponsor: isCitySponsor,
    };

    if (featuredRank !== null) {
      businessUpdate.featured_rank = featuredRank;
    }

    businessUpdate.sponsor_mosque_id = sponsorMosqueId || null;

    if (sponsorCityId !== null) {
      businessUpdate.sponsor_city_id = sponsorCityId;
    }

    const { error: businessError } = await supabaseAdmin
      .from("businesses")
      .update(businessUpdate)
      .eq("id", businessId);

    if (businessError) {
      return NextResponse.json(
        { error: businessError.message },
        { status: 500 }
      );
    }

    const { error: campaignError } = await supabaseAdmin
      .from("advertising_campaign_requests")
      .update({
        status: "active",
        payment_status: "paid",
        activated_at: activatedAt,
        paid_until: paidUntil,
        business_id: businessId,
        selected_mosque_id: sponsorMosqueId || null,
        selected_city_id: sponsorCityId,
      })
      .eq("id", campaignId);

    if (campaignError) {
      return NextResponse.json(
        { error: campaignError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      campaign_id: campaignId,
      business_id: businessId,
      pricing_tier: pricingTier,
      paid_until: paidUntil,
    });
  } catch (error) {
    console.error("activate campaign route error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not activate campaign",
      },
      { status: 500 }
    );
  }
}

