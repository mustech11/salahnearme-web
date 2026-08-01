"use client";

import { useState } from "react";

type Props = { label?: string; className?: string };

export default function PrintButton({
  label = "Print timetable",
  className = "",
}: Props) {
  const [printing, setPrinting] = useState(false);

  function printPage() {
    if (printing) return;

    setPrinting(true);

    const reset = () => setPrinting(false);
    window.addEventListener("afterprint", reset, { once: true });
    window.print();
    window.setTimeout(reset, 2_000);
  }

  return (
    <button
      type="button"
      onClick={printPage}
      disabled={printing}
      aria-busy={printing}
      className={`inline-flex min-h-10 items-center justify-center rounded-xl bg-yellow-500 px-4 py-2 text-sm font-black text-black transition hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:opacity-50 print:hidden ${className}`}
    >
      {printing ? "Opening print…" : label}
    </button>
  );
}