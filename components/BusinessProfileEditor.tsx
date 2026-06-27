"use client";

import { useMemo, useState } from "react";

type Business = {
  id: string;
  phone: string | null;
  website: string | null;
  maps_url: string | null;
  address: string | null;
  postcode: string | null;
  area: string | null;
  description: string | null;
};

type FormState = {
  phone: string;
  website: string;
  maps_url: string;
  address: string;
  postcode: string;
  area: string;
  description: string;
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
};

function cleanUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function cleanPhone(value: string) {
  return value.trim();
}

async function readJsonSafely(res: Response): Promise<ApiResponse> {
  const contentType = res.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await res.text();

    return {
      ok: false,
      error: `Expected JSON but received ${
        contentType || "unknown response"
      }. First response text: ${text.slice(0, 140)}`,
    };
  }

  try {
    return (await res.json()) as ApiResponse;
  } catch {
    return {
      ok: false,
      error: "Server returned invalid JSON.",
    };
  }
}

export default function BusinessProfileEditor({
  business,
}: {
  business: Business;
}) {
  const [form, setForm] = useState<FormState>({
    phone: business.phone ?? "",
    website: business.website ?? "",
    maps_url: business.maps_url ?? "",
    address: business.address ?? "",
    postcode: business.postcode ?? "",
    area: business.area ?? "",
    description: business.description ?? "",
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const normalisedWebsite = useMemo(
    () => cleanUrl(form.website),
    [form.website]
  );

  const normalisedMapsUrl = useMemo(
    () => cleanUrl(form.maps_url),
    [form.maps_url]
  );

  const normalisedPhone = useMemo(
    () => cleanPhone(form.phone),
    [form.phone]
  );

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setMessage("");
    setErrorMessage("");
  }

  async function saveProfile() {
    try {
      setSaving(true);
      setMessage("");
      setErrorMessage("");

      const payload = {
        business_id: business.id,
        phone: normalisedPhone,
        website: normalisedWebsite,
        maps_url: normalisedMapsUrl,
        address: form.address.trim(),
        postcode: form.postcode.trim(),
        area: form.area.trim(),
        description: form.description.trim(),
      };

      const res = await fetch("/api/business-dashboard/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const data = await readJsonSafely(res);

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Could not save profile.");
        return;
      }

      setMessage("Business profile updated successfully.");
    } catch (error) {
      console.error("BusinessProfileEditor save error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not save profile."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
      <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
        Listing Editor
      </div>

      <h2 className="mt-3 text-3xl font-black text-white">
        Edit business profile
      </h2>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
        You can update public contact and listing details. Verification,
        sponsorship, ranking, and payment status are controlled by admin.
      </p>

      {message ? (
        <div className="mt-5 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
          {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Input
          label="Phone"
          value={form.phone}
          placeholder="+44..."
          inputMode="tel"
          onChange={(value) => updateField("phone", value)}
        />

        <Input
          label="Website"
          value={form.website}
          placeholder="https://example.com"
          inputMode="url"
          onChange={(value) => updateField("website", value)}
        />

        <Input
          label="Google Maps URL"
          value={form.maps_url}
          placeholder="https://www.google.com/maps/..."
          inputMode="url"
          onChange={(value) => updateField("maps_url", value)}
        />

        <Input
          label="Area"
          value={form.area}
          placeholder="Rusholme, Cheetham Hill, Longsight..."
          onChange={(value) => updateField("area", value)}
        />

        <Input
          label="Address"
          value={form.address}
          placeholder="Street address"
          onChange={(value) => updateField("address", value)}
        />

        <Input
          label="Postcode"
          value={form.postcode}
          placeholder="M14..."
          onChange={(value) => updateField("postcode", value)}
        />
      </div>

      <div className="mt-4">
        <label className="text-sm font-semibold text-yellow-400">
          Description
        </label>

        <textarea
          value={form.description}
          onChange={(e) =>
            updateField("description", e.target.value)
          }
          rows={5}
          className="mt-2 w-full rounded-2xl border border-yellow-500/20 bg-black px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
          placeholder="Tell people about your business..."
        />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={saveProfile}
          disabled={saving}
          className="rounded-2xl bg-yellow-500 px-6 py-3 text-sm font-bold text-black hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>

        <div className="flex flex-wrap gap-3">
          {normalisedPhone ? (
            <a
              href={`tel:${normalisedPhone}`}
              className="rounded-2xl border border-yellow-500/20 px-5 py-3 text-sm font-bold text-yellow-300 hover:border-yellow-400"
            >
              Test phone
            </a>
          ) : null}

          {normalisedWebsite ? (
            <a
              href={normalisedWebsite}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border border-yellow-500/20 px-5 py-3 text-sm font-bold text-yellow-300 hover:border-yellow-400"
            >
              Test website
            </a>
          ) : null}

          {normalisedMapsUrl ? (
            <a
              href={normalisedMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border border-yellow-500/20 px-5 py-3 text-sm font-bold text-yellow-300 hover:border-yellow-400"
            >
              Test map
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?:
    | "text"
    | "search"
    | "email"
    | "tel"
    | "url"
    | "none"
    | "numeric"
    | "decimal";
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-yellow-400">
        {label}
      </label>

      <input
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-yellow-500/20 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-yellow-400"
      />
    </div>
  );
}

