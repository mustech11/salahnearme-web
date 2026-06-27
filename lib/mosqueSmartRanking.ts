import type { MosqueLiveTrust } from "@/lib/mosqueTrust";

export type SmartRankMosque = {
  id: string;
  name: string | null;
  slug: string | null;
  area: string | null;
  postcode: string | null;
};

export function sortMosquesByTrustAndActivity(
  mosques: SmartRankMosque[],
  liveMap: Map<string, MosqueLiveTrust>
) {
  return [...mosques].sort((a, b) => {
    const aLive = liveMap.get(a.id);
    const bLive = liveMap.get(b.id);

    const aScore = aLive?.trustScore ?? 0;
    const bScore = bLive?.trustScore ?? 0;

    if (aScore !== bScore) return bScore - aScore;

    return (a.name ?? "").localeCompare(b.name ?? "");
  });
}

