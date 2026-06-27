"use client";

import { useState } from "react";

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

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!name.trim() || !submittedByName.trim() || !submittedByEmail.trim()) {
      setErrorMessage("Please complete the required fields.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/add-business", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          category,
          country,
          city,
          area,
          address,
          postcode,
          website,
          phone,
          email,
          description,
          submitted_by_name: submittedByName,
          submitted_by_email: submittedByEmail,
          advertising_interest: advertisingInterest,
          advertising_type: advertisingType,
          notes,
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
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-5 md:grid-cols-2">
      <div className="md:col-span-1">
        <label
          htmlFor="business-name"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Business name *
        </label>
        <input
          id="business-name"
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

