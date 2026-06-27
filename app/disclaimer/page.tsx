import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Disclaimer | SalahNearMe",
};

export default function DisclaimerPage() {
  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6 text-white">
      <h1 className="text-4xl font-bold text-yellow-400">
        Religious Disclaimer
      </h1>

      <p>
        SalahNearMe provides general guidance based on the Qur’an and Sunnah.
      </p>

      <h2 className="text-2xl font-semibold text-yellow-400">
        No Fatwa
      </h2>
      <p className="text-white/70">
        This platform does not issue fatwas or replace qualified scholars.
      </p>

      <h2 className="text-2xl font-semibold text-yellow-400">
        Prayer Times
      </h2>
      <p className="text-white/70">
        Prayer times are estimates or locally provided data. Always verify with
        your local mosque.
      </p>

      <h2 className="text-2xl font-semibold text-yellow-400">
        Hajj & Umrah Guides
      </h2>
      <p className="text-white/70">
        These guides are simplified. Consult a scholar for personal rulings.
      </p>
    </div>
  );
}

