"use client";

import {
  useCallback,
  useMemo,
  useTransition,
} from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

type BooleanFilterKey =
  | "parking"
  | "womens_space"
  | "wheelchair_access"
  | "live_now";

type JumuahFilterValue = "1" | "2" | "3";

type FilterDefinition = {
  key: BooleanFilterKey;
  label: string;
};

const BOOLEAN_FILTERS: readonly FilterDefinition[] =
  [
    {
      key: "parking",
      label: "Parking",
    },
    {
      key: "womens_space",
      label: "Women’s space",
    },
    {
      key: "wheelchair_access",
      label: "Wheelchair access",
    },
    {
      key: "live_now",
      label: "Live now",
    },
  ];

const JUMUAH_FILTERS: ReadonlyArray<{
  value: JumuahFilterValue;
  label: string;
}> = [
  {
    value: "1",
    label: "1st Jumu’ah",
  },
  {
    value: "2",
    label: "2nd Jumu’ah",
  },
  {
    value: "3",
    label: "3rd Jumu’ah",
  },
];

const SUPPORTED_KEYS = new Set([
  ...BOOLEAN_FILTERS.map(
    (filter) => filter.key
  ),
  "jumuah",
]);

export default function MosqueFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isPending, startTransition] =
    useTransition();

  const activeCount = useMemo(() => {
    let count = 0;

    for (const filter of BOOLEAN_FILTERS) {
      if (
        searchParams.get(filter.key) === "1"
      ) {
        count += 1;
      }
    }

    if (searchParams.get("jumuah")) {
      count += 1;
    }

    return count;
  }, [searchParams]);

  const navigateWithParams = useCallback(
    (params: URLSearchParams) => {
      const query = params.toString();

      startTransition(() => {
        router.push(
          query
            ? `${pathname}?${query}`
            : pathname,
          {
            scroll: false,
          }
        );
      });
    },
    [pathname, router]
  );

  const updateParam = useCallback(
    (
      key: string,
      value: string | null
    ) => {
      const params = new URLSearchParams(
        searchParams.toString()
      );

      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }

      params.delete("page");

      navigateWithParams(params);
    },
    [navigateWithParams, searchParams]
  );

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams(
      searchParams.toString()
    );

    for (const key of SUPPORTED_KEYS) {
      params.delete(key);
    }

    params.delete("page");

    navigateWithParams(params);
  }, [navigateWithParams, searchParams]);

  const isBooleanActive = useCallback(
    (key: BooleanFilterKey) =>
      searchParams.get(key) === "1",
    [searchParams]
  );

  const isJumuahActive = useCallback(
    (value: JumuahFilterValue) =>
      searchParams.get("jumuah") === value,
    [searchParams]
  );

  const buttonClass = (
    active: boolean
  ): string =>
    `rounded-xl border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:cursor-wait disabled:opacity-60 ${
      active
        ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
        : "border-white/10 bg-black text-white/70 hover:border-yellow-500/30 hover:text-white"
    }`;

  return (
    <section
      aria-labelledby="mosque-smart-filters-heading"
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="mosque-smart-filters-heading"
            className="text-lg font-semibold text-yellow-400"
          >
            Smart filters
          </h2>

          <p className="mt-1 text-sm text-white/50">
            Narrow results by facilities, live
            activity and Jumu’ah sessions.
          </p>
        </div>

        {activeCount > 0 ? (
          <button
            type="button"
            onClick={clearFilters}
            disabled={isPending}
            className="rounded-xl border border-white/10 bg-black px-3 py-2 text-xs font-bold text-white/70 transition hover:border-red-500/30 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-60"
          >
            Clear {activeCount} filter
            {activeCount === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {BOOLEAN_FILTERS.map((filter) => {
          const active = isBooleanActive(
            filter.key
          );

          return (
            <button
              key={filter.key}
              type="button"
              aria-pressed={active}
              disabled={isPending}
              className={buttonClass(active)}
              onClick={() =>
                updateParam(
                  filter.key,
                  active ? null : "1"
                )
              }
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="text-xs uppercase tracking-[0.18em] text-white/40">
          Jumu’ah sessions
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {JUMUAH_FILTERS.map((filter) => {
            const active = isJumuahActive(
              filter.value
            );

            return (
              <button
                key={filter.value}
                type="button"
                aria-pressed={active}
                disabled={isPending}
                className={buttonClass(active)}
                onClick={() =>
                  updateParam(
                    "jumuah",
                    active
                      ? null
                      : filter.value
                  )
                }
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {isPending ? (
        <div
          role="status"
          className="mt-4 text-xs text-yellow-300"
        >
          Updating mosque results…
        </div>
      ) : null}
    </section>
  );
}