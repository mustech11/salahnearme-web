"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const REQUEST_TIMEOUT_MS = 20_000;

const LIMITS = {
  name: 200,
  category: 120,
  country: 100,
  city: 120,
  area: 120,
  address: 500,
  postcode: 20,
  website: 800,
  phone: 40,
  email: 254,
  description: 2_000,
  submittedByName: 140,
  submittedByEmail: 254,
  notes: 1_000,
} as const;

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalisePostcode(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function normaliseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isValidHttpUrl(value: string): boolean {
  if (!value) return true;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function AddBusinessForm({
  initialAdvertisingType = "",
}: {
  initialAdvertisingType?: string;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("UK");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [submittedByName, setSubmittedByName] = useState("");
  const [submittedByEmail, setSubmittedByEmail] = useState("");
  const [advertisingInterest, setAdvertisingInterest] = useState(
    Boolean(initialAdvertisingType)
  );
  const [advertisingType, setAdvertisingType] = useState(initialAdvertisingType);
  const [notes, setNotes] = useState("");

  const abortControllerRef = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const completion = useMemo(() => {
    const requiredValues = [name, submittedByName, submittedByEmail];
    const optionalValues = [category, city, address, postcode, website, phone, email, description];
    const complete =
      requiredValues.filter((value) => value.trim()).length * 2 +
      optionalValues.filter((value) => value.trim()).length;

    return Math.round((complete / (requiredValues.length * 2 + optionalValues.length)) * 100);
  }, [address, category, city, description, email, name, phone, postcode, submittedByEmail, submittedByName, website]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setErrorMessage("");
    setSuccessMessage("");

    const cleanSubmitterEmail = normaliseEmail(submittedByEmail);
    const cleanBusinessEmail = normaliseEmail(email);
    const cleanWebsite = normaliseUrl(website);

    if (!cleanText(name) || !cleanText(submittedByName) || !cleanSubmitterEmail) {
      setErrorMessage("Please complete the required fields.");
      return;
    }

    if (!EMAIL_REGEX.test(cleanSubmitterEmail)) {
      setErrorMessage("Enter a valid contact email address.");
      return;
    }

    if (cleanBusinessEmail && !EMAIL_REGEX.test(cleanBusinessEmail)) {
      setErrorMessage("Enter a valid business email address.");
      return;
    }

    if (!isValidHttpUrl(cleanWebsite)) {
      setErrorMessage("Enter a valid business website.");
      return;
    }

    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      setLoading(true);

      const res = await fetch("/api/add-business", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          name: cleanText(name),
          category: cleanText(category),
          country: cleanText(country),
          city: cleanText(city),
          area: cleanText(area),
          address: cleanText(address),
          postcode: normalisePostcode(postcode),
          website: cleanWebsite,
          phone: cleanText(phone),
          email: cleanBusinessEmail,
          description: description.trim(),
          submitted_by_name: cleanText(submittedByName),
          submitted_by_email: cleanSubmitterEmail,
          advertising_interest: advertisingInterest,
          advertising_type: advertisingInterest ? advertisingType : "",
          notes: advertisingInterest ? notes.trim() : "",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMessage(data?.error ?? "Could not submit business.");
        return;
      }

      setSuccessMessage(
  "Your business submission has been received for review. We’ll use your selected advertising interest to prepare the next placement options."
);

      setName("");
      setCategory("");
      setCountry("UK");
      setCity("");
      setArea("");
      setAddress("");
      setPostcode("");
      setWebsite("");
      setPhone("");
      setEmail("");
      setDescription("");
      setSubmittedByName("");
      setSubmittedByEmail("");
      setAdvertisingInterest(Boolean(initialAdvertisingType));
      setAdvertisingType(initialAdvertisingType);
      setNotes("");
    } catch (error) {
      setErrorMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? timedOut
            ? "The submission timed out. Please try again."
            : "The submission was cancelled."
          : "Something went wrong. Please try again."
      );
    } finally {
      window.clearTimeout(timeoutId);

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }

      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-5 md:grid-cols-2">
      <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div>
          <div className="font-bold text-white">Business submission</div>
          <p className="mt-1 text-xs text-white/45">
            More complete submissions are easier to review and publish.
          </p>
        </div>

        <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-200">
          {completion}% complete
        </span>
      </div>
      <div className="md:col-span-1">
        <label
          htmlFor="business-name"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Business name *
        </label>
        <input
          id="business-name"
          required
          maxLength={LIMITS.name}
          autoComplete="organization"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="Business name"
        />
      </div>

      <div className="md:col-span-1">
        <label
          htmlFor="business-category"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Category
        </label>
        <input
          id="business-category"
          maxLength={LIMITS.category}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="e.g. Restaurant, Butcher, Services"
        />
      </div>

      <div className="md:col-span-1">
        <label
          htmlFor="business-country"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Country
        </label>
        <input
          id="business-country"
          maxLength={LIMITS.country}
          autoComplete="country-name"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="Country"
        />
      </div>

      <div className="md:col-span-1">
        <label
          htmlFor="business-city"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          City
        </label>
        <input
          id="business-city"
          maxLength={LIMITS.city}
          autoComplete="address-level2"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="City"
        />
      </div>

      <div className="md:col-span-1">
        <label
          htmlFor="business-area"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Area
        </label>
        <input
          id="business-area"
          maxLength={LIMITS.area}
          autoComplete="address-level3"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="Area / district"
        />
      </div>

      <div className="md:col-span-1">
        <label
          htmlFor="business-postcode"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Postcode / ZIP
        </label>
        <input
          id="business-postcode"
          maxLength={LIMITS.postcode}
          autoComplete="postal-code"
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="Postcode / ZIP"
        />
      </div>

      <div className="md:col-span-2">
        <label
          htmlFor="business-address"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Address
        </label>
        <input
          id="business-address"
          maxLength={LIMITS.address}
          autoComplete="street-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="Business address"
        />
      </div>

      <div className="md:col-span-1">
        <label
          htmlFor="business-website"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Website
        </label>
        <input
          id="business-website"
          type="url"
          maxLength={LIMITS.website}
          autoComplete="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="https://..."
        />
      </div>

      <div className="md:col-span-1">
        <label
          htmlFor="business-phone"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Phone
        </label>
        <input
          id="business-phone"
          type="tel"
          maxLength={LIMITS.phone}
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="Phone number"
        />
      </div>

      <div className="md:col-span-1">
        <label
          htmlFor="business-email"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Business email
        </label>
        <input
          id="business-email"
          type="email"
          maxLength={LIMITS.email}
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="Business email"
        />
      </div>

      <div className="md:col-span-1">
        <label
          htmlFor="submitted-by-name"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Your name *
        </label>
        <input
          id="submitted-by-name"
          required
          maxLength={LIMITS.submittedByName}
          autoComplete="name"
          value={submittedByName}
          onChange={(e) => setSubmittedByName(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="Your full name"
        />
      </div>

      <div className="md:col-span-1">
        <label
          htmlFor="submitted-by-email"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Your email *
        </label>
        <input
          id="submitted-by-email"
          type="email"
          required
          maxLength={LIMITS.submittedByEmail}
          autoComplete="email"
          value={submittedByEmail}
          onChange={(e) => setSubmittedByEmail(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="Your email"
        />
      </div>

      <div className="md:col-span-2">
        <label
          htmlFor="business-description"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Description
        </label>
        <textarea
          id="business-description"
          rows={5}
          maxLength={LIMITS.description}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="Tell us about the business"
        />
      </div>

      <div className="md:col-span-2 rounded-2xl border border-yellow-500/20 bg-black/30 p-5">
        <label className="flex items-center gap-3 text-white/80">
          <input
            type="checkbox"
            checked={advertisingInterest}
            onChange={(e) => {
              const checked = e.target.checked;
              setAdvertisingInterest(checked);
              if (!checked) {
                setAdvertisingType("");
              }
            }}
          />
          I am interested in advertising this business on SalahNearMe
        </label>

        {advertisingInterest && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="advertising-type"
                className="mb-2 block text-sm font-medium text-white/80"
              >
                Advertising type
              </label>
              <select
                id="advertising-type"
                value={advertisingType}
                onChange={(e) => setAdvertisingType(e.target.value)}
                className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
              >
                <option value="">Select option</option>
                <option value="city_featured">Featured City Listing</option>
                <option value="mosque_sponsor">Sponsor a Mosque</option>
                <option value="multi_mosque">Multiple Mosque Sponsorship</option>
                <option value="multi_city">Multi-City Campaign</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="advertising-notes"
                className="mb-2 block text-sm font-medium text-white/80"
              >
                Notes
              </label>
              <input
                id="advertising-notes"
                maxLength={LIMITS.notes}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
                placeholder="Anything specific you want to advertise"
              />
            </div>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="md:col-span-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      {successMessage && (
  <div className="md:col-span-2 rounded-2xl border border-green-500/30 bg-green-500/10 p-5 text-sm text-green-200">
    <div className="font-semibold text-green-100">Submission received</div>
    <div className="mt-2">{successMessage}</div>
  </div>
)}

      <div className="md:col-span-2 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Submitting..." : "Submit business"}
        </button>
      </div>
    </form>
  );
}
