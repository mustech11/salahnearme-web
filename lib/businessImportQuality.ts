export type BusinessQualityInput = {
  name: string | null;
  category: string | null;
  halal_confidence: string | null;
  halal_score: number | null;
  distance_km: number | null;
  imported_for_city: string | null;
  address: string | null;
};

export type BusinessQualityDecision = {
  review_status: "approved" | "pending" | "rejected";
  is_live: boolean;
  quality_status: "auto_approved" | "needs_review" | "auto_rejected";
  quality_reason: string;
};

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

export function decideBusinessQuality(
  input: BusinessQualityInput
): BusinessQualityDecision {
  const name = (input.name ?? "").toLowerCase();
  const category = (input.category ?? "").toLowerCase();
  const address = (input.address ?? "").toLowerCase();
  const city = (input.imported_for_city ?? "").toLowerCase();
  const confidence = input.halal_confidence ?? "low";
  const score = input.halal_score ?? 0;
  const distance = input.distance_km ?? 999;

  const strongHalalSignal =
    name.includes("halal") ||
    includesAny(name, ["islamic", "muslim", "quran", "qur'an", "madina"]) ||
    confidence === "high";

  const foodSignal = includesAny(category, [
    "restaurant",
    "takeaway",
    "food",
    "butcher",
    "grocery",
    "supermarket",
    "cafe",
  ]);

  const muslimBusinessSignal = includesAny(category, [
    "islamic",
    "book",
    "clothing",
    "business",
  ]);

  const cityMismatch =
    city.length > 0 &&
    address.length > 0 &&
    !address.includes(city) &&
    distance > 12;

  if (distance > 25) {
    return {
      review_status: "rejected",
      is_live: false,
      quality_status: "auto_rejected",
      quality_reason: `Rejected automatically: too far from import city (${distance.toFixed(
        1
      )}km).`,
    };
  }

  if (cityMismatch) {
    return {
      review_status: "pending",
      is_live: false,
      quality_status: "needs_review",
      quality_reason: `Needs review: address may not match imported city and distance is ${distance.toFixed(
        1
      )}km.`,
    };
  }

  if (confidence === "high" && score >= 20 && distance <= 10 && foodSignal) {
    return {
      review_status: "approved",
      is_live: true,
      quality_status: "auto_approved",
      quality_reason: `Auto-approved: high confidence food business within ${distance.toFixed(
        1
      )}km.`,
    };
  }

  if (strongHalalSignal && distance <= 12 && (foodSignal || muslimBusinessSignal)) {
    return {
      review_status: "approved",
      is_live: true,
      quality_status: "auto_approved",
      quality_reason: `Auto-approved: strong halal/community signal within ${distance.toFixed(
        1
      )}km.`,
    };
  }

  return {
    review_status: "pending",
    is_live: false,
    quality_status: "needs_review",
    quality_reason: `Needs review: confidence=${confidence}, score=${score}, distance=${distance.toFixed(
      1
    )}km.`,
  };
}

