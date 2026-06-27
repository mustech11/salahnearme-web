import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | SalahNearMe",
  description: "How SalahNearMe collects and uses data.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6 text-white">
      <h1 className="text-4xl font-bold text-yellow-400">Privacy Policy</h1>

      <p>
        SalahNearMe respects your privacy. This policy explains how we collect,
        use, and protect your data.
      </p>

      <h2 className="text-2xl font-semibold text-yellow-400">Data We Collect</h2>
      <ul className="list-disc pl-6 text-white/70">
        <li>Location data (for mosque search)</li>
        <li>Device/browser data</li>
        <li>User interactions (analytics)</li>
      </ul>

      <h2 className="text-2xl font-semibold text-yellow-400">How We Use Data</h2>
      <ul className="list-disc pl-6 text-white/70">
        <li>Provide mosque and business listings</li>
        <li>Improve user experience</li>
        <li>Prevent abuse and fraud</li>
      </ul>

      <h2 className="text-2xl font-semibold text-yellow-400">Third Parties</h2>
      <p className="text-white/70">
        We may use services like Supabase, Stripe, and analytics tools which
        process data securely.
      </p>

      <h2 className="text-2xl font-semibold text-yellow-400">Your Rights</h2>
      <p className="text-white/70">
        You can request deletion of your data at any time.
      </p>
    </div>
  );
}

