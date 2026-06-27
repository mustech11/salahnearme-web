"use client";

import Link from "next/link";
import { useMemo } from "react";

function getHijriDate() {
  try {
    return new Intl.DateTimeFormat("en-GB-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
  } catch {
    return "Hijri date";
  }
}

export default function HomeHajjHijriBanner() {
  const hijriDate = useMemo(() => getHijriDate(), []);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-yellow-500/20 bg-black">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-70"
        style={{
          backgroundImage: "url('/images/kaaba-bg.png')",
        }}
        aria-hidden="true"
      />

      <div
        className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/45"
        aria-hidden="true"
      />

      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(234,179,8,0.22),transparent_35%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 grid gap-8 p-8 md:p-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Dhul Hijjah Special
          </div>

          <h2 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
            Hajj & Umrah guides now live on SalahNearMe
          </h2>

          <p className="mt-4 max-w-3xl text-white/75 md:text-lg">
            Learn the rituals of Hajj and Umrah step by step, with Qur’an
            reminders, Sunnah-based guidance, checklists, duas, and travel
            support.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/hajj"
              className="rounded-2xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-yellow-400"
            >
              Open Hajj guide
            </Link>

            <Link
              href="/umrah"
              className="rounded-2xl border border-yellow-500/30 bg-black/70 px-5 py-3 text-sm font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
            >
              Open Umrah guide
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-yellow-500/20 bg-black/50 p-6 backdrop-blur-sm">
          <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
            Today in Hijri
          </div>

          <div className="mt-3 text-3xl font-bold text-white">
            {hijriDate}
          </div>

          <p className="mt-3 text-sm leading-6 text-white/60">
            Hijri date is approximate and may vary by moon sighting and local
            authority.
          </p>
        </div>
      </div>
    </section>
  );
}

