import Link from "next/link";

export const metadata = {
  title: "Guided Hajj Step by Step | SalahNearMe",
  description:
    "A visual step-by-step Hajj guide with Qur’an reminders, Sunnah-based order, duas, and practical checklist.",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    step?: string;
  }>;
};

type HajjStep = {
  number: number;
  slug: string;
  title: string;
  timing: string;
  location: string;
  short: string;
  description: string;
  checklist: string[];
  duaTitle: string;
  dua: string;
  visualType:
    | "ihram"
    | "mina"
    | "arafah"
    | "muzdalifah"
    | "jamarat"
    | "tawaf"
    | "sai"
    | "farewell";
};

const hajjSteps: HajjStep[] = [
  {
    number: 1,
    slug: "ihram",
    title: "Entering Ihram",
    timing: "Before 8 Dhul Hijjah",
    location: "Miqat / before entering Makkah",
    short: "Make intention, enter Ihram, and begin Talbiyah.",
    description:
      "The pilgrim enters the sacred state of Ihram at the Miqat, makes the intention for Hajj, avoids Ihram restrictions, and frequently recites the Talbiyah.",
    checklist: [
      "Perform ghusl if possible.",
      "Wear Ihram garments for men; modest normal clothing for women.",
      "Make intention for Hajj.",
      "Begin reciting the Talbiyah.",
    ],
    duaTitle: "Talbiyah",
    dua:
      "Labbayka Allahumma labbayk, labbayka la sharika laka labbayk, innal-hamda wan-ni‘mata laka wal-mulk, la sharika lak.",
    visualType: "ihram",
  },
  {
    number: 2,
    slug: "mina",
    title: "Travel to Mina",
    timing: "8 Dhul Hijjah",
    location: "Mina",
    short: "Spend the day and night in Mina in worship and preparation.",
    description:
      "On the 8th of Dhul Hijjah, pilgrims proceed to Mina and pray Dhuhr, Asr, Maghrib, Isha, and Fajr there, shortening the four-rak‘ah prayers but not combining them in the normal Hajj arrangement.",
    checklist: [
      "Go to Mina calmly.",
      "Pray the prescribed prayers.",
      "Keep reciting Talbiyah.",
      "Prepare spiritually for Arafah.",
    ],
    duaTitle: "Reminder",
    dua:
      "Use this day to increase dhikr, Qur’an, repentance, and preparation for the Day of Arafah.",
    visualType: "mina",
  },
  {
    number: 3,
    slug: "arafah",
    title: "Stand at Arafah",
    timing: "9 Dhul Hijjah",
    location: "Arafah",
    short: "The greatest pillar of Hajj: standing at Arafah.",
    description:
      "Standing at Arafah is the central pillar of Hajj. Pilgrims spend the day in dua, repentance, humility, and remembrance of Allah until sunset.",
    checklist: [
      "Arrive at Arafah before sunset.",
      "Make long and sincere dua.",
      "Repent sincerely.",
      "Do not leave Arafah before sunset.",
    ],
    duaTitle: "Best dua on Arafah",
    dua:
      "La ilaha illa Allah wahdahu la sharika lah, lahul-mulku wa lahul-hamd, wa huwa ‘ala kulli shay’in qadir.",
    visualType: "arafah",
  },
  {
    number: 4,
    slug: "muzdalifah",
    title: "Stay at Muzdalifah",
    timing: "Night of 10 Dhul Hijjah",
    location: "Muzdalifah",
    short: "Pray, rest, and collect pebbles.",
    description:
      "After sunset on the Day of Arafah, pilgrims travel to Muzdalifah, pray Maghrib and Isha combined, rest, remember Allah, and prepare for the next day.",
    checklist: [
      "Leave Arafah after sunset.",
      "Pray Maghrib and Isha at Muzdalifah.",
      "Rest for the night.",
      "Collect small pebbles for Jamarat.",
    ],
    duaTitle: "Reminder",
    dua:
      "Remember Allah at Al-Mash‘ar Al-Haram and continue making dua with humility.",
    visualType: "muzdalifah",
  },
  {
    number: 5,
    slug: "jamarat",
    title: "Stone Jamarat",
    timing: "10 Dhul Hijjah",
    location: "Mina / Jamarat",
    short: "Stone the large Jamarah and continue Eid day rites.",
    description:
      "On the 10th of Dhul Hijjah, pilgrims stone the large Jamarah, then continue the remaining rites such as sacrifice, shaving or trimming, and moving towards Tawaf al-Ifadah.",
    checklist: [
      "Stone Jamarat al-‘Aqabah with seven pebbles.",
      "Say Allahu Akbar with each pebble.",
      "Avoid pushing or harming others.",
      "Continue the Eid day rites in order where possible.",
    ],
    duaTitle: "Reminder",
    dua:
      "The stoning is an act of obedience to Allah, not a physical fight with Shaytan.",
    visualType: "jamarat",
  },
  {
    number: 6,
    slug: "tawaf",
    title: "Tawaf al-Ifadah",
    timing: "10 Dhul Hijjah onwards",
    location: "Masjid al-Haram",
    short: "Perform the main Tawaf of Hajj around the Ka‘bah.",
    description:
      "Tawaf al-Ifadah is an essential rite of Hajj. Pilgrims perform seven circuits around the Ka‘bah in worship, humility, and remembrance of Allah.",
    checklist: [
      "Perform seven circuits around the Ka‘bah.",
      "Begin from the Black Stone line.",
      "Make dua and dhikr throughout.",
      "Pray two rak‘ahs after Tawaf if possible.",
    ],
    duaTitle: "Between the Yemeni Corner and Black Stone",
    dua:
      "Rabbana atina fid-dunya hasanah wa fil-akhirati hasanah wa qina ‘adhaban-nar.",
    visualType: "tawaf",
  },
  {
    number: 7,
    slug: "sai",
    title: "Sa‘i between Safa and Marwah",
    timing: "After Tawaf al-Ifadah",
    location: "Safa and Marwah",
    short: "Walk seven times between Safa and Marwah.",
    description:
      "Sa‘i remembers the striving of Hajar, peace be upon her. Pilgrims walk between Safa and Marwah seven times, beginning at Safa and ending at Marwah.",
    checklist: [
      "Begin at Safa.",
      "Walk seven laps between Safa and Marwah.",
      "Make dua during Sa‘i.",
      "End at Marwah.",
    ],
    duaTitle: "Reminder",
    dua:
      "Indeed, Safa and Marwah are among the symbols of Allah.",
    visualType: "sai",
  },
  {
    number: 8,
    slug: "farewell",
    title: "Farewell Tawaf",
    timing: "Before leaving Makkah",
    location: "Masjid al-Haram",
    short: "End your Hajj journey with Tawaf al-Wada‘.",
    description:
      "Before leaving Makkah, pilgrims perform the Farewell Tawaf as their final act at the House, unless excused according to Islamic rulings.",
    checklist: [
      "Perform Tawaf before leaving Makkah.",
      "Make sincere dua.",
      "Leave with gratitude and humility.",
      "Ask Allah to accept your Hajj.",
    ],
    duaTitle: "Acceptance dua",
    dua:
      "Allahumma taqabbal minna. O Allah, accept from us and return us forgiven.",
    visualType: "farewell",
  },
];

function getStepNumber(value?: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return 1;
  }

  return Math.min(Math.max(parsed, 1), hajjSteps.length);
}

function getStepHref(step: number) {
  return `/hajj/guide?step=${step}`;
}

function StepVisual({ type }: { type: HajjStep["visualType"] }) {
  const titleMap: Record<HajjStep["visualType"], string> = {
    ihram: "Ihram preparation",
    mina: "Tents of Mina",
    arafah: "Standing at Arafah",
    muzdalifah: "Night at Muzdalifah",
    jamarat: "Jamarat",
    tawaf: "Tawaf around the Ka‘bah",
    sai: "Safa and Marwah",
    farewell: "Farewell Tawaf",
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-yellow-500/20 bg-gradient-to-br from-black via-slate-950 to-yellow-950/30 p-6 shadow-2xl">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute left-8 top-8 h-32 w-32 rounded-full bg-yellow-500/20 blur-3xl" />
        <div className="absolute bottom-8 right-8 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative">
        <div className="mb-4 text-xs uppercase tracking-[0.3em] text-yellow-400">
          Visual guide
        </div>

        <svg
          viewBox="0 0 800 420"
          role="img"
          aria-label={titleMap[type]}
          className="h-auto w-full rounded-2xl border border-white/10 bg-black/40"
        >
          <defs>
            <linearGradient id={`sky-${type}`} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#020617" />
              <stop offset="55%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#3b2500" />
            </linearGradient>

            <radialGradient id={`glow-${type}`} cx="50%" cy="42%" r="50%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width="800" height="420" fill={`url(#sky-${type})`} />
          <rect width="800" height="420" fill={`url(#glow-${type})`} />

          {type === "ihram" && <IhramSvg />}
          {type === "mina" && <MinaSvg />}
          {type === "arafah" && <ArafahSvg />}
          {type === "muzdalifah" && <MuzdalifahSvg />}
          {type === "jamarat" && <JamaratSvg />}
          {type === "tawaf" && <TawafSvg />}
          {type === "sai" && <SaiSvg />}
          {type === "farewell" && <FarewellSvg />}
        </svg>

        <div className="mt-4 rounded-2xl border border-yellow-500/20 bg-black/50 p-4">
          <div className="text-lg font-black text-white">{titleMap[type]}</div>
          <div className="mt-1 text-sm text-white/60">
            Illustration added directly into the guide so the step area is never
            visually empty.
          </div>
        </div>
      </div>
    </div>
  );
}

function IhramSvg() {
  return (
    <>
      <circle cx="650" cy="90" r="45" fill="#fbbf24" opacity="0.7" />
      <rect x="0" y="330" width="800" height="90" fill="#1f2937" opacity="0.65" />
      <path d="M210 320 L260 170 L310 320 Z" fill="#f8fafc" />
      <path d="M335 320 L385 170 L435 320 Z" fill="#f8fafc" opacity="0.9" />
      <circle cx="260" cy="150" r="28" fill="#facc15" />
      <circle cx="385" cy="150" r="28" fill="#facc15" />
      <rect x="185" y="335" width="280" height="20" rx="10" fill="#fbbf24" opacity="0.7" />
      <text x="70" y="80" fill="#facc15" fontSize="28" fontWeight="700">
        INTENTION • TALBIYAH • IHRAM
      </text>
    </>
  );
}

function MinaSvg() {
  return (
    <>
      <rect x="0" y="310" width="800" height="110" fill="#78350f" opacity="0.45" />
      {[110, 250, 390, 530].map((x) => (
        <g key={x}>
          <path d={`M${x} 300 L${x + 70} 200 L${x + 140} 300 Z`} fill="#f8fafc" />
          <rect x={x + 20} y="300" width="100" height="40" fill="#e5e7eb" />
          <path d={`M${x + 70} 200 L${x + 70} 340`} stroke="#94a3b8" strokeWidth="3" />
        </g>
      ))}
      <text x="70" y="80" fill="#facc15" fontSize="28" fontWeight="700">
        MINA • WORSHIP • PREPARATION
      </text>
    </>
  );
}

function ArafahSvg() {
  return (
    <>
      <circle cx="670" cy="95" r="55" fill="#fbbf24" opacity="0.75" />
      <path d="M0 325 C180 260 330 360 520 285 C640 235 720 270 800 240 L800 420 L0 420 Z" fill="#14532d" opacity="0.65" />
      <path d="M100 325 C230 235 360 235 505 325 Z" fill="#475569" />
      <path d="M160 325 C255 260 350 260 445 325 Z" fill="#64748b" />
      {[210, 250, 290, 330, 370].map((x) => (
        <g key={x}>
          <circle cx={x} cy="270" r="12" fill="#facc15" />
          <rect x={x - 8} y="284" width="16" height="45" rx="8" fill="#f8fafc" />
        </g>
      ))}
      <text x="70" y="80" fill="#facc15" fontSize="28" fontWeight="700">
        ARAFAH • DUA • REPENTANCE
      </text>
    </>
  );
}

function MuzdalifahSvg() {
  return (
    <>
      <circle cx="650" cy="85" r="42" fill="#e5e7eb" opacity="0.85" />
      <path d="M0 310 C180 280 360 335 520 300 C650 270 720 285 800 260 L800 420 L0 420 Z" fill="#44403c" />
      {[200, 250, 300, 350, 400, 450].map((x, index) => (
        <circle key={x} cx={x} cy={340 + (index % 2) * 20} r="8" fill="#fbbf24" opacity="0.7" />
      ))}
      <path d="M120 350 L220 280 L320 350 Z" fill="#1e293b" stroke="#facc15" strokeWidth="2" />
      <text x="70" y="80" fill="#facc15" fontSize="28" fontWeight="700">
        MUZDALIFAH • REST • PEBBLES
      </text>
    </>
  );
}

function JamaratSvg() {
  return (
    <>
      <rect x="0" y="325" width="800" height="95" fill="#334155" opacity="0.75" />
      <rect x="360" y="135" width="80" height="190" rx="20" fill="#94a3b8" />
      <rect x="330" y="310" width="140" height="30" rx="15" fill="#64748b" />
      {[180, 230, 280, 520, 570, 620].map((x, i) => (
        <circle key={x} cx={x} cy={260 + (i % 2) * 20} r="9" fill="#facc15" />
      ))}
      <path d="M245 270 C300 230 325 220 365 205" stroke="#facc15" strokeWidth="5" fill="none" strokeDasharray="12 12" />
      <text x="70" y="80" fill="#facc15" fontSize="28" fontWeight="700">
        JAMARAT • SEVEN PEBBLES • TAKBIR
      </text>
    </>
  );
}

function TawafSvg() {
  return (
    <>
      <rect x="345" y="150" width="110" height="110" fill="#020617" stroke="#facc15" strokeWidth="5" />
      <rect x="365" y="170" width="70" height="70" fill="#111827" stroke="#facc15" strokeWidth="2" />
      <ellipse cx="400" cy="205" rx="210" ry="115" fill="none" stroke="#facc15" strokeWidth="5" strokeDasharray="14 14" />
      <ellipse cx="400" cy="205" rx="270" ry="150" fill="none" stroke="#fef3c7" strokeWidth="2" opacity="0.5" />
      {[165, 225, 285, 515, 575, 635].map((x, i) => (
        <circle key={x} cx={x} cy={205 + (i % 2) * 50} r="12" fill="#f8fafc" />
      ))}
      <text x="70" y="80" fill="#facc15" fontSize="28" fontWeight="700">
        TAWAF • SEVEN CIRCUITS • DUA
      </text>
    </>
  );
}

function SaiSvg() {
  return (
    <>
      <rect x="120" y="190" width="560" height="80" rx="40" fill="#0f172a" stroke="#facc15" strokeWidth="4" />
      <circle cx="170" cy="230" r="45" fill="#14532d" stroke="#22c55e" strokeWidth="4" />
      <circle cx="630" cy="230" r="45" fill="#14532d" stroke="#22c55e" strokeWidth="4" />
      <path d="M230 230 C330 180 470 280 570 230" stroke="#facc15" strokeWidth="6" fill="none" strokeDasharray="12 12" />
      <text x="135" y="238" fill="#fff" fontSize="22" fontWeight="700">
        SAFA
      </text>
      <text x="586" y="238" fill="#fff" fontSize="22" fontWeight="700">
        MARWAH
      </text>
      <text x="70" y="80" fill="#facc15" fontSize="28" fontWeight="700">
        SA‘I • SEVEN LAPS • STRIVING
      </text>
    </>
  );
}

function FarewellSvg() {
  return (
    <>
      <rect x="355" y="155" width="90" height="90" fill="#020617" stroke="#facc15" strokeWidth="5" />
      <path d="M170 335 C290 255 505 255 630 335" fill="none" stroke="#facc15" strokeWidth="6" />
      <path d="M610 320 L650 335 L610 350" fill="none" stroke="#facc15" strokeWidth="6" />
      <circle cx="240" cy="310" r="12" fill="#f8fafc" />
      <circle cx="300" cy="285" r="12" fill="#f8fafc" />
      <circle cx="500" cy="285" r="12" fill="#f8fafc" />
      <circle cx="560" cy="310" r="12" fill="#f8fafc" />
      <text x="70" y="80" fill="#facc15" fontSize="28" fontWeight="700">
        FAREWELL TAWAF • GRATITUDE • ACCEPTANCE
      </text>
    </>
  );
}

function StepNav({ activeStep }: { activeStep: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      {hajjSteps.map((step) => {
        const active = step.number === activeStep;

        return (
          <Link
            key={step.number}
            href={getStepHref(step.number)}
            className={`rounded-2xl border p-4 transition ${
              active
                ? "border-yellow-400 bg-yellow-500 text-black"
                : "border-yellow-500/20 bg-black/30 text-white hover:border-yellow-400/60"
            }`}
          >
            <div className="text-xs font-black uppercase tracking-[0.2em]">
              Step {step.number}
            </div>
            <div className="mt-2 font-black">{step.title}</div>
            <div className={`mt-1 text-xs ${active ? "text-black/70" : "text-white/50"}`}>
              {step.timing}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default async function HajjGuidePage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeStepNumber = getStepNumber(resolvedSearchParams.step);
  const activeStep = hajjSteps[activeStepNumber - 1];

  const previousStep =
    activeStepNumber > 1 ? activeStepNumber - 1 : hajjSteps.length;

  const nextStep =
    activeStepNumber < hajjSteps.length ? activeStepNumber + 1 : 1;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="space-y-8">
        <section className="overflow-hidden rounded-3xl border border-yellow-500/20 bg-black">
          <div className="relative min-h-[420px] bg-[url('/images/kabah-gold.jpg')] bg-cover bg-center">
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/30" />

            <div className="relative max-w-4xl p-8 md:p-12">
              <div className="text-sm uppercase tracking-[0.35em] text-yellow-400">
                Hajj Guide
              </div>

              <h1 className="mt-6 text-5xl font-black leading-tight text-white md:text-6xl">
                Guided Hajj — Step by Step
              </h1>

              <p className="mt-5 max-w-3xl text-lg leading-8 text-white/75">
                A visual Hajj guide with step-by-step actions, reminders, duas,
                and practical guidance for each stage of the journey.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={getStepHref(activeStepNumber)}
                  className="rounded-xl bg-yellow-500 px-6 py-4 text-sm font-black text-black hover:bg-yellow-400"
                >
                  Start guided Hajj
                </Link>

                <Link
                  href="/umrah"
                  className="rounded-xl border border-yellow-500/30 bg-black/40 px-6 py-4 text-sm font-black text-yellow-400 hover:bg-yellow-500/10"
                >
                  View Umrah guide
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-sm uppercase tracking-[0.3em] text-yellow-400">
                Hajj Steps
              </div>

              <h2 className="mt-3 text-3xl font-black text-white">
                Choose a step
              </h2>
            </div>

            <div className="text-sm text-white/50">
              {activeStepNumber} of {hajjSteps.length}
            </div>
          </div>

          <StepNav activeStep={activeStepNumber} />
        </section>

        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
            <div className="text-sm uppercase tracking-[0.3em] text-yellow-400">
              Current Hajj Step
            </div>

            <h2 className="mt-3 text-4xl font-black text-white">
              {activeStep.number}. {activeStep.title}
            </h2>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-400">
                {activeStep.timing}
              </span>

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/70">
                {activeStep.location}
              </span>
            </div>

            <p className="mt-6 text-lg leading-8 text-white/75">
              {activeStep.description}
            </p>

            <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
                Checklist
              </div>

              <ul className="mt-4 space-y-3">
                {activeStep.checklist.map((item) => (
                  <li key={item} className="flex gap-3 text-white/75">
                    <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-500 text-xs font-black text-black">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 rounded-2xl border border-green-500/20 bg-green-500/10 p-5">
              <div className="text-sm uppercase tracking-[0.25em] text-green-300">
                {activeStep.duaTitle}
              </div>

              <p className="mt-3 text-lg leading-8 text-white">
                {activeStep.dua}
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={getStepHref(previousStep)}
                className="rounded-xl border border-white/10 bg-black px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
              >
                ◀ Previous
              </Link>

              <Link
                href={getStepHref(nextStep)}
                className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-black hover:bg-yellow-400"
              >
                Next ▶
              </Link>
            </div>
          </div>

          <StepVisual type={activeStep.visualType} />
        </section>
      </div>
    </main>
  );
}