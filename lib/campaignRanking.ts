export const campaignPriority: Record<string, number> = {
  multi_city: 400,
  multi_mosque: 300,
  mosque_sponsor: 200,
  city_featured: 100,
};

export function getCampaignPriority(type: string | null | undefined) {
  if (!type) return 0;
  return campaignPriority[type] ?? 0;
}

