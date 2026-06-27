import type { Metadata } from "next";
import AdminGate from "@/components/AdminGate";

export const metadata: Metadata = {
  title: "Priority City Seed SQL | SalahNearMe",
};

const priorityCities = [
  ["Manchester", "manchester", "United Kingdom", "Europe/London", 53.4808, -2.2426],
  ["London", "london", "United Kingdom", "Europe/London", 51.5072, -0.1276],
  ["Birmingham", "birmingham", "United Kingdom", "Europe/London", 52.4862, -1.8904],
  ["Bradford", "bradford", "United Kingdom", "Europe/London", 53.7950, -1.7594],
  ["Leicester", "leicester", "United Kingdom", "Europe/London", 52.6369, -1.1398],
  ["Blackburn", "blackburn", "United Kingdom", "Europe/London", 53.7486, -2.4875],
  ["Luton", "luton", "United Kingdom", "Europe/London", 51.8787, -0.4200],
  ["Glasgow", "glasgow", "United Kingdom", "Europe/London", 55.8642, -4.2518],
  ["Edinburgh", "edinburgh", "United Kingdom", "Europe/London", 55.9533, -3.1883],
  ["Makkah", "makkah", "Saudi Arabia", "Asia/Riyadh", 21.3891, 39.8579],
  ["Madinah", "madinah", "Saudi Arabia", "Asia/Riyadh", 24.5247, 39.5692],
  ["Jeddah", "jeddah", "Saudi Arabia", "Asia/Riyadh", 21.4858, 39.1925],
  ["Dubai", "dubai", "United Arab Emirates", "Asia/Dubai", 25.2048, 55.2708],
  ["Abu Dhabi", "abu-dhabi", "United Arab Emirates", "Asia/Dubai", 24.4539, 54.3773],
  ["Doha", "doha", "Qatar", "Asia/Qatar", 25.2854, 51.5310],
] as const;

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}

const sql = priorityCities
  .map(([name, slug, country, timezone, latitude, longitude]) => {
    return `insert into cities (name, slug, country, timezone, latitude, longitude, is_active)
values ('${escapeSql(name)}', '${slug}', '${escapeSql(country)}', '${timezone}', ${latitude}, ${longitude}, true)
on conflict (slug)
do update set
  name = excluded.name,
  country = excluded.country,
  timezone = excluded.timezone,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  is_active = true;`;
  })
  .join("\n\n");

export default function PriorityCitySeedPage() {
  return (
    <AdminGate>
      <div className="space-y-8">
        <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
          <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
            Admin
          </div>

          <h1 className="mt-3 text-4xl font-bold text-white">
            Priority City Seed SQL
          </h1>

          <p className="mt-4 max-w-3xl text-white/70">
            Copy this SQL into Supabase to update your priority launch cities
            with coordinates, country, timezone, and active status.
          </p>
        </section>

        <section className="rounded-3xl border border-yellow-500/20 bg-black/30 p-6">
          <div className="text-xl font-bold text-yellow-400">
            Priority launch cities
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {priorityCities.map(([name, slug, country]) => (
              <div
                key={slug}
                className="rounded-2xl border border-white/10 bg-black/40 p-4"
              >
                <div className="font-semibold text-white">{name}</div>
                <div className="mt-1 text-sm text-white/50">{country}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
          <div className="text-xl font-bold text-yellow-400">
            SQL to run in Supabase
          </div>

          <p className="mt-2 text-sm text-white/60">
            This uses <span className="text-yellow-400">on conflict (slug)</span>.
            If Supabase gives an error, make sure your cities table has a unique
            constraint on <span className="text-yellow-400">slug</span>.
          </p>

          <pre className="mt-5 max-h-[600px] overflow-auto rounded-2xl border border-white/10 bg-black/50 p-4 text-xs leading-relaxed text-white/70">
            {sql}
          </pre>
        </section>
      </div>
    </AdminGate>
  );
}

