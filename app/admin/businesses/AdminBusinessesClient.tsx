"use client";

import { useState } from "react";

export default function AdminBusinessesClient({ initialData }: any) {
  const [items, setItems] = useState(initialData);

  async function toggleFeatured(id: string, value: boolean) {
    await fetch("/api/admin/toggle-featured", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, featured: value }),
    });

    setItems((prev: any) =>
      prev.map((b: any) =>
        b.id === id ? { ...b, featured: value } : b
      )
    );
  }

  return (
    <div className="space-y-4">
      {items.map((b: any) => (
        <div key={b.id} className="flex justify-between border p-4 rounded-xl">
          <div>{b.name}</div>

          <button
            onClick={() => toggleFeatured(b.id, !b.featured)}
            className={`px-3 py-2 rounded-lg ${
              b.featured ? "bg-emerald-500" : "bg-white/10"
            }`}
          >
            {b.featured ? "Featured" : "Not Featured"}
          </button>
        </div>
      ))}
    </div>
  );
}

