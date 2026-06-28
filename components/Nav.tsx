"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import Logo from "@/components/Logo";

type City = {
  slug: string | null;
  name: string | null;
};

type Props = {
  cities?: City[] | null;
};

const RESERVED_SEGMENTS = new Set([
  "mosque",
  "mosques",
  "business",
  "businesses",
  "sponsor",
  "claim",
  "how-it-works",
  "admin",
  "api",
  "payment",
  "advertise",
  "add-business",
  "dashboard",
  "business-dashboard",
  "login",
  "signup",
  "auth",
  "travel",
  "near-me",
  "hajj",
  "umrah",
  "privacy",
  "terms",
  "disclaimer",
  "robots.txt",
  "sitemap.xml",
]);

function cleanText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function formatCity(city: string | null | undefined) {
  const value = cleanText(city);

  if (!value) {
    return "Cities";
  }

  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isCitySegment(segment: string | null | undefined) {
  const value = cleanText(segment).toLowerCase();

  if (!value) {
    return false;
  }

  return !RESERVED_SEGMENTS.has(value);
}

function navClass(active: boolean) {
  return [
    "whitespace-nowrap text-sm font-medium transition",
    active ? "text-yellow-400" : "text-white/70 hover:text-yellow-400",
  ].join(" ");
}

function buttonNavClass(active: boolean) {
  return [
    "rounded-xl border px-3 py-2 text-sm font-semibold transition",
    active
      ? "border-yellow-400/70 bg-yellow-400/10 text-yellow-300"
      : "border-yellow-500/25 bg-black/40 text-white/75 hover:border-yellow-400/60 hover:text-yellow-300",
  ].join(" ");
}

function getSafeCities(cities?: City[] | null) {
  const seen = new Set<string>();

  return (cities ?? [])
    .map((city) => {
      const slug = cleanText(city.slug).toLowerCase();
      const name = cleanText(city.name) || formatCity(slug);

      return {
        slug,
        name,
      };
    })
    .filter((city) => {
      if (!city.slug || !city.name || seen.has(city.slug)) {
        return false;
      }

      seen.add(city.slug);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default function Nav({ cities = [] }: Props) {
  const pathname = usePathname() || "/";
  const router = useRouter();

  const [selectedCity, setSelectedCity] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const sortedCities = useMemo(() => getSafeCities(cities), [cities]);

  const parts = useMemo(() => pathname.split("/").filter(Boolean), [pathname]);
  const firstSegment = parts.length > 0 ? parts[0] : null;
  const city = isCitySegment(firstSegment) ? firstSegment : null;

  const isHome = pathname === "/";
  const isPrayNearMe = pathname.startsWith("/near-me/pray");
  const isHajj = pathname.startsWith("/hajj");
  const isUmrah = pathname.startsWith("/umrah");
  const isHowItWorks = pathname.startsWith("/how-it-works");
  const isTravel = pathname.startsWith("/travel");
  const isTravelNearMe = pathname.startsWith("/travel/near-me");
  const isGlobalBusinesses = pathname === "/businesses";
  const isAdvertise = pathname.startsWith("/advertise");
  const isDashboard =
    pathname.startsWith("/dashboard") || pathname.startsWith("/business-dashboard");

  const isCityHome = city ? pathname === `/${city}` : false;
  const isCityMosques = city ? pathname.startsWith(`/${city}/mosques`) : false;
  const isCityBusinesses = city
    ? pathname.startsWith(`/${city}/businesses`)
    : false;

  useEffect(() => {
    setSelectedCity(city ?? "");
    setMobileOpen(false);
  }, [city, pathname]);

  function handleCityChange(nextSlug: string) {
    const cleanSlug = cleanText(nextSlug).toLowerCase();

    setSelectedCity(cleanSlug);

    if (!cleanSlug) {
      return;
    }

    router.push(`/${cleanSlug}`);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-yellow-500/20 bg-black/95 backdrop-blur-xl print:hidden">
      <div className="mx-auto flex min-h-[96px] w-full max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="flex min-w-0 shrink-0 items-center gap-3"
          aria-label="Go to SalahNearMe homepage"
        >
          <Logo className="h-auto max-h-24 w-auto max-w-[210px] shrink-0 sm:max-w-[260px]" />

          <span className="hidden whitespace-nowrap text-lg font-bold text-yellow-400 lg:block">
            SalahNearMe
          </span>
        </Link>

        <nav
          aria-label="Main navigation"
          className="hidden min-w-0 flex-1 items-center justify-end gap-5 xl:flex"
        >
          <Link href="/" className={navClass(isHome)}>
            Home
          </Link>

          <Link href="/near-me/pray" className={navClass(isPrayNearMe)}>
            Pray near me
          </Link>

          <Link href="/hajj" className={navClass(isHajj)}>
            Hajj
          </Link>

          <Link href="/umrah" className={navClass(isUmrah)}>
            Umrah
          </Link>

          <Link href="/businesses" className={navClass(isGlobalBusinesses)}>
            Halal Businesses
          </Link>

          <Link href="/travel" className={navClass(isTravel && !isTravelNearMe)}>
            Travel
          </Link>

          <Link href="/travel/near-me" className={navClass(isTravelNearMe)}>
            Near me
          </Link>

          <Link href="/how-it-works" className={navClass(isHowItWorks)}>
            How it works
          </Link>

          <div className="w-[180px] shrink-0">
            <label htmlFor="nav-city-select" className="sr-only">
              Choose city
            </label>

            <select
              id="nav-city-select"
              value={selectedCity}
              onChange={(event) => handleCityChange(event.target.value)}
              className="w-full cursor-pointer rounded-xl border border-yellow-500/35 bg-black px-3 py-2.5 text-sm text-white outline-none transition hover:border-yellow-400/60 focus:border-yellow-400"
            >
              <option value="">Choose city</option>

              {sortedCities.map((cityOption) => (
                <option key={cityOption.slug} value={cityOption.slug}>
                  {cityOption.name}
                </option>
              ))}
            </select>
          </div>
        </nav>

        <div className="flex min-w-0 items-center gap-2 xl:hidden">
          <Link href="/near-me/pray" className={buttonNavClass(isPrayNearMe)}>
            Pray
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((current) => !current)}
            className="rounded-xl border border-yellow-500/35 bg-black px-3 py-2 text-sm font-semibold text-white transition hover:border-yellow-400 hover:text-yellow-300"
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
          >
            Menu
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          id="mobile-navigation"
          className="border-t border-yellow-500/15 bg-black/95 px-4 py-4 xl:hidden"
        >
          <nav
            aria-label="Mobile navigation"
            className="mx-auto grid max-w-7xl gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <Link href="/" className={buttonNavClass(isHome)}>
              Home
            </Link>

            <Link href="/near-me/pray" className={buttonNavClass(isPrayNearMe)}>
              Pray near me
            </Link>

            <Link href="/businesses" className={buttonNavClass(isGlobalBusinesses)}>
              Halal Businesses
            </Link>

            <Link href="/hajj" className={buttonNavClass(isHajj)}>
              Hajj
            </Link>

            <Link href="/umrah" className={buttonNavClass(isUmrah)}>
              Umrah
            </Link>

            <Link href="/travel" className={buttonNavClass(isTravel && !isTravelNearMe)}>
              Travel
            </Link>

            <Link href="/travel/near-me" className={buttonNavClass(isTravelNearMe)}>
              Near me
            </Link>

            <Link href="/how-it-works" className={buttonNavClass(isHowItWorks)}>
              How it works
            </Link>

            <Link href="/advertise" className={buttonNavClass(isAdvertise)}>
              Advertise
            </Link>

            <Link href="/dashboard/business" className={buttonNavClass(isDashboard)}>
              Dashboard
            </Link>

            {city ? (
              <>
                <Link href={`/${city}`} className={buttonNavClass(isCityHome)}>
                  {formatCity(city)}
                </Link>

                <Link
                  href={`/${city}/mosques`}
                  className={buttonNavClass(isCityMosques)}
                >
                  Mosques
                </Link>

                <Link
                  href={`/${city}/businesses`}
                  className={buttonNavClass(isCityBusinesses)}
                >
                  {formatCity(city)} Businesses
                </Link>
              </>
            ) : null}

            <div className="sm:col-span-2 lg:col-span-4">
              <label htmlFor="mobile-city-select" className="sr-only">
                Choose city
              </label>

              <select
                id="mobile-city-select"
                value={selectedCity}
                onChange={(event) => handleCityChange(event.target.value)}
                className="w-full cursor-pointer rounded-xl border border-yellow-500/35 bg-black px-3 py-3 text-sm text-white outline-none transition hover:border-yellow-400/60 focus:border-yellow-400"
              >
                <option value="">Choose city</option>

                {sortedCities.map((cityOption) => (
                  <option key={cityOption.slug} value={cityOption.slug}>
                    {cityOption.name}
                  </option>
                ))}
              </select>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}