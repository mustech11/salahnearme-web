type Business = {
  name?: string | null;
  description?: string | null;
  website?: string | null;
  phone?: string | null;
  address?: string | null;

  is_verified?: boolean | null;
};

export function calculateBusinessAIReview(
  business: Business
) {
  let trust = 0;
  let quality = 0;
  let halal = 0;

  /*
  -----------------------------------
  Trust
  -----------------------------------
  */

  if (business.is_verified) {
    trust += 40;
  }

  if (business.website) {
    trust += 10;
  }

  if (business.phone) {
    trust += 10;
  }

  if (business.address) {
    trust += 10;
  }

  /*
  -----------------------------------
  Quality
  -----------------------------------
  */

  if (business.name) {
    quality += 15;
  }

  if (
    business.description &&
    business.description.length > 80
  ) {
    quality += 30;
  }

  /*
  -----------------------------------
  Halal confidence
  -----------------------------------
  */

  const text = `
    ${business.name ?? ""}
    ${business.description ?? ""}
  `.toLowerCase();

  const halalKeywords = [
    "halal",
    "muslim",
    "islamic",
    "sunnah",
    "hmc",
    "masjid",
  ];

  halalKeywords.forEach((keyword) => {
    if (text.includes(keyword)) {
      halal += 8;
    }
  });

  halal = Math.min(halal, 100);

  return {
    trust_score: trust,
    quality_score: quality,
    halal_score: halal,
  };
}

