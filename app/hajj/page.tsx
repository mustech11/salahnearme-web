import type { Metadata } from "next";
import Link from "next/link";
import HajjExperiencePanel from "@/components/HajjExperiencePanel";
import HajjGuide from "@/components/HajjGuide";
import HajjOfflineDownload from "@/components/HajjOfflineDownload";
import HajjImageFrame from "@/components/HajjImageFrame";
import HajjFloatingBar from "@/components/HajjFloatingBar";

export const metadata: Metadata = {
  title: "Complete Hajj Guide | SalahNearMe",
  description:
    "A clear Hajj guide covering the rituals of Hajj according to the Qur’an and Sunnah, with guided visual steps, duas, checklist, mistakes to avoid, and offline mode.",
  alternates: { canonical: "/hajj" },
};

const hajjTimeline = [
  {
    day: "Before 8 Dhul Hijjah",
    title: "Entering Ihram",
    image: "/images/hajj/hajj-1-ihram-panel.png",
    details:
      "Make intention for Hajj and enter the state of Ihram. Men wear two white unstitched cloths, while women wear modest clothing.",
  },
  {
    day: "At the Miqat",
    title: "At the Miqat",
    image: "/images/hajj/hajj-2-miqat-panel.png",
    details:
      "Arrive at your Miqat, enter Ihram if not already, offer two rak‘ah if possible, and begin Talbiyah.",
  },
  {
    day: "Journey to Makkah",
    title: "Talbiyah",
    image: "/images/hajj/hajj-3-talbiyah-panel.png",
    details:
      "Recite Talbiyah frequently with sincerity: Labbayk Allahumma labbayk.",
  },
  {
    day: "Arriving in Makkah",
    title: "Entering Masjid al-Haram",
    image: "/images/hajj/hajj-4-masjid-haram-panel.png",
    details:
      "Enter the Sacred Mosque with humility, make du‘a, and begin worship with focus and calmness.",
  },
  {
    day: "Arrival Tawaf",
    title: "Tawaf",
    image: "/images/hajj/hajj-5-tawaf-panel.png",
    details:
      "Perform seven circuits around the Ka‘bah, starting from the Black Stone and keeping the Ka‘bah on your left.",
  },
  {
    day: "After Tawaf",
    title: "Sa’i",
    image: "/images/hajj/hajj-6-sai-panel.png",
    details:
      "Walk seven lengths between Safa and Marwah, beginning at Safa and ending at Marwah.",
  },
  {
    day: "8 Dhul Hijjah",
    title: "Mina",
    image: "/images/hajj/hajj-7-mina-panel.png",
    details:
      "Travel to Mina and spend the day and night there, praying Dhuhr, Asr, Maghrib, Isha, and Fajr.",
  },
  {
    day: "9 Dhul Hijjah",
    title: "Arafah",
    image: "/images/hajj/hajj-8-arafah-panel.png",
    details:
      "Stand at Arafah from Dhuhr until sunset. This is the most important pillar of Hajj.",
  },
  {
    day: "Night of 10 Dhul Hijjah",
    title: "Muzdalifah",
    image: "/images/hajj/hajj-9-muzdalifah-panel.png",
    details:
      "After sunset, travel to Muzdalifah, pray Maghrib and Isha, rest, and collect pebbles.",
  },
  {
    day: "10 Dhul Hijjah",
    title: "Jamarat",
    image: "/images/hajj/hajj-10-jamarat-panel.png",
    details:
      "Stone the Jamarat by throwing small pebbles while saying Allahu Akbar with each throw.",
  },
  {
    day: "10 Dhul Hijjah",
    title: "Sacrifice",
    image: "/images/hajj/hajj-11-sacrifice-panel.png",
    details:
      "Offer a sacrifice if required, commemorating the obedience of Prophet Ibrahim عليه السلام.",
  },
  {
    day: "10 Dhul Hijjah",
    title: "Shaving or Trimming",
    image: "/images/hajj/hajj-12-hair-panel.png",
    details:
      "Men shave or trim their hair. Women cut a small portion from the ends of their hair.",
  },
  {
    day: "Before leaving Makkah",
    title: "Farewell Tawaf",
    image: "/images/hajj/hajj-13-farewell-panel.png",
    details:
      "Perform Tawaf al-Wada‘ before leaving Makkah as your final act of Hajj, except for menstruating women.",
  },
];

const hajjChecklist = [
  "Valid passport, visa, permits, hotel and transport details",
  "Ihram clothing, comfortable sandals, small bag, phone charger",
  "Medication, unscented hygiene items, water bottle",
  "Learn the Talbiyah, Tawaf, Sa’i, Arafah, Muzdalifah, and Jamarat steps",
  "Save emergency contacts and group leader details",
  "Keep patience, avoid arguments, and protect your tongue",
];

const hajjMistakes = [
  "Thinking Hajj is only physical movement without repentance and sincerity",
  "Arguing, pushing, or harming others in crowded areas",
  "Missing Arafah — standing at Arafah is the core pillar of Hajj",
  "Doing rituals only by imitation without learning the correct order",
  "Treating photos and filming as more important than worship",
  "Forgetting Tawaf al-Ifadah or Tawaf al-Wada‘",
];

const duas = [
  {
    title: "Talbiyah",
    text: "Labbayk Allahumma labbayk, labbayka la shareeka laka labbayk, innal-hamda wan-ni‘mata laka wal-mulk, la shareeka lak.",
  },
  {
    title: "Between the Yemeni Corner and Black Stone",
    text: "Rabbana atina fid-dunya hasanah wa fil-akhirati hasanah wa qina ‘adhaban-nar.",
  },
  {
    title: "Arafah",
    text: "La ilaha illa Allah wahdahu la shareeka lah, lahul-mulku wa lahul-hamd, wa huwa ‘ala kulli shay’in qadeer.",
  },
];

export default function HajjPage() {
  return (
    <div className="space-y-8">
      <HeroSection />

      <section className="grid gap-4 md:grid-cols-3">
        <a
          href="#guided-mode"
          className="rounded-2xl bg-yellow-500 px-6 py-4 text-center font-semibold text-black hover:bg-yellow-400"
        >
          Start Guided Hajj
        </a>

        <a
          href="#timeline"
          className="rounded-2xl border border-yellow-500/30 bg-black px-6 py-4 text-center font-semibold text-yellow-400 hover:bg-yellow-500/10"
        >
          View Full Timeline
        </a>

        <Link
          href="/umrah"
          className="rounded-2xl border border-white/10 bg-black px-6 py-4 text-center font-semibold text-white/80 hover:border-yellow-500/30 hover:text-yellow-400"
        >
          Umrah Guide
        </Link>
      </section>

      <HajjGuide steps={hajjTimeline} />

      <HajjOfflineDownload />

      <HajjExperiencePanel />

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Qur’an
        </div>

        <h2 className="mt-3 text-3xl font-bold text-white">
          Hajj in the Qur’an
        </h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[
            {
              ref: "Qur’an 2:196",
              text: "Complete Hajj and Umrah for Allah.",
            },
            {
              ref: "Qur’an 3:97",
              text: "Hajj to the House is a duty owed to Allah by those who are able to make the journey.",
            },
            {
              ref: "Qur’an 22:27",
              text: "Allah commanded Ibrahim عليه السلام to proclaim Hajj to mankind.",
            },
            {
              ref: "Qur’an 2:197",
              text: "Hajj is in known months; there should be no obscenity, sin, or argument during Hajj.",
            },
          ].map((ayah) => (
            <div
              key={ayah.ref}
              className="rounded-2xl border border-white/10 bg-black/30 p-5"
            >
              <div className="text-sm font-semibold text-yellow-400">
                {ayah.ref}
              </div>
              <p className="mt-3 text-white/75">{ayah.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="timeline"
        className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8"
      >
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Full Visual Timeline
        </div>

        <h2 className="mt-3 text-3xl font-bold text-white">
          Step-by-step Hajj method
        </h2>

        <div className="mt-6 grid gap-5">
          {hajjTimeline.map((step, index) => (
            <div
              key={step.title}
              className="grid gap-5 rounded-3xl border border-white/10 bg-black/30 p-5 transition hover:scale-[1.01] hover:border-yellow-400/40 lg:grid-cols-[0.9fr_1.1fr]"
            >
              <HajjImageFrame src={step.image} alt={step.title} />

              <div className="flex flex-col justify-center">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-yellow-500 px-3 py-1 text-sm font-bold text-black">
                    {index + 1}
                  </span>

                  <span className="text-sm font-semibold text-yellow-400">
                    {step.day}
                  </span>
                </div>

                <h3 className="mt-3 text-2xl font-bold text-white">
                  {step.title}
                </h3>

                <p className="mt-3 text-white/70">{step.details}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <InfoCard title="Hajj checklist" items={hajjChecklist} />
        <InfoCard title="Mistakes to avoid" items={hajjMistakes} />
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Du‘a
        </div>

        <h2 className="mt-3 text-3xl font-bold text-white">
          Important du‘as and dhikr
        </h2>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {duas.map((dua) => (
            <div
              key={dua.title}
              className="rounded-2xl border border-white/10 bg-black/30 p-5"
            >
              <div className="text-lg font-bold text-yellow-400">
                {dua.title}
              </div>
              <p className="mt-3 text-white/75">{dua.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-[520px] overflow-hidden rounded-3xl border border-yellow-500/20 bg-black">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-80"
        style={{
          backgroundImage: "url('/images/kaaba-bg.png')",
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/35" />

      <div className="relative z-10 flex min-h-[520px] items-center p-8 md:p-12">
        <div className="max-w-5xl">
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Hajj Guide
          </div>

          <h1 className="mt-4 max-w-4xl text-3xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
            Complete Hajj Guide According to the Qur’an and Sunnah
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/80 md:text-xl">
            A practical step-by-step guide to Hajj with Qur’anic reminders,
            Sunnah-based order, visual timeline, checklist, duas, travel
            preparation, audio guidance, and offline mode.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#guided-mode"
              className="rounded-2xl bg-yellow-500 px-6 py-4 font-semibold text-black hover:bg-yellow-400"
            >
              Start Guided Hajj
            </a>
            <HajjFloatingBar steps={hajjTimeline} />

            <a
              href="#timeline"
              className="rounded-2xl border border-yellow-500/30 bg-black/70 px-6 py-4 font-semibold text-yellow-400 hover:bg-yellow-500/10"
            >
              View Timeline
            </a>

            <Link
              href="/umrah"
              className="rounded-2xl border border-white/10 bg-black/70 px-6 py-4 font-semibold text-white/80 hover:border-yellow-500/30 hover:text-yellow-400"
            >
              View Umrah guide
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
      <h2 className="text-3xl font-bold text-yellow-400">{title}</h2>

      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/75"
          >
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

