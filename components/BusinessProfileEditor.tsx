"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
  business?: Partial<Business>;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_PHONE_LENGTH = 40;
const MAX_URL_LENGTH = 800;
const MAX_ADDRESS_LENGTH = 500;
const MAX_POSTCODE_LENGTH = 20;
const MAX_AREA_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2_000;

function normaliseUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return /^(https?):\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function normalisePhone(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalisePostcode(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function isValidHttpUrl(value: string): boolean {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateForm(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  const website = normaliseUrl(form.website);
  const mapsUrl = normaliseUrl(form.maps_url);

  if (form.phone.length > MAX_PHONE_LENGTH) {
    errors.phone = `Phone must be ${MAX_PHONE_LENGTH} characters or fewer.`;
  }

  if (!isValidHttpUrl(website)) {
    errors.website = "Enter a valid website URL.";
  }

  if (!isValidHttpUrl(mapsUrl)) {
    errors.maps_url = "Enter a valid Google Maps URL.";
  }

  if (form.address.length > MAX_ADDRESS_LENGTH) {
    errors.address = `Address must be ${MAX_ADDRESS_LENGTH} characters or fewer.`;
  }

  if (form.postcode.length > MAX_POSTCODE_LENGTH) {
    errors.postcode = `Postcode must be ${MAX_POSTCODE_LENGTH} characters or fewer.`;
  }

  if (form.area.length > MAX_AREA_LENGTH) {
    errors.area = `Area must be ${MAX_AREA_LENGTH} characters or fewer.`;
  }

  if (form.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`;
  }

  return errors;
}

async function readJsonSafely(res: Response): Promise<ApiResponse> {
  const contentType = res.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");

    return {
      ok: false,
      error: `The server returned an unexpected response (${res.status}). ${text
        .slice(0, 160)
        .trim()}`.trim(),
    };
  }

  try {
    return (await res.json()) as ApiResponse;
  } catch {
    return {
      ok: false,
      error: "The server returned invalid JSON.",
    };
  }
}

function createInitialForm(business: Business): FormState {
  return {
    phone: business.phone ?? "",
    website: business.website ?? "",
    maps_url: business.maps_url ?? "",
    address: business.address ?? "",
    postcode: business.postcode ?? "",
    area: business.area ?? "",
    description: business.description ?? "",
  };
}

export default function BusinessProfileEditor({ business }: { business: Business }) {
  const router = useRouter();
  const initialFormRef = useRef<FormState>(createInitialForm(business));

  const [form, setForm] = useState<FormState>(initialFormRef.current);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const normalisedWebsite = useMemo(() => normaliseUrl(form.website), [form.website]);
  const normalisedMapsUrl = useMemo(() => normaliseUrl(form.maps_url), [form.maps_url]);
  const normalisedPhone = useMemo(() => normalisePhone(form.phone), [form.phone]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialFormRef.current),
    [form]
  );

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setMessage("");
    setErrorMessage("");
  }

  function resetForm() {
    setForm(initialFormRef.current);
    setFieldErrors({});
    setMessage("");
    setErrorMessage("");
  }

  async function saveProfile() {
    if (saving) {
      return;
    }

    const errors = validateForm(form);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMessage("Please correct the highlighted fields.");
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      setSaving(true);
      setMessage("");
      setErrorMessage("");
      setFieldErrors({});

      const payload: FormState & { business_id: string } = {
        business_id: business.id,
        phone: normalisedPhone,
        website: normalisedWebsite,
        maps_url: normalisedMapsUrl,
        address: form.address.trim(),
        postcode: normalisePostcode(form.postcode),
        area: form.area.trim().replace(/\s+/g, " "),
        description: form.description.trim(),
      };

      const res = await fetch("/api/business-dashboard/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify(payload),
      });

      const data = await readJsonSafely(res);

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Could not save the business profile.");
        return;
      }

      const savedForm: FormState = {
        phone: payload.phone,
        website: payload.website,
        maps_url: payload.maps_url,
        address: payload.address,
        postcode: payload.postcode,
        area: payload.area,
        description: payload.description,
      };

      initialFormRef.current = savedForm;
      setForm(savedForm);
      setMessage("Business profile updated successfully.");
      router.refresh();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setErrorMessage("The request timed out. Please try again.");
      } else {
        console.error("BusinessProfileEditor save error:", error);
        setErrorMessage("Could not save the business profile. Please try again.");
      }
    } finally {
      window.clearTimeout(timeoutId);
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="business-profile-editor-heading"
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8"
    >
      <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
        Listing editor
      </div>

      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 id="business-profile-editor-heading" className="text-3xl font-black text-white">
            Edit business profile
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
            Update public contact and listing details. Verification, sponsorship,
            ranking and payment status remain controlled by SalahNearMe admin.
          </p>
        </div>

        <span
          className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${
            isDirty
              ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {isDirty ? "Unsaved changes" : "Saved"}
        </span>
      </div>

      <div aria-live="polite">
        {message ? (
          <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {message}
          </div>
        ) : null}

        {errorMessage ? (
          <div role="alert" className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Input
          id="business-phone"
          label="Phone"
          value={form.phone}
          placeholder="+44..."
          inputMode="tel"
          autoComplete="tel"
          maxLength={MAX_PHONE_LENGTH}
          error={fieldErrors.phone}
          onChange={(value) => updateField("phone", value)}
        />

        <Input
          id="business-website"
          label="Website"
          value={form.website}
          placeholder="https://example.com"
          inputMode="url"
          autoComplete="url"
          maxLength={MAX_URL_LENGTH}
          error={fieldErrors.website}
          onChange={(value) => updateField("website", value)}
        />

        <Input
          id="business-maps-url"
          label="Google Maps URL"
          value={form.maps_url}
          placeholder="https://www.google.com/maps/..."
          inputMode="url"
          maxLength={MAX_URL_LENGTH}
          error={fieldErrors.maps_url}
          onChange={(value) => updateField("maps_url", value)}
        />

        <Input
          id="business-area"
          label="Area"
          value={form.area}
          placeholder="Rusholme, Cheetham Hill, Longsight..."
          maxLength={MAX_AREA_LENGTH}
          error={fieldErrors.area}
          onChange={(value) => updateField("area", value)}
        />

        <Input
          id="business-address"
          label="Address"
          value={form.address}
          placeholder="Street address"
          autoComplete="street-address"
          maxLength={MAX_ADDRESS_LENGTH}
          error={fieldErrors.address}
          onChange={(value) => updateField("address", value)}
        />

        <Input
          id="business-postcode"
          label="Postcode"
          value={form.postcode}
          placeholder="M14 5XX"
          autoComplete="postal-code"
          maxLength={MAX_POSTCODE_LENGTH}
          error={fieldErrors.postcode}
          onChange={(value) => updateField("postcode", value.toUpperCase())}
        />
      </div>

      <div className="mt-4">
        <label htmlFor="business-description" className="text-sm font-semibold text-yellow-400">
          Description
        </label>

        <textarea
          id="business-description"
          value={form.description}
          onChange={(event) => updateField("description", event.target.value)}
          rows={6}
          maxLength={MAX_DESCRIPTION_LENGTH}
          aria-invalid={Boolean(fieldErrors.description)}
          aria-describedby="business-description-help"
          className={`mt-2 w-full rounded-2xl border bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-yellow-400 ${
            fieldErrors.description ? "border-red-500/50" : "border-yellow-500/20"
          }`}
          placeholder="Tell people what your business offers, who it serves and what makes it useful."
        />

        <div id="business-description-help" className="mt-2 flex items-center justify-between gap-3 text-xs text-white/40">
          <span>{fieldErrors.description ?? "Public description shown on the business profile."}</span>
          <span>{form.description.length}/{MAX_DESCRIPTION_LENGTH}</span>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void saveProfile()}
            disabled={saving || !isDirty}
            className="rounded-2xl bg-yellow-500 px-6 py-3 text-sm font-bold text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save profile"}
          </button>

          <button
            type="button"
            onClick={resetForm}
            disabled={saving || !isDirty}
            className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reset changes
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          {normalisedPhone ? <PreviewLink href={`tel:${normalisedPhone}`} label="Test phone" /> : null}
          {isValidHttpUrl(normalisedWebsite) && normalisedWebsite ? (
            <PreviewLink href={normalisedWebsite} label="Test website" external />
          ) : null}
          {isValidHttpUrl(normalisedMapsUrl) && normalisedMapsUrl ? (
            <PreviewLink href={normalisedMapsUrl} label="Test map" external />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Input({
  id,
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  autoComplete,
  maxLength,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  maxLength?: number;
  error?: string;
}) {
  const helpId = `${id}-help`;

  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-yellow-400">
        {label}
      </label>

      <input
        id={id}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={helpId}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-2 w-full rounded-2xl border bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-yellow-400 ${
          error ? "border-red-500/50" : "border-yellow-500/20"
        }`}
      />

      <div id={helpId} className={`mt-1 min-h-5 text-xs ${error ? "text-red-300" : "text-white/35"}`}>
        {error ?? (maxLength ? `${value.length}/${maxLength}` : "")}
      </div>
    </div>
  );
}

function PreviewLink({ href, label, external = false }: { href: string; label: string; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="rounded-2xl border border-yellow-500/20 px-5 py-3 text-sm font-bold text-yellow-300 transition hover:border-yellow-400 hover:bg-yellow-500/10"
    >
      {label}
    </a>
  );
}