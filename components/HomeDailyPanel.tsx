import { supabasePublic } from "@/lib/supabaseServer";

type Props = {
  cityId?: number | null;
  cityName?: string | null;
};

function getToday() {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

export default async function HomeDailyPanel({ cityId, cityName }: Props) {
  const supabase = supabasePublic();
  const { month, year } = getToday();

  let prayerTimes = null;
  let hadith = null;

  if (cityId) {
    const { data } = await supabase
      .from("city_prayer_times")
      .select("*")
      .eq("city_id", cityId)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle();

    prayerTimes = data;
  }

  const { data: hadithRow } = await supabase
    .from("hadiths")
    .select("english_text,arabic_text,collection")
    .limit(1)
    .single();

  hadith = hadithRow;

  return (
    <section className="grid gap-6 lg:grid-cols-3">
      {/* Prayer Times */}
      <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
        <div className="text-sm uppercase text-yellow-400">
          Prayer Times
        </div>

        <h3 className="mt-2 text-xl font-bold text-white">
          {cityName ?? "Your city"}
        </h3>

        {prayerTimes ? (
          <div className="mt-4 space-y-2 text-white/80">
            <div>Fajr: {prayerTimes.fajr_start}</div>
            <div>Dhuhr: {prayerTimes.dhuhr_start}</div>
            <div>Asr: {prayerTimes.asr_start}</div>
            <div>Maghrib: {prayerTimes.maghrib_start}</div>
            <div>Isha: {prayerTimes.isha_start}</div>
          </div>
        ) : (
          <div className="mt-4 text-white/60">
            Select a city to see prayer times
          </div>
        )}
      </div>

      {/* Hadith */}
      <div className="rounded-3xl border border-yellow-500/20 bg-black/30 p-6">
        <div className="text-sm uppercase text-yellow-400">
          Daily Hadith
        </div>

        {hadith ? (
          <>
            <p className="mt-4 text-white/80 italic">
              {hadith.english_text}
            </p>

            {hadith.arabic_text && (
              <p className="mt-3 text-right text-white/70">
                {hadith.arabic_text}
              </p>
            )}

            <div className="mt-3 text-xs text-white/50">
              {hadith.collection}
            </div>
          </>
        ) : (
          <div className="mt-4 text-white/60">No hadith available</div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
        <div className="text-sm uppercase text-yellow-400">
          Quick Actions
        </div>

        <div className="mt-4 grid gap-3">
          <a
            href="/travel/near-me"
            className="rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black text-center hover:bg-yellow-400"
          >
            Near Me
          </a>

          <a
            href="/travel/map"
            className="rounded-xl border border-yellow-500/30 px-4 py-3 text-sm font-semibold text-yellow-400 text-center hover:bg-yellow-500/10"
          >
            Map View
          </a>

          <a
            href="/hajj"
            className="rounded-xl border border-yellow-500/30 px-4 py-3 text-sm font-semibold text-yellow-400 text-center hover:bg-yellow-500/10"
          >
            Hajj Guide
          </a>
        </div>
      </div>
    </section>
  );
}

