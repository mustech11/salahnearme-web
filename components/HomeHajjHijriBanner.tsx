"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type HijriDetails = {
  formattedDate: string;
  monthName: string;
  monthNumber: number | null;
  dayNumber: number | null;
};

const DEFAULT_HIJRI_DETAILS: HijriDetails = {
  formattedDate: "Hijri date loading…",
  monthName: "",
  monthNumber: null,
  dayNumber: null,
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseNumber(value: unknown): number | null {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function getHijriDetails(date = new Date()): HijriDetails {
  try {
    const formatter = new Intl.DateTimeFormat(
      "en-GB-u-ca-islamic-umalqura",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    );

    const parts = formatter.formatToParts(date);

    const dayValue = parts.find((part) => part.type === "day")?.value;
    const monthValue = parts.find((part) => part.type === "month")?.value;

    const numericFormatter = new Intl.DateTimeFormat(
      "en-GB-u-ca-islamic-umalqura",
      {
        day: "numeric",
        month: "numeric",
      }
    );

    const numericParts = numericFormatter.formatToParts(date);

    const numericDay = numericParts.find(
      (part) => part.type === "day"
    )?.value;

    const numericMonth = numericParts.find(
      (part) => part.type === "month"
    )?.value;

    return {
      formattedDate: formatter.format(date),
      monthName: cleanString(monthValue),
      monthNumber: parseNumber(numericMonth),
      dayNumber: parseNumber(numericDay ?? dayValue),
    };
  } catch {
    return {
      formattedDate: "Hijri date unavailable",
      monthName: "",
      monthNumber: null,
      dayNumber: null,
    };
  }
}

function getBannerContent(details: HijriDetails) {
  const month = details.monthNumber;
  const day = details.dayNumber;

  if (month === 9) {
    return {
      eyebrow: "Ramadan",
      title: "Stay prayer-ready throughout the blessed month",
      description:
        "Use SalahNearMe to check local prayer times, discover nearby mosques and keep essential Islamic guidance close throughout Ramadan.",
      primaryHref: "/near-me/pray",
      primaryLabel: "Find a mosque",
      secondaryHref: "/hajj",
      secondaryLabel: "Explore Islamic guides",
    };
  }

  if (month === 10 && day !== null && day <= 7) {
    return {
      eyebrow: "Eid al-Fitr",
      title: "Find local mosques and prayer information this Eid",
      description:
        "Discover nearby mosques, prayer spaces and trusted local information as communities gather to celebrate Eid al-Fitr.",
      primaryHref: "/near-me/pray",
      primaryLabel: "Find Eid prayer nearby",
      secondaryHref: "/travel",
      secondaryLabel: "Open Travel Mode",
    };
  }

  if (month === 12) {
    return {
      eyebrow: "Dhul Hijjah",
      title: "Prepare for Hajj and the best days of the year",
      description:
        "Follow the rites of Hajj and Umrah step by step with practical guidance, reminders, duas, checklists and travel support.",
      primaryHref: "/hajj",
      primaryLabel: "Open Hajj guide",
      secondaryHref: "/umrah",
      secondaryLabel: "Open Umrah guide",
    };
  }

  return {
    eyebrow: "Pilgrimage & Islamic Guidance",
    title: "Hajj and Umrah guidance, available throughout the year",
    description:
      "Prepare with clear step-by-step guidance, practical checklists, duas and travel support for Hajj and Umrah.",
    primaryHref: "/hajj",
    primaryLabel: "Open Hajj guide",
    secondaryHref: "/umrah",
    secondaryLabel: "Open Umrah guide",
  };
}

export default function HomeHajjHijriBanner() {
  const [hijriDetails, setHijriDetails] = useState<HijriDetails>(
    DEFAULT_HIJRI_DETAILS
  );

  useEffect(() => {
    setHijriDetails(getHijriDetails());
  }, []);

  const content = getBannerContent(hijriDetails);

  return (
    <section
      aria-labelledby="hajj-hijri-heading"
      className="group relative isolate overflow-hidden rounded-[2rem] border border-yellow-500/20 bg-black shadow-[0_28px_80px_rgba(0,0,0,0.36)]"
    >
      <div
        className="absolute inset-0 -z-30 bg-cover bg-center opacity-65 transition duration-700 group-hover:scale-[1.015]"
        style={{
          backgroundImage: "url('/images/kaaba-bg.png')",
        }}
        aria-hidden="true"
      />

      <div
        className="absolute inset-0 -z-20 bg-gradient-to-r from-black via-black/90 to-black/50"
        aria-hidden="true"
      />

      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(234,179,8,0.23),transparent_38%)]"
        aria-hidden="true"
      />

      <div className="grid gap-7 p-5 sm:p-7 md:p-9 lg:grid-cols-[1.18fr_0.82fr] lg:items-center lg:p-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/25 bg-yellow-400/10 px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.2em] text-yellow-300 backdrop-blur-xl">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-yellow-300 shadow-[0_0_12px_rgba(253,224,71,0.8)]"
            />

            {content.eyebrow}
          </div>

          <h2
            id="hajj-hijri-heading"
            className="mt-4 max-w-4xl text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl md:text-5xl"
          >
            {content.title}
          </h2>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/68 sm:text-base md:text-lg">
            {content.description}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={content.primaryHref}
              className="premium-button px-5 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              {content.primaryLabel}
            </Link>

            <Link
              href={content.secondaryHref}
              className="premium-button-outline px-5 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              {content.secondaryLabel}
            </Link>
          </div>
        </div>

        <aside className="rounded-3xl border border-yellow-500/20 bg-black/55 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl sm:p-6">
          <div className="text-xs font-black uppercase tracking-[0.22em] text-yellow-400">
            Today in Hijri
          </div>

          <div
            className="mt-3 text-2xl font-black leading-tight text-white sm:text-3xl"
            aria-live="polite"
          >
            {hijriDetails.formattedDate}
          </div>

          {hijriDetails.monthName ? (
            <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white/60">
              {hijriDetails.monthName}
            </div>
          ) : null}

          <p className="mt-4 text-xs leading-6 text-white/50 sm:text-sm">
            Hijri dates are approximate and may differ according to verified
            local moon sighting and the guidance of your local Islamic
            authority.
          </p>
        </aside>
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-yellow-300/45 to-transparent"
      />
    </section>
  );
}