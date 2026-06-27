"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };

  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <section className="luxe-card max-w-2xl rounded-3xl p-10 text-center">
        <div className="text-sm uppercase tracking-[0.2em] text-red-300">
          System Error
        </div>

        <h1 className="mt-4 text-5xl font-black text-white">
          Something went wrong
        </h1>

        <p className="mt-5 text-lg leading-relaxed text-white/70">
          SalahNearMe encountered an unexpected issue while
          loading this page.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <button
            onClick={() => reset()}
            className="rounded-2xl bg-yellow-500 px-6 py-4 font-semibold text-black transition hover:bg-yellow-400"
          >
            Try again
          </button>

          <Link
            href="/"
            className="rounded-2xl border border-yellow-500/30 bg-black px-6 py-4 font-semibold text-yellow-400 hover:bg-yellow-500/10"
          >
            Homepage
          </Link>
        </div>

        {process.env.NODE_ENV === "development" && (
          <div className="mt-8 overflow-auto rounded-2xl border border-red-500/20 bg-black/40 p-4 text-left text-xs text-red-200">
            {error.message}
          </div>
        )}
      </section>
    </div>
  );
}

