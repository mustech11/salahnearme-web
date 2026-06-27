import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import InstallAppPrompt from "@/components/InstallAppPrompt";
import { supabasePublic } from "@/lib/supabaseServer";
import { Sora } from "next/font/google";

const siteName = "SalahNearMe";
const siteDescription =
  "Find mosques, halal businesses, prayer times, Hajj guides, Umrah guides, and Muslim travel essentials.";

  const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sora",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.salahnearme.com"),

  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },

  description: siteDescription,

  keywords: [
    "mosques near me",
    "halal businesses",
    "prayer times",
    "iqamah times",
    "Islamic travel",
    "Hajj guide",
    "Umrah guide",
    "Islamic directory",
  ],

  manifest: "/manifest.json",

  applicationName: siteName,

  appleWebApp: {
    capable: true,
    title: siteName,
    statusBarStyle: "black-translucent",
  },

  icons: {
    icon: [
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
      },
    ],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },

  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://www.salahnearme.com",
    siteName,

    title: siteName,

    description: siteDescription,

    images: [
      {
        url: "/social-icon.png",
        width: 1200,
        height: 630,
        alt: "SalahNearMe",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
    images: ["/social-icon.png"],
  },

  category: "religion",
};

export const viewport: Viewport = {
  themeColor: "#D4AF37",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = supabasePublic();

  const { data: cities, error } = await supabase
    .from("cities")
    .select("slug,name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to load cities:", error.message);
  }

  return (
    <html lang="en" suppressHydrationWarning>
  <body
  suppressHydrationWarning
  className={`${sora.variable} min-h-screen overflow-x-hidden bg-[#020826] text-white antialiased`}>
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
          <Nav cities={cities ?? []} />

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
                  <Link href="/privacy" className="hover:text-yellow-400">
                    Privacy
                  </Link>

                  <Link href="/terms" className="hover:text-yellow-400">
                    Terms
                  </Link>

                  <Link href="/disclaimer" className="hover:text-yellow-400">
                    Disclaimer
                  </Link>

                  <Link href="/hajj" className="hover:text-yellow-400">
                    Hajj Guide
                  </Link>

                  <Link href="/umrah" className="hover:text-yellow-400">
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

