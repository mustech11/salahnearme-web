"use client";

type Props = {
  label?: string;
};

export default function PrintButton({ label = "Print timetable" }: Props) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-400 print:hidden"
    >
      {label}
    </button>
  );
}

