export type TrustInput = {
  is_verified?: boolean | null;
  verified_status?: string | null;
  claim_status?: string | null;
  featured?: boolean | null;
  pricing_tier?: string | null;
  paid_until?: string | null;
  halal_confidence?: string | null;
  halal_score?: number | null;
  review_status?: string | null;
  is_live?: boolean | null;
  quality_status?: string | null;
  source?: string | null;
  live_report_count?: number | null;
  distance_miles?: number | null;
  has_coordinates?: boolean | null;
  has_phone?: boolean | null;
  has_website?: boolean | null;
  has_address?: boolean | null;
};

export type TrustScoreResult = {
  score: number;
  level: "low" | "medium" | "high" | "trusted";
  reasons: string[];
};

function isPaidActive(paidUntil?: string | null) {
  if (!paidUntil) return false;
  return new Date(paidUntil).getTime() > Date.now();
}

function levelFromScore(score: number): TrustScoreResult["level"] {
  if (score >= 80) return "trusted";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

export function calculateTrustScore(input: TrustInput): TrustScoreResult {
  let score = 0;
  const reasons: string[] = [];

  if (input.is_verified || input.verified_status === "verified_from_directory") {
    score += 25;
    reasons.push("Verified");
  }

  if (input.claim_status === "approved" || input.claim_status === "claimed") {
    score += 20;
    reasons.push("Claimed by management");
  }

  if (input.review_status === "approved") {
    score += 15;
    reasons.push("Approved by review");
  }

  if (input.is_live) {
    score += 10;
    reasons.push("Live listing");
  }

  if (input.featured) {
    score += 8;
    reasons.push("Featured");
  }

  if (input.pricing_tier && input.pricing_tier !== "free") {
    score += 6;
    reasons.push("Premium placement");
  }

  if (isPaidActive(input.paid_until)) {
    score += 8;
    reasons.push("Active paid placement");
  }

  if (input.halal_confidence === "high") {
    score += 18;
    reasons.push("High halal confidence");
  } else if (input.halal_confidence === "medium") {
    score += 10;
    reasons.push("Medium halal confidence");
  } else if (input.halal_confidence === "low") {
    score += 3;
    reasons.push("Low halal confidence");
  }

  if (typeof input.halal_score === "number") {
    score += Math.min(12, Math.max(0, input.halal_score));
    reasons.push("Halal score signals");
  }

  if (input.quality_status === "auto_approved") {
    score += 10;
    reasons.push("Quality approved");
  } else if (input.quality_status === "needs_review") {
    score -= 8;
    reasons.push("Needs review");
  } else if (input.quality_status === "auto_rejected") {
    score -= 30;
    reasons.push("Rejected quality");
  }

  if (input.has_coordinates) {
    score += 6;
    reasons.push("Map-ready");
  }

  if (input.has_address) {
    score += 5;
    reasons.push("Has address");
  }

  if (input.has_phone) {
    score += 4;
    reasons.push("Has phone");
  }

  if (input.has_website) {
    score += 4;
    reasons.push("Has website");
  }

  if (typeof input.live_report_count === "number") {
    if (input.live_report_count >= 5) {
      score += 15;
      reasons.push("Strong live activity");
    } else if (input.live_report_count >= 2) {
      score += 8;
      reasons.push("Recent live activity");
    } else if (input.live_report_count >= 1) {
      score += 4;
      reasons.push("Some live activity");
    }
  }

  if (typeof input.distance_miles === "number") {
    if (input.distance_miles <= 0.5) {
      score += 10;
      reasons.push("Very nearby");
    } else if (input.distance_miles <= 1.5) {
      score += 6;
      reasons.push("Nearby");
    } else if (input.distance_miles <= 3) {
      score += 3;
      reasons.push("Within local area");
    }
  }

  if (input.source?.includes("openstreetmap")) {
    score += 2;
    reasons.push("Imported from OpenStreetMap");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    level: levelFromScore(score),
    reasons: Array.from(new Set(reasons)).slice(0, 6),
  };
}

export function trustBadgeClass(level: TrustScoreResult["level"]) {
  if (level === "trusted") {
    return "border-green-500/30 bg-green-500/10 text-green-300";
  }

  if (level === "high") {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
  }

  if (level === "medium") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  }

  return "border-white/10 bg-white/5 text-white/60";
}

export function trustLabel(level: TrustScoreResult["level"]) {
  if (level === "trusted") return "Trusted";
  if (level === "high") return "High trust";
  if (level === "medium") return "Medium trust";
  return "Low trust";
}

