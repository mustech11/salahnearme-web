type Business = {
  id: string;
  featured: boolean | null;
  featured_rank: number | null;
  city_sponsor: boolean | null;
  mosque_sponsor: boolean | null;
  paid_until: string | null;
};

function isActive(date?: string | null) {
  if (!date) return false;

  const time = new Date(date).getTime();

  return Number.isFinite(time) && time > Date.now();
}

export function rotateSponsors<T extends Business>(
  businesses: T[]
) {
  const active = businesses.filter(
    (b) =>
      isActive(b.paid_until) &&
      (b.city_sponsor || b.mosque_sponsor || b.featured)
  );

  const normal = businesses.filter(
    (b) =>
      !(
        isActive(b.paid_until) &&
        (b.city_sponsor || b.mosque_sponsor || b.featured)
      )
  );

  const minute = new Date().getMinutes();

  active.sort((a, b) => {
    const aRank = a.featured_rank ?? 999;
    const bRank = b.featured_rank ?? 999;

    return aRank - bRank;
  });

  if (active.length > 1) {
    const rotation = minute % active.length;

    const rotated = [
      ...active.slice(rotation),
      ...active.slice(0, rotation),
    ];

    return [...rotated, ...normal];
  }

  return [...active, ...normal];
}

