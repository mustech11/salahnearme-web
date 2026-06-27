import MosqueDuplicateReviewClient from "@/components/MosqueDuplicateReviewClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type MosqueRow = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
  postcode: string | null;
  address: string | null;
  area: string | null;
  source: string | null;
  verified_status: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string | null;
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[āáàäâ]/g, "a")
    .replace(/[ēéèëê]/g, "e")
    .replace(/[īíìïî]/g, "i")
    .replace(/[ōóòöô]/g, "o")
    .replace(/[ūúùüû]/g, "u")
    .replace(/[^a-z0-9]/g, "");
}

function scoreKeepRecord(mosque: MosqueRow) {
  let score = 0;

  const verifiedStatus = (mosque.verified_status ?? "").toLowerCase();
  const source = (mosque.source ?? "").toLowerCase();

  if (
    verifiedStatus.includes("verified") ||
    verifiedStatus.includes("directory") ||
    verifiedStatus.includes("claimed")
  ) {
    score += 100;
  }

  if (mosque.address) {
    score += 30;
  }

  if (mosque.postcode) {
    score += 20;
  }

  if (
    typeof mosque.latitude === "number" &&
    Number.isFinite(mosque.latitude) &&
    typeof mosque.longitude === "number" &&
    Number.isFinite(mosque.longitude)
  ) {
    score += 20;
  }

  if (mosque.slug) {
    score += 10;
  }

  if (source && !source.includes("auto") && !source.includes("osm")) {
    score += 10;
  }

  return score;
}

function getDuplicateKey(mosque: MosqueRow) {
  const city = normalize(mosque.city);
  const postcode = normalize(mosque.postcode);
  const name = normalize(mosque.name);
  const address = normalize(mosque.address);

  if (postcode && name) {
    return `${city}|${postcode}|${name}`;
  }

  if (city && name && address) {
    return `${city}|${name}|${address}`;
  }

  return `${city}|${name}`;
}

function sortDuplicateGroup(group: MosqueRow[]) {
  return [...group].sort((a, b) => {
    const scoreDiff = scoreKeepRecord(b) - scoreKeepRecord(a);

    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return (
      new Date(a.created_at ?? 0).getTime() -
      new Date(b.created_at ?? 0).getTime()
    );
  });
}

export default async function MosqueDuplicatesPage() {
  const { data, error } = await supabaseAdmin
    .from("mosques")
    .select(
      "id,name,slug,city,postcode,address,area,source,verified_status,latitude,longitude,created_at"
    )
    .eq("is_active", true)
    .order("city", { ascending: true })
    .order("name", { ascending: true })
    .limit(3000);

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-200">
          {error.message}
        </section>
      </main>
    );
  }

  const mosques = (data ?? []) as MosqueRow[];

  const groups = new Map<string, MosqueRow[]>();

  for (const mosque of mosques) {
    const key = getDuplicateKey(mosque);

    if (!key.replace(/\|/g, "").trim()) {
      continue;
    }

    const existing = groups.get(key) ?? [];
    existing.push(mosque);
    groups.set(key, existing);
  }

  const duplicateGroups = Array.from(groups.values())
    .filter((group) => group.length > 1)
    .map(sortDuplicateGroup);

  const duplicateRecordCount = duplicateGroups.reduce(
    (total, group) => total + group.length,
    0
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="space-y-8">
        <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Admin
          </div>

          <h1 className="mt-3 text-4xl font-black text-white">
            Mosque Duplicate Review Queue
          </h1>

          <p className="mt-3 max-w-4xl text-sm leading-7 text-white/70">
            Review likely duplicate mosques, keep the strongest record, and
            merge weaker imported records into it. The suggested keep record is
            based on verification, address quality, postcode, coordinates, slug,
            and source quality.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
                Duplicate Groups
              </div>

              <div className="mt-2 text-3xl font-black text-white">
                {duplicateGroups.length}
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">
                Duplicate Records
              </div>

              <div className="mt-2 text-3xl font-black text-white">
                {duplicateRecordCount}
              </div>
            </div>

            <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-green-300">
                Records Checked
              </div>

              <div className="mt-2 text-3xl font-black text-white">
                {mosques.length}
              </div>
            </div>
          </div>
        </section>

        <MosqueDuplicateReviewClient groups={duplicateGroups} />
      </div>
    </main>
  );
}

