import "./globals.css";

import type { Metadata, Viewport } from "next";
import { unstable_cache } from "next/cache";
import { Sora } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";

import InstallAppPrompt from "@/components/InstallAppPrompt";
import Nav from "@/components/Nav";
import { supabasePublic } from "@/lib/supabaseServer";

const SITE_NAME = "SalahNearMe";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://www.salahnearme.com";

const CLEAN_SITE_URL = SITE_URL.replace(/\/+$/, "");

const SITE_DESCRIPTION =
  "Find mosques near you, prayer times, iqamah times, halal businesses, Hajj guides, Umrah guides, and Muslim travel essentials with SalahNearMe.";

const NAV_CITIES_LIMIT = 300;
const NAV_CITIES_TIMEOUT_MS = 8_000;
const NAV_CITIES_REVALIDATE_SECONDS = 21_600;

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});

type CityNavRow = {
  slug: string;
  name: string;
};

type CityNavDatabaseRow = {
  slug: string | null;
  name: string | null;
};

export const metadata: Metadata = {
  metadataBase: new URL(CLEAN_SITE_URL),

  title: {
    default:
      "SalahNearMe | Mosques, Prayer Times & Halal Businesses Near You",
    template: `%s | ${SITE_NAME}`,
  },

  description: SITE_DESCRIPTION,

  keywords: [
    "mosques near me",
    "mosque near me",
    "masjid near me",
    "prayer times near me",
    "iqamah times",
    "jamaat times",
    "halal restaurants near me",
    "halal businesses",
    "Muslim travel",
    "Hajj guide",
    "Umrah guide",
    "Islamic directory",
    "SalahNearMe",
  ],

  authors: [
    {
      name: SITE_NAME,
      url: CLEAN_SITE_URL,
    },
  ],

  creator: SITE_NAME,
  publisher: SITE_NAME,
  applicationName: SITE_NAME,
  generator: "Next.js",

  alternates: {
    canonical: "/",
  },

  manifest: "/manifest.json",

  icons: {
    icon: [
      {
        url: "/favicon.ico",
      },
      {
        url: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],

    apple: [
      {
        url: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],

    shortcut: ["/favicon.ico"],
  },

  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },

  formatDetection: {
    telephone: true,
    address: true,
    email: true,
  },

  robots: {
    index: true,
    follow: true,
    nocache: false,

    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },

  openGraph: {
    type: "website",
    locale: "en_GB",
    url: CLEAN_SITE_URL,
    siteName: SITE_NAME,
    title: "SalahNearMe | Find Mosques, Prayer Times & Halal Places",
    description: SITE_DESCRIPTION,

    images: [
      {
        url: "/social-icon.png",
        width: 1200,
        height: 630,
        alt: "SalahNearMe - Find mosques, prayer times and halal places near you",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "SalahNearMe | Mosques, Prayer Times & Halal Businesses",
    description: SITE_DESCRIPTION,
    images: ["/social-icon.png"],
  },

  category: "religion",
};

export const viewport: Viewport = {
  themeColor: "#D4AF37",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

function cleanText(value: string | null | undefined): string | null {
  const cleaned = value?.trim();

  return cleaned ? cleaned : null;
}

function isSafeCitySlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

async function loadNavCities(): Promise<CityNavRow[]> {
  const supabase = supabasePublic();

  const { data, error } = await supabase
    .from("cities")
    .select("slug,name")
    .eq("is_active", true)
    .not("slug", "is", null)
    .not("name", "is", null)
    .order("name", {
      ascending: true,
    })
    .limit(NAV_CITIES_LIMIT)
    .abortSignal(AbortSignal.timeout(NAV_CITIES_TIMEOUT_MS));

  if (error) {
    throw new Error(
      `Unable to load navigation cities: ${error.message}`
    );
  }

  const seenSlugs = new Set<string>();
  const cities: CityNavRow[] = [];

  for (const row of (data ?? []) as CityNavDatabaseRow[]) {
    const slug = cleanText(row.slug);
    const name = cleanText(row.name);

    if (
      !slug ||
      !name ||
      !isSafeCitySlug(slug) ||
      seenSlugs.has(slug)
    ) {
      continue;
    }

    seenSlugs.add(slug);

    cities.push({
      slug,
      name,
    });
  }

  return cities;
}

const getCachedNavCities = unstable_cache(
  loadNavCities,
  ["root-layout-navigation-cities-v1"],
  {
    revalidate: NAV_CITIES_REVALIDATE_SECONDS,
    tags: ["navigation-cities"],
  }
);

let navCitiesPromise: Promise<CityNavRow[]> | null = null;

async function getNavCities(): Promise<CityNavRow[]> {
  if (!navCitiesPromise) {
    navCitiesPromise = getCachedNavCities().catch((error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown navigation cities error";

      console.error("RootLayout cities unavailable:", message);

      return [];
    });
  }

  return navCitiesPromise;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const cities = await getNavCities();

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: CLEAN_SITE_URL,
    logo: `${CLEAN_SITE_URL}/logo-horizontal.png`,
    sameAs: [],
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: CLEAN_SITE_URL,
    description: SITE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: `${CLEAN_SITE_URL}/businesses?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en-GB" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${sora.variable} min-h-screen overflow-x-hidden bg-[#020826] font-sans text-white antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteJsonLd),
          }}
        />

        <div className="fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.12),transparent_32%),linear-gradient(135deg,#020826_0%,#06153A_45%,#01030D_100%)]" />

          <div className="absolute left-0 top-0 h-[360px] w-[360px] opacity-35">
            <div className="absolute left-[-140px] top-[20px] h-[2px] w-[560px] rotate-45 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
            <div className="absolute left-[-105px] top-[55px] h-[2px] w-[560px] rotate-45 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
            <div className="absolute left-[-70px] top-[90px] h-[2px] w-[560px] rotate-45 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
            <div className="absolute left-[-35px] top-[125px] h-[2px] w-[560px] rotate-45 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
            <div className="absolute left-[0px] top-[160px] h-[2px] w-[560px] rotate-45 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
          </div>

          <div className="absolute right-[-160px] top-[-160px] h-[560px] w-[560px] rounded-full border border-yellow-400/10" />
          <div className="absolute right-[-100px] top-[-100px] h-[440px] w-[440px] rounded-full border border-yellow-400/10" />
          <div className="absolute right-[-40px] top-[-40px] h-[320px] w-[320px] rounded-full border border-yellow-400/10" />

          <div className="absolute bottom-0 left-0 h-[280px] w-[280px] bg-[radial-gradient(circle,rgba(212,175,55,0.35)_1px,transparent_1px)] bg-[size:12px_12px] opacity-20" />

          <div className="absolute left-1/2 top-0 h-[460px] w-[460px] -translate-x-1/2 rounded-full bg-yellow-500/10 blur-3xl" />
          <div className="absolute bottom-[-160px] right-[-80px] h-[420px] w-[420px] rounded-full bg-yellow-500/5 blur-3xl" />
        </div>

        <div className="relative flex min-h-screen flex-col">
          <Nav cities={cities} />

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
            {children}
          </main>

          <footer className="border-t border-yellow-500/20 bg-[#020826]/90 backdrop-blur-xl">
            <div className="mx-auto max-w-7xl px-4 py-6">
              <div className="flex flex-col gap-4 text-xs text-white/60 md:flex-row md:items-center md:justify-between">
                <div>
                  © {new Date().getFullYear()} SalahNearMe — Connecting the
                  Ummah locally.
                </div>

                <div className="flex flex-wrap gap-4">
                  <Link
                    href="/privacy"
                    className="transition hover:text-yellow-400"
                  >
                    Privacy
                  </Link>

                  <Link
                    href="/terms"
                    className="transition hover:text-yellow-400"
                  >
                    Terms
                  </Link>

                  <Link
                    href="/disclaimer"
                    className="transition hover:text-yellow-400"
                  >
                    Disclaimer
                  </Link>

                  <Link
                    href="/hajj"
                    className="transition hover:text-yellow-400"
                  >
                    Hajj Guide
                  </Link>

                  <Link
                    href="/umrah"
                    className="transition hover:text-yellow-400"
                  >
                    Umrah Guide
                  </Link>
                </div>
              </div>
            </div>
          </footer>
        </div>

        <InstallAppPrompt />
      </body>
    </html>
  );
}