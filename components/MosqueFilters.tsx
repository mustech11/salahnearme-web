"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function MosqueFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());

    if (!value) params.delete(key);
    else params.set(key, value);

    router.push(`${pathname}?${params.toString()}`);
  }

  function activeBoolean(key: string) {
    return searchParams.get(key) === "1";
  }

  function activeJumuah(value: string) {
    return searchParams.get("jumuah") === value;
  }

  const buttonClass = (active: boolean) =>
    `rounded-xl px-4 py-2 text-sm font-semibold transition ${
      active
        ? "border border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
        : "border border-white/10 bg-black text-white/70 hover:border-yellow-500/30"
    }`;

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
      <div className="text-lg font-semibold text-yellow-400">Smart Filters</div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className={buttonClass(activeBoolean("parking"))}
          onClick={() => updateParam("parking", activeBoolean("parking") ? null : "1")}
        >
          Parking
        </button>

        <button
          className={buttonClass(activeBoolean("womens_space"))}
          onClick={() =>
            updateParam("womens_space", activeBoolean("womens_space") ? null : "1")
          }
        >
          Women’s Space
        </button>

        <button
          className={buttonClass(activeBoolean("wheelchair_access"))}
          onClick={() =>
            updateParam(
              "wheelchair_access",
              activeBoolean("wheelchair_access") ? null : "1"
            )
          }
        >
          Wheelchair Access
        </button>

        <button
          className={buttonClass(activeBoolean("live_now"))}
          onClick={() => updateParam("live_now", activeBoolean("live_now") ? null : "1")}
        >
          Live Now
        </button>

        <button
          className={buttonClass(activeJumuah("1"))}
          onClick={() => updateParam("jumuah", activeJumuah("1") ? null : "1")}
        >
          1st Jumu’ah
        </button>

        <button
          className={buttonClass(activeJumuah("2"))}
          onClick={() => updateParam("jumuah", activeJumuah("2") ? null : "2")}
        >
          2nd Jumu’ah
        </button>

        <button
          className={buttonClass(activeJumuah("3"))}
          onClick={() => updateParam("jumuah", activeJumuah("3") ? null : "3")}
        >
          3rd Jumu’ah
        </button>
      </div>
    </section>
  );
}

