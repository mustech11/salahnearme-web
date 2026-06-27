export type DuplicateEntityType = "mosque" | "business";

export type DuplicateCandidateInput = {
  id: string;
  name?: string | null;
  slug?: string | null;
  city?: string | null;
  postcode?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
};

export type DuplicateCandidate = {
  left_id: string;
  right_id: string;
  entity_type: DuplicateEntityType;
  confidence: number;
  reasons: string[];
};

function clean(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizePhone(value: string | null | undefined) {
  return clean(value).replace(/[^0-9+]/g, "");
}

function normalizeWebsite(value: string | null | undefined) {
  const v = clean(value);
  return v
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

function normalizeText(value: string | null | undefined) {
  return clean(value)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string | null | undefined) {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter(Boolean)
  );
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function detectDuplicates(
  items: DuplicateCandidateInput[],
  entityType: DuplicateEntityType
): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const left = items[i];
      const right = items[j];

      const reasons: string[] = [];
      let confidence = 0;

      const leftName = normalizeText(left.name);
      const rightName = normalizeText(right.name);

      const leftCity = normalizeText(left.city);
      const rightCity = normalizeText(right.city);

      const leftPostcode = normalizeText(left.postcode);
      const rightPostcode = normalizeText(right.postcode);

      const leftPhone = normalizePhone(left.phone);
      const rightPhone = normalizePhone(right.phone);

      const leftWebsite = normalizeWebsite(left.website);
      const rightWebsite = normalizeWebsite(right.website);

      const leftAddress = normalizeText(left.address);
      const rightAddress = normalizeText(right.address);

      if (left.slug && right.slug && clean(left.slug) === clean(right.slug)) {
        confidence += 100;
        reasons.push("Matching slug");
      }

      if (leftWebsite && rightWebsite && leftWebsite === rightWebsite) {
        confidence += 85;
        reasons.push("Matching website");
      }

      if (leftPhone && rightPhone && leftPhone === rightPhone) {
        confidence += 75;
        reasons.push("Matching phone");
      }

      if (
        leftName &&
        rightName &&
        leftName === rightName &&
        leftPostcode &&
        rightPostcode &&
        leftPostcode === rightPostcode
      ) {
        confidence += 95;
        reasons.push("Matching name and postcode");
      }

      if (
        leftName &&
        rightName &&
        leftName === rightName &&
        leftCity &&
        rightCity &&
        leftCity === rightCity
      ) {
        confidence += 70;
        reasons.push("Matching name and city");
      }

      if (
        leftAddress &&
        rightAddress &&
        leftAddress === rightAddress &&
        leftCity &&
        rightCity &&
        leftCity === rightCity
      ) {
        confidence += 60;
        reasons.push("Matching address and city");
      }

      const nameSimilarity = jaccard(tokenize(left.name), tokenize(right.name));
      if (nameSimilarity >= 0.85) {
        confidence += 40;
        reasons.push(`Very similar name (${Math.round(nameSimilarity * 100)}%)`);
      } else if (nameSimilarity >= 0.65) {
        confidence += 20;
        reasons.push(`Similar name (${Math.round(nameSimilarity * 100)}%)`);
      }

      if (
        leftCity &&
        rightCity &&
        leftCity === rightCity &&
        nameSimilarity >= 0.65
      ) {
        confidence += 15;
        reasons.push("Same city with similar name");
      }

      if (entityType === "business" && leftPostcode && rightPostcode && leftPostcode === rightPostcode) {
        confidence += 10;
        reasons.push("Matching postcode");
      }

      if (entityType === "mosque" && leftPostcode && rightPostcode && leftPostcode === rightPostcode) {
        confidence += 15;
        reasons.push("Matching postcode");
      }

      if (confidence >= 60) {
        candidates.push({
          left_id: left.id,
          right_id: right.id,
          entity_type: entityType,
          confidence: Math.min(confidence, 100),
          reasons,
        });
      }
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

