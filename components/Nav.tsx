"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import Logo from "@/components/Logo";

type City = {
  slug: string;
  name: string;
};

type Props = {
  cities: City[];
};

function formatCity(city: string | null) {
  if (!city) {
    return "Cities";
  }

  return city
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isCitySegment(segment: string | null) {
  if (!segment) {
    return false;
  }

  const reserved = new Set([
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
  ]);

  return !reserved.has(segment);
}

function navClass(active: boolean) {
  return active
    ? "text-yellow-400"
    : "text-white/70 transition hover:text-yellow-400";
}

export default function Nav({ cities }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [selectedCity, setSelectedCity] = useState("");

  const parts = pathname.split("/").filter(Boolean);
  const firstSegment = parts.length > 0 ? parts[0] : null;
  const city = isCitySegment(firstSegment) ? firstSegment : null;

  const isHome = pathname === "/";
  const isPrayNearMe = pathname.startsWith("/near-me/pray");
  const isNearMeSection =
    pathname.startsWith("/near-me") && !pathname.startsWith("/near-me/pray");
  const isHajj = pathname.startsWith("/hajj");
  const isUmrah = pathname.startsWith("/umrah");
  const isHowItWorks = pathname.startsWith("/how-it-works");
  const isTravelHome = pathname === "/travel";
  const isTravelNearMe = pathname.startsWith("/travel/near-me");
  const isTravelSection = pathname.startsWith("/travel") && !isTravelNearMe;
  const isGlobalBusinesses = pathname === "/businesses";
  const isCityHome = city ? pathname === `/${city}` : false;
  const isCityMosques = city ? pathname.startsWith(`/${city}/mosques`) : false;
  const isCityBusinesses = city
    ? pathname.startsWith(`/${city}/businesses`)
    : false;

  const sortedCities = useMemo(() => {
    return [...cities].sort((a, b) => a.name.localeCompare(b.name));
  }, [cities]);

  useEffect(() => {
    setSelectedCity(city ?? "");
  }, [city]);

  function handleCityChange(nextSlug: string) {
    setSelectedCity(nextSlug);

    if (!nextSlug) {
      return;
    }

    router.push(`/${nextSlug}`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-yellow-500/20 bg-black/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 overflow-hidden px-4 py-4">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <Logo className="shrink-0" />

          <span className="hidden truncate text-lg font-semibold text-yellow-400 sm:block">
            SalahNearMe
          </span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm md:flex">
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

          <Link
            href="/travel"
            className={navClass(isTravelHome || isTravelSection)}
          >
            Travel
          </Link>

          <Link
            href="/travel/near-me"
            className={navClass(isTravelNearMe || isNearMeSection)}
          >
            Near me
          </Link>

          {city ? (
            <>
              <Link href={`/${city}`} className={navClass(isCityHome)}>
                {formatCity(city)}
              </Link>

              <Link
                href={`/${city}/mosques`}
                className={navClass(isCityMosques)}
              >
                Mosques
              </Link>

              <Link
                href={`/${city}/businesses`}
                className={navClass(isCityBusinesses)}
              >
                {formatCity(city)} Businesses
              </Link>
            </>
          ) : null}

          <Link href="/how-it-works" className={navClass(isHowItWorks)}>
            How it works
          </Link>

          <div className="min-w-[170px]">
            <label htmlFor="nav-city-select" className="sr-only">
              Choose city
            </label>

            <select
              id="nav-city-select"
              value={selectedCity}
              onChange={(event) => handleCityChange(event.target.value)}
              className="w-full rounded-xl border border-yellow-500/30 bg-black px-3 py-2 text-sm text-white outline-none focus:border-yellow-400"
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

        <div className="flex items-center gap-3 md:hidden">
          <Link href="/near-me/pray" className={navClass(isPrayNearMe)}>
            Pray
          </Link>

          <Link href="/hajj" className={navClass(isHajj)}>
            Hajj
          </Link>

          <Link href="/umrah" className={navClass(isUmrah)}>
            Umrah
          </Link>

          <Link
            href="/travel"
            className={navClass(isTravelHome || isTravelSection)}
          >
            Travel
          </Link>

          <label htmlFor="mobile-city-select" className="sr-only">
            Choose city
          </label>

          <select
            id="mobile-city-select"
            value={selectedCity}
            onChange={(event) => handleCityChange(event.target.value)}
            className="max-w-[115px] rounded-xl border border-yellow-500/30 bg-black px-3 py-2 text-sm text-white outline-none focus:border-yellow-400"
          >
            <option value="">Cities</option>

            {sortedCities.map((cityOption) => (
              <option key={cityOption.slug} value={cityOption.slug}>
                {cityOption.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}

