"use client";

type BusinessOption = {
  id: string;
  name: string;
  city: string | null;
};

export default function BusinessDashboardSwitcher({
  businesses,
  selectedBusinessId,
}: {
  businesses: BusinessOption[];
  selectedBusinessId: string;
}) {
  return (
    <select
      value={selectedBusinessId}
      className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none"
      onChange={(event) => {
        window.location.href = `/business-dashboard?business_id=${event.target.value}`;
      }}
    >
      {businesses.map((business) => (
        <option key={business.id} value={business.id}>
          {business.name}
          {business.city ? ` — ${business.city}` : ""}
        </option>
      ))}
    </select>
  );
}

