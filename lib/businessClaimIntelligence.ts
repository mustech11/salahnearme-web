export type BusinessClaimRow = {
  id: string;
  business_id: string;
  business_slug: string | null;
  business_name: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  role: string | null;
  relationship: string | null;
  proof: string | null;
  status: string | null;
  created_at: string;
};

export type BusinessForClaimReview = {
  id: string;
  name: string | null;
  slug: string | null;
  email: string | null;
  website: string | null;
  phone: string | null;
  city: string | null;
  is_claimed: boolean | null;
  claimed_by_email: string | null;
  is_verified: boolean | null;
  submitted_by_email: string | null;
};

export type ClaimRecommendation = {
  score: number;
  riskScore: number;
  recommendation: "approve" | "review" | "reject";
  reasons: string[];
  risks: string[];
};

const freeEmailDomains = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

function normalise(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function emailDomain(value: string | null | undefined) {
  const email = normalise(value);
  const parts = email.split("@");
  return parts.length === 2 ? parts[1] : "";
}

function websiteDomain(value: string | null | undefined) {
  const raw = normalise(value);

  if (!raw) return "";

  try {
    const normalized = raw.startsWith("http") ? raw : `https://${raw}`;
    const url = new URL(normalized);

    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalisePhone(value: string | null | undefined) {
  return (value ?? "").replace(/[^\d+]/g, "");
}

function containsUsefulProof(value: string | null | undefined) {
  const proof = normalise(value);

  if (!proof) return false;

  return (
    proof.length >= 20 ||
    proof.includes("document") ||
    proof.includes("invoice") ||
    proof.includes("utility") ||
    proof.includes("company") ||
    proof.includes("website") ||
    proof.includes("email") ||
    proof.includes("photo") ||
    proof.includes("letter")
  );
}

function roleLooksOfficial(value: string | null | undefined) {
  const role = normalise(value);

  return [
    "owner",
    "manager",
    "director",
    "founder",
    "partner",
    "ceo",
    "administrator",
    "admin",
    "marketing",
  ].some((word) => role.includes(word));
}

function businessNameMentioned(
  claim: BusinessClaimRow,
  business: BusinessForClaimReview
) {
  const proofText = `${claim.relationship ?? ""} ${claim.proof ?? ""}`.toLowerCase();
  const name = normalise(business.name);

  if (!name || name.length < 4) return false;

  return proofText.includes(name);
}

export function buildBusinessClaimRecommendation(args: {
  claim: BusinessClaimRow;
  business: BusinessForClaimReview | null;
}): ClaimRecommendation {
  const { claim, business } = args;

  let score = 0;
  let riskScore = 0;

  const reasons: string[] = [];
  const risks: string[] = [];

  if (!business) {
    return {
      score: 0,
      riskScore: 100,
      recommendation: "reject",
      reasons: ["Business record was not found."],
      risks: ["Cannot verify ownership without a matching business record."],
    };
  }

  const claimEmail = normalise(claim.email);
  const businessEmail = normalise(business.email);
  const claimedByEmail = normalise(business.claimed_by_email);
  const submittedByEmail = normalise(business.submitted_by_email);

  const claimDomain = emailDomain(claim.email);
  const businessEmailDomain = emailDomain(business.email);
  const websiteDomainValue = websiteDomain(business.website);

  const isFreeEmail = freeEmailDomains.has(claimDomain);

  if (business.is_claimed && claimedByEmail !== claimEmail) {
    score -= 50;
    riskScore += 40;
    risks.push("This business is already claimed by a different email.");
  }

  if (business.is_claimed && claimedByEmail === claimEmail) {
    score += 50;
    reasons.push("Claim email matches the current claimed owner email.");
  }

  if (submittedByEmail && submittedByEmail === claimEmail) {
    score += 35;
    reasons.push("Claim email matches the original business submitter email.");
  }

  if (businessEmail && businessEmail === claimEmail) {
    score += 45;
    reasons.push("Claim email exactly matches the business listing email.");
  }

  if (
    claimDomain &&
    businessEmailDomain &&
    claimDomain === businessEmailDomain &&
    !isFreeEmail
  ) {
    score += 35;
    reasons.push("Claim email domain matches the business email domain.");
  }

  if (
    claimDomain &&
    websiteDomainValue &&
    claimDomain === websiteDomainValue &&
    !isFreeEmail
  ) {
    score += 35;
    reasons.push("Claim email domain matches the business website domain.");
  }

  if (isFreeEmail) {
    riskScore += 10;
    risks.push("Claim uses a free email provider, so ownership should be reviewed carefully.");
  }

  const claimPhone = normalisePhone(claim.phone);
  const businessPhone = normalisePhone(business.phone);

  if (claimPhone && businessPhone && claimPhone === businessPhone) {
    score += 25;
    reasons.push("Claim phone matches the business listing phone.");
  }

  if (roleLooksOfficial(claim.role)) {
    score += 15;
    reasons.push("Claimant role appears to be official.");
  } else if (claim.role) {
    score += 5;
    reasons.push("Claim includes a stated role.");
  } else {
    riskScore += 5;
    risks.push("No claimant role was provided.");
  }

  if ((claim.relationship ?? "").trim().length >= 30) {
    score += 12;
    reasons.push("Claim includes a meaningful ownership explanation.");
  } else {
    riskScore += 5;
    risks.push("Ownership explanation is short or missing.");
  }

  if (containsUsefulProof(claim.proof)) {
    score += 20;
    reasons.push("Claim includes useful supporting proof.");
  } else {
    riskScore += 15;
    risks.push("Supporting proof is weak or missing.");
  }

  if (businessNameMentioned(claim, business)) {
    score += 8;
    reasons.push("Claim text references the business name.");
  }

  if (business.website && !websiteDomainValue) {
    riskScore += 5;
    risks.push("Business website exists but domain could not be parsed.");
  }

  if (business.is_verified) {
    score += 5;
    reasons.push("Business is already verified, so ownership review is worth prioritising.");
  }

  if (claim.business_name && business.name) {
    const claimBusinessName = normalise(claim.business_name);
    const listedBusinessName = normalise(business.name);

    if (
      claimBusinessName &&
      listedBusinessName &&
      claimBusinessName !== listedBusinessName &&
      !claimBusinessName.includes(listedBusinessName) &&
      !listedBusinessName.includes(claimBusinessName)
    ) {
      riskScore += 15;
      risks.push("Claimed business name does not closely match the listing name.");
    }
  }

  const finalScore = Math.max(0, Math.min(100, score - Math.floor(riskScore / 2)));

  let recommendation: "approve" | "review" | "reject" = "review";

  if (finalScore >= 70 && riskScore < 35) {
    recommendation = "approve";
  } else if (finalScore < 25 || riskScore >= 70) {
    recommendation = "reject";
  }

  return {
    score: finalScore,
    riskScore,
    recommendation,
    reasons:
      reasons.length > 0
        ? reasons
        : ["No strong positive ownership signals were found."],
    risks:
      risks.length > 0
        ? risks
        : ["No major risk signals detected."],
  };
}

