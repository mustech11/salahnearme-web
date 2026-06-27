import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions | SalahNearMe",
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6 text-white">
      <h1 className="text-4xl font-bold text-yellow-400">
        Terms & Conditions
      </h1>

      <p>
        By using SalahNearMe, you agree to the following terms.
      </p>

      <h2 className="text-2xl font-semibold text-yellow-400">
        Use of Platform
      </h2>
      <p className="text-white/70">
        You agree to use this platform lawfully and respectfully.
      </p>

      <h2 className="text-2xl font-semibold text-yellow-400">
        Accuracy of Information
      </h2>
      <p className="text-white/70">
        We strive for accuracy but do not guarantee that all mosque times,
        business listings, or details are always correct.
      </p>

      <h2 className="text-2xl font-semibold text-yellow-400">
        Limitation of Liability
      </h2>
      <p className="text-white/70">
        SalahNearMe is not liable for any loss or damage resulting from the use
        of this platform.
      </p>

      <h2 className="text-2xl font-semibold text-yellow-400">
        Changes
      </h2>
      <p className="text-white/70">
        We may update these terms at any time.
      </p>
    </div>
  );
}

