"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

type BusinessOption = {
  id: string;
  name: string;
  city: string | null;
};

type Props = {
  businesses: BusinessOption[];
  selectedBusinessId: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normaliseBusinesses(
  businesses: BusinessOption[]
): BusinessOption[] {
  const seen = new Set<string>();
  const normalised: BusinessOption[] = [];

  for (const business of businesses ?? []) {
    const id = cleanString(business.id);
    const name = cleanString(business.name);
    const city = cleanString(business.city);

    if (
      !UUID_REGEX.test(id) ||
      !name ||
      seen.has(id)
    ) {
      continue;
    }

    seen.add(id);

    normalised.push({
      id,
      name: name.slice(0, 200),
      city: city ? city.slice(0, 120) : null,
    });
  }

  return normalised.sort((left, right) => {
    const cityComparison = (
      left.city ?? ""
    ).localeCompare(right.city ?? "", "en-GB", {
      sensitivity: "base",
    });

    if (cityComparison !== 0) {
      return cityComparison;
    }

    return left.name.localeCompare(
      right.name,
      "en-GB",
      {
        sensitivity: "base",
      }
    );
  });
}

export default function BusinessDashboardSwitcher({
  businesses,
  selectedBusinessId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isNavigating, setIsNavigating] =
    useState(false);

  const options = useMemo(
    () => normaliseBusinesses(businesses),
    [businesses]
  );

  const cleanSelectedBusinessId = useMemo(
    () => cleanString(selectedBusinessId),
    [selectedBusinessId]
  );

  const selectedId = useMemo(() => {
    if (
      options.some(
        (business) =>
          business.id === cleanSelectedBusinessId
      )
    ) {
      return cleanSelectedBusinessId;
    }

    return options[0]?.id ?? "";
  }, [cleanSelectedBusinessId, options]);

  function changeBusiness(nextBusinessId: string) {
    if (
      isNavigating ||
      nextBusinessId === selectedId ||
      !options.some(
        (business) =>
          business.id === nextBusinessId
      )
    ) {
      return;
    }

    setIsNavigating(true);

    const params = new URLSearchParams(
      searchParams.toString()
    );

    params.set(
      "business_id",
      nextBusinessId
    );

    const query = params.toString();
    const nextUrl = query
      ? `${pathname}?${query}`
      : pathname;

    router.push(nextUrl);
    router.refresh();

    window.setTimeout(() => {
      setIsNavigating(false);
    }, 1500);
  }

  if (options.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/50">
        No linked businesses available.
      </div>
    );
  }

  if (options.length === 1) {
    const onlyBusiness = options[0];

    return (
      <div className="rounded-2xl border border-yellow-500/20 bg-black px-4 py-3">
        <div className="text-sm font-bold text-white">
          {onlyBusiness.name}
        </div>

        {onlyBusiness.city ? (
          <div className="mt-1 text-xs text-white/45">
            {onlyBusiness.city}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <label
        htmlFor="business-dashboard-switcher"
        className="sr-only"
      >
        Select a business to manage
      </label>

      <select
        id="business-dashboard-switcher"
        value={selectedId}
        disabled={isNavigating}
        aria-busy={isNavigating}
        onChange={(event) => {
          changeBusiness(event.target.value);
        }}
        className="w-full appearance-none rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 pr-12 text-sm font-medium text-white outline-none transition focus:border-yellow-400 focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:cursor-wait disabled:opacity-60"
      >
        {options.map((business) => (
          <option
            key={business.id}
            value={business.id}
          >
            {business.name}
            {business.city
              ? ` — ${business.city}`
              : ""}
          </option>
        ))}
      </select>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-yellow-400"
      >
        {isNavigating ? (
          <span className="size-4 animate-spin rounded-full border-2 border-yellow-400/30 border-t-yellow-400" />
        ) : (
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-5"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>

      <p
        aria-live="polite"
        className="mt-2 text-xs text-white/40"
      >
        {isNavigating
          ? "Opening the selected business..."
          : `${options.length.toLocaleString(
              "en-GB"
            )} linked businesses available.`}
      </p>
    </div>
  );
}