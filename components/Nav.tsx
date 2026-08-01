"use client";

import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Logo from "@/components/Logo";

type City = {
  slug: string | null;
  name: string | null;
};

type Props = {
  cities?: City[] | null;
};

type NavigationItem = {
  href: string;
  label: string;
  active: boolean;
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

function cleanText(
  value: string | null | undefined,
  maxLength = 180
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanSlug(value: string | null | undefined): string {
  return cleanText(value, 160)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function formatCity(value: string | null | undefined): string {
  const slug = cleanSlug(value);

  if (!slug) {
    return "City";
  }

  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isCitySegment(segment: string | null | undefined): boolean {
  const value = cleanSlug(segment);

  return Boolean(value && !RESERVED_SEGMENTS.has(value));
}

function getSafeCities(cities?: City[] | null) {
  const seen = new Set<string>();

  return (cities ?? [])
    .map((city) => {
      const slug = cleanSlug(city.slug);
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
    .sort((first, second) =>
      first.name.localeCompare(second.name, "en-GB")
    );
}

function desktopLinkClass(active: boolean): string {
  return [
    "relative whitespace-nowrap py-3 text-sm font-semibold transition",
    "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-center after:scale-x-0 after:bg-yellow-400 after:transition-transform",
    active
      ? "text-yellow-300 after:scale-x-100"
      : "text-white/66 hover:text-yellow-200 hover:after:scale-x-100",
  ].join(" ");
}

function mobileLinkClass(active: boolean): string {
  return [
    "flex min-h-12 items-center justify-between rounded-2xl border px-4 py-3 text-sm font-bold transition",
    active
      ? "border-yellow-400/45 bg-yellow-400/10 text-yellow-200"
      : "border-white/10 bg-white/[0.025] text-white/72 hover:border-yellow-400/30 hover:bg-yellow-400/[0.05] hover:text-yellow-200",
  ].join(" ");
}

export default function Nav({ cities = [] }: Props) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileToggleRef = useRef<HTMLButtonElement | null>(null);

  const [selectedCity, setSelectedCity] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cityNavigating, setCityNavigating] = useState(false);

  const sortedCities = useMemo(
    () => getSafeCities(cities),
    [cities]
  );

  const pathParts = useMemo(
    () => pathname.split("/").filter(Boolean),
    [pathname]
  );

  const firstSegment = pathParts[0] ?? null;
  const city = isCitySegment(firstSegment)
    ? cleanSlug(firstSegment)
    : null;

  const navigationItems = useMemo<NavigationItem[]>(() => {
    return [
      {
        href: "/",
        label: "Home",
        active: pathname === "/",
      },
      {
        href: "/near-me/pray",
        label: "Pray near me",
        active: pathname.startsWith("/near-me/pray"),
      },
      {
        href: "/businesses",
        label: "Halal businesses",
        active:
          pathname === "/businesses" ||
          Boolean(city && pathname.startsWith(`/${city}/businesses`)),
      },
      {
        href: "/travel",
        label: "Travel",
        active: pathname.startsWith("/travel"),
      },
      {
        href: "/hajj",
        label: "Hajj",
        active: pathname.startsWith("/hajj"),
      },
      {
        href: "/umrah",
        label: "Umrah",
        active: pathname.startsWith("/umrah"),
      },
    ];
  }, [city, pathname]);

  useEffect(() => {
    setSelectedCity(city ?? "");
    setMobileOpen(false);
  }, [city, pathname]);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        mobileToggleRef.current?.focus();
      }
    }

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(target)
      ) {
        setMobileOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [mobileOpen]);

  function handleCityChange(nextValue: string) {
    const nextSlug = cleanSlug(nextValue);

    setSelectedCity(nextSlug);

    if (!nextSlug) {
      return;
    }

    document.cookie = [
      `snm_city=${encodeURIComponent(nextSlug)}`,
      "path=/",
      "max-age=31536000",
      "samesite=lax",
      window.location.protocol === "https:" ? "secure" : "",
    ]
      .filter(Boolean)
      .join("; ");

    setCityNavigating(true);
    setMobileOpen(false);

    router.push(`/${encodeURIComponent(nextSlug)}`);

    window.setTimeout(() => {
      setCityNavigating(false);
    }, 2_000);
  }

  const dashboardActive =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/business-dashboard");

  const cityHomeActive = Boolean(
    city && pathname === `/${city}`
  );

  const cityMosquesActive = Boolean(
    city && pathname.startsWith(`/${city}/mosques`)
  );

  const cityBusinessesActive = Boolean(
    city && pathname.startsWith(`/${city}/businesses`)
  );

  return (
    <header className="sticky top-0 z-50 border-b border-yellow-500/15 bg-[#01040d]/92 backdrop-blur-2xl print:hidden">
      <div className="mx-auto flex min-h-[82px] w-full max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="Open the SalahNearMe homepage"
          className="group flex min-w-0 shrink-0 items-center gap-3"
        >
          <Logo className="h-auto max-h-[68px] w-auto max-w-[185px] object-contain transition duration-300 group-hover:brightness-110 sm:max-w-[220px]" />

          <span className="hidden whitespace-nowrap text-lg font-black text-yellow-400 2xl:block">
            SalahNearMe
          </span>
        </Link>

        <nav
          aria-label="Primary navigation"
          className="hidden min-w-0 flex-1 items-center justify-center gap-5 xl:flex 2xl:gap-7"
        >
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={desktopLinkClass(item.active)}
            >
              {item.label}
            </Link>
          ))}

          <Link
            href="/how-it-works"
            className={desktopLinkClass(
              pathname.startsWith("/how-it-works")
            )}
          >
            How it works
          </Link>
        </nav>

        <div className="ml-auto hidden shrink-0 items-center gap-2 xl:flex">
          <div className="relative w-[185px] 2xl:w-[210px]">
            <label htmlFor="desktop-city-select" className="sr-only">
              Choose city
            </label>

            <select
              id="desktop-city-select"
              value={selectedCity}
              disabled={cityNavigating}
              onChange={(event) =>
                handleCityChange(event.target.value)
              }
              className="premium-select appearance-none pr-10 text-sm font-semibold"
            >
              <option value="">Choose city</option>

              {sortedCities.map((cityOption) => (
                <option
                  key={cityOption.slug}
                  value={cityOption.slug}
                >
                  {cityOption.name}
                </option>
              ))}
            </select>

            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-yellow-300"
            >
              ▾
            </span>
          </div>
        </div>

        <div
          ref={mobileMenuRef}
          className="relative ml-auto flex items-center gap-2 xl:hidden"
        >
          <Link
            href="/near-me/pray"
            className="hidden rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm font-bold text-yellow-300 transition hover:border-yellow-400/60 sm:inline-flex"
          >
            Pray now
          </Link>

          <button
            ref={mobileToggleRef}
            type="button"
            onClick={() => setMobileOpen((current) => !current)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            aria-label={
              mobileOpen
                ? "Close navigation menu"
                : "Open navigation menu"
            }
            className="premium-icon-button"
          >
            <span className="sr-only">
              {mobileOpen ? "Close menu" : "Open menu"}
            </span>

            <span
              aria-hidden="true"
              className="flex h-5 w-5 flex-col justify-center gap-1.5"
            >
              <span
                className={[
                  "h-0.5 w-full rounded-full bg-current transition",
                  mobileOpen
                    ? "translate-y-2 rotate-45"
                    : "",
                ].join(" ")}
              />

              <span
                className={[
                  "h-0.5 w-full rounded-full bg-current transition",
                  mobileOpen ? "opacity-0" : "",
                ].join(" ")}
              />

              <span
                className={[
                  "h-0.5 w-full rounded-full bg-current transition",
                  mobileOpen
                    ? "-translate-y-2 -rotate-45"
                    : "",
                ].join(" ")}
              />
            </span>
          </button>

          {mobileOpen ? (
            <div
              id="mobile-navigation"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation menu"
              className="absolute right-0 top-[calc(100%+0.8rem)] max-h-[calc(100vh-7rem)] w-[min(92vw,430px)] overflow-y-auto rounded-3xl border border-yellow-500/20 bg-[#030918]/98 p-4 shadow-2xl shadow-black/60 backdrop-blur-2xl"
            >
              <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-yellow-400">
                    SalahNearMe
                  </div>

                  <div className="mt-1 text-sm text-white/50">
                    Find. Pray. Connect.
                  </div>
                </div>

                <span className="premium-badge">
                  Menu
                </span>
              </div>

              <nav
                aria-label="Mobile navigation"
                className="grid gap-2 sm:grid-cols-2"
              >
                {navigationItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={item.active ? "page" : undefined}
                    className={mobileLinkClass(item.active)}
                  >
                    <span>{item.label}</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                ))}

                <Link
                  href="/how-it-works"
                  className={mobileLinkClass(
                    pathname.startsWith("/how-it-works")
                  )}
                >
                  <span>How it works</span>
                  <span aria-hidden="true">→</span>
                </Link>

                <Link
                  href="/advertise"
                  className={mobileLinkClass(
                    pathname.startsWith("/advertise")
                  )}
                >
                  <span>Advertise</span>
                  <span aria-hidden="true">→</span>
                </Link>

                <Link
                  href="/business-dashboard"
                  className={mobileLinkClass(dashboardActive)}
                >
                  <span>Dashboard</span>
                  <span aria-hidden="true">→</span>
                </Link>

                {city ? (
                  <>
                    <Link
                      href={`/${city}`}
                      className={mobileLinkClass(cityHomeActive)}
                    >
                      <span>{formatCity(city)}</span>
                      <span aria-hidden="true">→</span>
                    </Link>

                    <Link
                      href={`/${city}/mosques`}
                      className={mobileLinkClass(
                        cityMosquesActive
                      )}
                    >
                      <span>City mosques</span>
                      <span aria-hidden="true">→</span>
                    </Link>

                    <Link
                      href={`/${city}/businesses`}
                      className={mobileLinkClass(
                        cityBusinessesActive
                      )}
                    >
                      <span>City businesses</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </>
                ) : null}
              </nav>

              <div className="mt-4 border-t border-white/10 pt-4">
                <label
                  htmlFor="mobile-city-select"
                  className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-yellow-400"
                >
                  Choose your city
                </label>

                <div className="relative">
                  <select
                    id="mobile-city-select"
                    value={selectedCity}
                    disabled={cityNavigating}
                    onChange={(event) =>
                      handleCityChange(event.target.value)
                    }
                    className="premium-select appearance-none pr-10 text-sm"
                  >
                    <option value="">Choose city</option>

                    {sortedCities.map((cityOption) => (
                      <option
                        key={cityOption.slug}
                        value={cityOption.slug}
                      >
                        {cityOption.name}
                      </option>
                    ))}
                  </select>

                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-yellow-300"
                  >
                    {cityNavigating ? (
                      <span className="block size-4 animate-spin rounded-full border-2 border-yellow-300/30 border-t-yellow-300" />
                    ) : (
                      "▾"
                    )}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}