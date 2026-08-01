"use client";

import {
  type FormEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type Props = {
  businessId: string;
  businessSlug: string | null;
  businessName: string | null;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

type ClaimResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const REQUEST_TIMEOUT_MS = 20_000;

const LIMITS = {
  fullName: 140,
  email: 254,
  phone: 40,
  role: 120,
  relationship: 2_000,
  proof: 2_000,
} as const;

function cleanText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

async function readResponse(response: Response): Promise<ClaimResponse> {
  try {
    const value: unknown = await response.json();

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value as ClaimResponse;
  } catch {
    return {};
  }
}

export default function BusinessClaimForm({
  businessId,
  businessSlug,
  businessName,
}: Props) {
  const feedbackId = useId();
  const abortControllerRef = useRef<AbortController | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [relationship, setRelationship] = useState("");
  const [proof, setProof] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const validBusiness = useMemo(
    () =>
      UUID_REGEX.test(cleanText(businessId)) &&
      cleanText(businessName).length > 0,
    [businessId, businessName]
  );

  const isSubmitting = submitState === "submitting";

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  function validateForm(): string | null {
    if (!validBusiness) {
      return "This business record is not valid.";
    }

    if (cleanText(fullName).length < 2) {
      return "Enter your full name.";
    }

    if (!EMAIL_REGEX.test(normaliseEmail(email))) {
      return "Enter a valid email address.";
    }

    if (cleanText(role).length < 2) {
      return "Enter your role at the business.";
    }

    if (cleanText(relationship).length < 20) {
      return "Explain your relationship to the business using at least 20 characters.";
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    setErrorMessage("");
    setSuccessMessage("");

    const validationError = validateForm();

    if (validationError) {
      setSubmitState("error");
      setErrorMessage(validationError);
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

    setSubmitState("submitting");

    try {
      const response = await fetch("/api/claim/business", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          business_id: cleanText(businessId),
          business_slug: cleanText(businessSlug) || null,
          business_name: cleanText(businessName),
          full_name: cleanText(fullName),
          email: normaliseEmail(email),
          phone: cleanText(phone),
          role: cleanText(role),
          relationship: cleanText(relationship),
          proof: cleanText(proof),
        }),
      });

      const data = await readResponse(response);

      if (!response.ok || data.ok === false) {
        setSubmitState("error");
        setErrorMessage(
          cleanText(data.error) || "Could not submit the business claim."
        );
        return;
      }

      setSubmitState("success");
      setSuccessMessage(
        cleanText(data.message) ||
          "Your business claim request has been submitted for review."
      );

      setFullName("");
      setEmail("");
      setPhone("");
      setRole("");
      setRelationship("");
      setProof("");
    } catch (error) {
      setSubmitState("error");

      if (error instanceof DOMException && error.name === "AbortError") {
        setErrorMessage(
          timedOut
            ? "The claim request timed out. Please try again."
            : "The claim request was cancelled."
        );
        return;
      }

      console.error("Business claim submission error:", error);
      setErrorMessage("Could not submit the business claim.");
    } finally {
      window.clearTimeout(timeoutId);

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }

  const inputClassName =
    "w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <form
      onSubmit={handleSubmit}
      aria-describedby={feedbackId}
      className="mt-6 grid gap-5 md:grid-cols-2"
    >
      <Field
        id="business-claim-full-name"
        label="Full name"
        required
        value={fullName}
        onChange={setFullName}
        maxLength={LIMITS.fullName}
        autoComplete="name"
        disabled={isSubmitting}
        placeholder="Your full name"
        className={inputClassName}
      />

      <Field
        id="business-claim-email"
        label="Email address"
        required
        type="email"
        value={email}
        onChange={setEmail}
        maxLength={LIMITS.email}
        autoComplete="email"
        disabled={isSubmitting}
        placeholder="you@example.com"
        className={inputClassName}
      />

      <Field
        id="business-claim-phone"
        label="Phone number"
        type="tel"
        value={phone}
        onChange={setPhone}
        maxLength={LIMITS.phone}
        autoComplete="tel"
        disabled={isSubmitting}
        placeholder="+44..."
        className={inputClassName}
      />

      <Field
        id="business-claim-role"
        label="Your role"
        required
        value={role}
        onChange={setRole}
        maxLength={LIMITS.role}
        autoComplete="organization-title"
        disabled={isSubmitting}
        placeholder="Owner, manager or authorised representative"
        className={inputClassName}
      />

      <div className="md:col-span-2">
        <label
          htmlFor="business-claim-relationship"
          className="mb-2 block text-sm font-bold text-white/80"
        >
          Why should this claim be approved?{" "}
          <span className="text-yellow-400">*</span>
        </label>

        <textarea
          id="business-claim-relationship"
          required
          minLength={20}
          maxLength={LIMITS.relationship}
          rows={6}
          value={relationship}
          disabled={isSubmitting}
          onChange={(event) => setRelationship(event.target.value)}
          className={inputClassName}
          placeholder="Explain your ownership, management role or authority to represent this business."
        />

        <p className="mt-2 text-right text-xs text-white/40">
          {relationship.length}/{LIMITS.relationship}
        </p>
      </div>

      <div className="md:col-span-2">
        <label
          htmlFor="business-claim-proof"
          className="mb-2 block text-sm font-bold text-white/80"
        >
          Supporting proof
        </label>

        <textarea
          id="business-claim-proof"
          maxLength={LIMITS.proof}
          rows={4}
          value={proof}
          disabled={isSubmitting}
          onChange={(event) => setProof(event.target.value)}
          className={inputClassName}
          placeholder="Official website, business email domain, Companies House record, social profile or other evidence."
        />

        <p className="mt-2 text-right text-xs text-white/40">
          {proof.length}/{LIMITS.proof}
        </p>
      </div>

      <div
        id={feedbackId}
        aria-live="polite"
        aria-atomic="true"
        className="md:col-span-2"
      >
        {submitState === "error" && errorMessage ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
          >
            {errorMessage}
          </div>
        ) : null}

        {submitState === "success" && successMessage ? (
          <div
            role="status"
            className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200"
          >
            {successMessage}
          </div>
        ) : null}
      </div>

      <div className="md:col-span-2 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={isSubmitting || !validBusiness}
          aria-busy={isSubmitting}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-yellow-500 px-6 py-3 text-sm font-black text-black transition hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <span
                aria-hidden="true"
                className="mr-2 size-4 animate-spin rounded-full border-2 border-black/30 border-t-black"
              />
              Submitting…
            </>
          ) : (
            "Submit business claim"
          )}
        </button>

        <p className="max-w-2xl text-xs leading-6 text-white/45">
          Claims are reviewed before dashboard access is granted.
        </p>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  required = false,
  type = "text",
  value,
  onChange,
  maxLength,
  autoComplete,
  disabled,
  placeholder,
  className,
}: {
  id: string;
  label: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  autoComplete?: string;
  disabled: boolean;
  placeholder: string;
  className: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-white/80">
        {label}{" "}
        {required ? <span className="text-yellow-400">*</span> : null}
      </label>

      <input
        id={id}
        type={type}
        required={required}
        minLength={required ? 2 : undefined}
        maxLength={maxLength}
        autoComplete={autoComplete}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={className}
      />
    </div>
  );
}