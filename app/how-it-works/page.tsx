export default function HowItWorks() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">How SalahNearMe works</h1>

      <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-6 space-y-4 text-sm text-white/70">
        <div>
          <div className="font-semibold text-white">Daily Hadith</div>
          <p className="mt-1">
            Daily reminders are sourced from HadeethEnc and shown with attribution and a link back to the original.
          </p>
        </div>

        <div>
          <div className="font-semibold text-white">Community Signal</div>
          <p className="mt-1">
            Community signals (e.g., “Iqamah started”, “Delayed”) are optional and require multiple recent reports to show.
            They are guidance only, not official mosque announcements.
          </p>
        </div>

        <div>
          <div className="font-semibold text-white">Mosques stay free</div>
          <p className="mt-1">
            We do not charge mosques. The platform is supported by ethical halal business listings and sponsorships.
          </p>
        </div>

        <div>
          <div className="font-semibold text-white">Adab-first</div>
          <p className="mt-1">
            The platform is designed to be calm and respectful. No comments, no drama, no distractions.
          </p>
        </div>
      </div>
    </div>
  );
}

