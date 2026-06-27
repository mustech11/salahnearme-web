import type { Metadata } from "next";
import Link from "next/link";
import HajjImageFrame from "@/components/HajjImageFrame";
import UmrahGuide from "@/components/UmrahGuide";
import UmrahOfflineDownload from "@/components/UmrahOfflineDownload";
import UmrahFloatingBar from "@/components/UmrahFloatingBar";

export const metadata: Metadata = {
  title: "Complete Umrah Guide | SalahNearMe",
  description:
    "A clear Umrah guide according to the Qur’an and Sunnah, covering Ihram, Tawaf, two rak‘ahs, Zamzam, Sa’i, shaving or trimming, duas, checklist, mistakes to avoid, audio guidance, and offline mode.",
  alternates: { canonical: "/umrah" },
};

const umrahSteps = [
  {
    title: "Enter Ihram",
    image: "/images/umrah/umrah-1-ihram-panel.png",
    details:
      "Bathe if possible, wear Ihram clothing for men, avoid scented products after Ihram, make intention for Umrah, and begin the Talbiyah.",
  },
  {
    title: "Enter Masjid al-Haram",
    image: "/images/umrah/umrah-2-haram-panel.png",
    details:
      "Enter the Sacred Mosque calmly with humility. Avoid pushing, arguments, and harming others.",
  },
  {
    title: "Tawaf",
    image: "/images/umrah/umrah-3-tawaf-panel.png",
    details:
      "Perform seven circuits around the Ka‘bah, starting from the Black Stone line and keeping the Ka‘bah on your left.",
  },
  {
    title: "Two Rak‘ahs After Tawaf",
    image: "/images/umrah/umrah-4-two-rakah-panel.png",
    details:
      "Pray two rak‘ahs behind Maqam Ibrahim if possible, or anywhere in the Haram if crowded.",
  },
  {
    title: "Drink Zamzam",
    image: "/images/umrah/umrah-5-zamzam-panel.png",
    details:
      "Drink Zamzam and make du‘a. Drink with gratitude and ask Allah for beneficial good.",
  },
  {
    title: "Sa’i",
    image: "/images/umrah/umrah-6-sai-panel.png",
    details:
      "Walk seven lengths between Safa and Marwah, beginning at Safa and ending at Marwah.",
  },
  {
    title: "Shaving or Trimming",
    image: "/images/umrah/umrah-7-hair-panel.png",
    details:
      "Men shave or trim, with shaving being better. Women cut a small fingertip-length amount from the end of the hair.",
  },
];

const checklist = [
  "Know your Miqat and when you must enter Ihram",
  "Ihram clothing, unscented soap, sandals, and small bag",
  "Hotel location, group contact, and transport details",
  "Phone battery pack and emergency numbers",
  "Learn Talbiyah, Tawaf, Sa’i, and hair-cutting rules",
  "Prepare your heart with repentance and sincerity",
];

const mistakes = [
  "Passing the Miqat without Ihram when intending Umrah",
  "Pushing others to touch the Black Stone",
  "Thinking every circuit has a fixed special du‘a",
  "Filming excessively and losing focus in worship",
  "Forgetting that Sa’i starts at Safa and ends at Marwah",
  "Not cutting/shaving the hair properly at the end",
];

const duas = [
  {
    title: "Talbiyah",
    text: "Labbayk Allahumma labbayk, labbayka la shareeka laka labbayk, innal-hamda wan-ni‘mata laka wal-mulk, la shareeka lak.",
  },
  {
    title: "Between Yemeni Corner and Black Stone",
    text: "Rabbana atina fid-dunya hasanah wa fil-akhirati hasanah wa qina ‘adhaban-nar.",
  },
  {
    title: "General du‘a",
    text: "Ask Allah for forgiveness, acceptance, guidance, Jannah, protection from the Fire, and goodness for your family and the Ummah.",
  },
];

export default function UmrahPage() {
  return (
    <div className="space-y-8 pb-28">
      <HeroSection />

      <section className="grid gap-4 md:grid-cols-3">
        <a
          href="#guided-umrah"
          className="rounded-2xl bg-yellow-500 px-6 py-4 text-center font-semibold text-black hover:bg-yellow-400"
        >
          Start Guided Umrah
        </a>

        <a
          href="#timeline"
          className="rounded-2xl border border-yellow-500/30 bg-black px-6 py-4 text-center font-semibold text-yellow-400 hover:bg-yellow-500/10"
        >
          View Full Timeline
        </a>

        <Link
          href="/hajj"
          className="rounded-2xl border border-white/10 bg-black px-6 py-4 text-center font-semibold text-white/80 hover:border-yellow-500/30 hover:text-yellow-400"
        >
          Hajj Guide
        </Link>
      </section>

      <UmrahGuide steps={umrahSteps} />

      <UmrahFloatingBar steps={umrahSteps} />

      <UmrahOfflineDownload />

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Qur’an
        </div>

        <h2 className="mt-3 text-3xl font-bold text-white">
          Umrah in the Qur’an
        </h2>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
          <div className="text-sm font-semibold text-yellow-400">
            Qur’an 2:196
          </div>

          <p className="mt-3 text-white/75">
            Allah commands the believers to complete Hajj and Umrah for His
            sake. Umrah is worship that should be performed with sincerity,
            correct intention, and obedience.
          </p>
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
          Step-by-step Umrah method
        </h2>

        <div className="mt-6 grid gap-5">
          {umrahSteps.map((step, index) => (
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
                    Umrah Step
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
        <InfoCard title="Umrah checklist" items={checklist} />
        <InfoCard title="Mistakes to avoid" items={mistakes} />
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
    <section className="relative min-h-[500px] overflow-hidden rounded-3xl border border-yellow-500/20 bg-black">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-80"
        style={{ backgroundImage: "url('/images/kaaba-bg.png')" }}
      />

      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/35" />

      <div className="relative z-10 flex min-h-[500px] items-center p-8 md:p-12">
        <div className="max-w-5xl">
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Umrah Guide
          </div>

          <h1 className="mt-4 max-w-4xl text-3xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
            Complete Umrah Guide According to the Sunnah
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/80 md:text-xl">
            A practical step-by-step Umrah guide with visual instructions,
            duas, checklist, mistakes to avoid, audio guidance, and offline
            mode.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#guided-umrah"
              className="rounded-2xl bg-yellow-500 px-6 py-4 font-semibold text-black hover:bg-yellow-400"
            >
              Start Guided Umrah
            </a>

            <Link
              href="/hajj"
              className="rounded-2xl border border-yellow-500/30 bg-black/70 px-6 py-4 font-semibold text-yellow-400 hover:bg-yellow-500/10"
            >
              View Hajj guide
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

