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
  mosqueId: string;
  mosqueSlug: string;
  mosqueName: string;
};

type SubmitState =
  | "idle"
  | "submitting"
  | "success"
  | "error";

type ClaimResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

const REQUEST_TIMEOUT_MS = 20_000;

const LIMITS = {
  fullName: 140,
  email: 254,
  phone: 40,
  role: 120,
  relationship: 2_000,
  proof: 2_000,
} as const;

function cleanText(value: string): string {
  return value.trim();
}

function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

async function readResponse(
  response: Response
): Promise<ClaimResponse> {
  try {
    const value: unknown = await response.json();

    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return {};
    }

    return value as ClaimResponse;
  } catch {
    return {};
  }
}

export default function ClaimMosqueForm({
  mosqueId,
  mosqueSlug,
  mosqueName,
}: Props) {
  const feedbackId = useId();

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [relationship, setRelationship] =
    useState("");
  const [proof, setProof] = useState("");

  const [submitState, setSubmitState] =
    useState<SubmitState>("idle");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const validMosque = useMemo(
    () =>
      UUID_REGEX.test(mosqueId) &&
      cleanText(mosqueSlug).length > 0 &&
      cleanText(mosqueName).length > 0,
    [mosqueId, mosqueName, mosqueSlug]
  );

  const isSubmitting =
    submitState === "submitting";

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  function validateForm(): string | null {
    if (!validMosque) {
      return "This mosque record is not valid.";
    }

    if (cleanText(fullName).length < 2) {
      return "Enter your full name.";
    }

    const cleanEmail = normaliseEmail(email);

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return "Enter a valid email address.";
    }

    if (cleanText(role).length < 2) {
      return "Enter your role at the mosque.";
    }

    if (cleanText(relationship).length < 20) {
      return "Explain your relationship to the mosque using at least 20 characters.";
    }

    return null;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

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
      const response = await fetch(
        "/api/claim-mosque",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify({
            mosque_id: mosqueId,
            mosque_slug:
              cleanText(mosqueSlug),
            mosque_name:
              cleanText(mosqueName),
            full_name:
              cleanText(fullName),
            email: normaliseEmail(email),
            phone: cleanText(phone),
            role: cleanText(role),
            relationship:
              cleanText(relationship),
            proof: cleanText(proof),
          }),
        }
      );

      const data =
        await readResponse(response);

      if (
        !response.ok ||
        data.ok === false
      ) {
        setSubmitState("error");
        setErrorMessage(
          cleanText(data.error ?? "") ||
            "The claim request could not be submitted."
        );
        return;
      }

      setSubmitState("success");
      setSuccessMessage(
        cleanText(data.message ?? "") ||
          "Your mosque claim request has been submitted for review."
      );

      setFullName("");
      setEmail("");
      setPhone("");
      setRole("");
      setRelationship("");
      setProof("");
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        setSubmitState("error");
        setErrorMessage(
          timedOut
            ? "The claim request timed out. Please try again."
            : "The claim request was cancelled."
        );
        return;
      }

      console.error(
        "Mosque claim submission error:",
        error
      );

      setSubmitState("error");
      setErrorMessage(
        "The claim request could not be submitted."
      );
    } finally {
      window.clearTimeout(timeoutId);

      if (
        abortControllerRef.current === controller
      ) {
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
      <div>
        <label
          htmlFor="claim-full-name"
          className="mb-2 block text-sm font-bold text-white/80"
        >
          Full name{" "}
          <span className="text-yellow-400">
            *
          </span>
        </label>

        <input
          id="claim-full-name"
          name="full_name"
          type="text"
          required
          minLength={2}
          maxLength={LIMITS.fullName}
          autoComplete="name"
          disabled={isSubmitting}
          value={fullName}
          onChange={(event) =>
            setFullName(event.target.value)
          }
          placeholder="Your full name"
          className={inputClassName}
        />
      </div>

      <div>
        <label
          htmlFor="claim-email"
          className="mb-2 block text-sm font-bold text-white/80"
        >
          Email address{" "}
          <span className="text-yellow-400">
            *
          </span>
        </label>

        <input
          id="claim-email"
          name="email"
          type="email"
          required
          maxLength={LIMITS.email}
          autoComplete="email"
          inputMode="email"
          disabled={isSubmitting}
          value={email}
          onChange={(event) =>
            setEmail(event.target.value)
          }
          placeholder="you@example.com"
          className={inputClassName}
        />
      </div>

      <div>
        <label
          htmlFor="claim-phone"
          className="mb-2 block text-sm font-bold text-white/80"
        >
          Phone number
        </label>

        <input
          id="claim-phone"
          name="phone"
          type="tel"
          maxLength={LIMITS.phone}
          autoComplete="tel"
          inputMode="tel"
          disabled={isSubmitting}
          value={phone}
          onChange={(event) =>
            setPhone(event.target.value)
          }
          placeholder="+44..."
          className={inputClassName}
        />
      </div>

      <div>
        <label
          htmlFor="claim-role"
          className="mb-2 block text-sm font-bold text-white/80"
        >
          Your role at the mosque{" "}
          <span className="text-yellow-400">
            *
          </span>
        </label>

        <input
          id="claim-role"
          name="role"
          type="text"
          required
          minLength={2}
          maxLength={LIMITS.role}
          autoComplete="organization-title"
          disabled={isSubmitting}
          value={role}
          onChange={(event) =>
            setRole(event.target.value)
          }
          placeholder="e.g. Imam, trustee or administrator"
          className={inputClassName}
        />
      </div>

      <div className="md:col-span-2">
        <label
          htmlFor="claim-relationship"
          className="mb-2 block text-sm font-bold text-white/80"
        >
          Why should this claim be approved?{" "}
          <span className="text-yellow-400">
            *
          </span>
        </label>

        <textarea
          id="claim-relationship"
          name="relationship"
          required
          rows={6}
          minLength={20}
          maxLength={LIMITS.relationship}
          disabled={isSubmitting}
          value={relationship}
          onChange={(event) =>
            setRelationship(
              event.target.value
            )
          }
          placeholder="Explain your position, responsibilities and relationship with the mosque management team."
          className={inputClassName}
        />

        <div className="mt-2 text-right text-xs text-white/40">
          {relationship.length}/
          {LIMITS.relationship}
        </div>
      </div>

      <div className="md:col-span-2">
        <label
          htmlFor="claim-proof"
          className="mb-2 block text-sm font-bold text-white/80"
        >
          Supporting information
        </label>

        <textarea
          id="claim-proof"
          name="proof"
          rows={4}
          maxLength={LIMITS.proof}
          disabled={isSubmitting}
          value={proof}
          onChange={(event) =>
            setProof(event.target.value)
          }
          placeholder="Official mosque website, management email, public social profile, charity registration or other verification information."
          className={inputClassName}
        />

        <div className="mt-2 text-right text-xs text-white/40">
          {proof.length}/{LIMITS.proof}
        </div>
      </div>

      <div
        id={feedbackId}
        aria-live="polite"
        aria-atomic="true"
        className="md:col-span-2"
      >
        {submitState === "error" &&
        errorMessage ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
          >
            {errorMessage}
          </div>
        ) : null}

        {submitState === "success" &&
        successMessage ? (
          <div
            role="status"
            className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200"
          >
            {successMessage}
          </div>
        ) : null}
      </div>

      <div className="md:col-span-2 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={
            isSubmitting || !validMosque
          }
          aria-busy={isSubmitting}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-yellow-500 px-6 py-3 text-sm font-black text-black transition hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <span
                aria-hidden="true"
                className="mr-2 size-4 animate-spin rounded-full border-2 border-black/30 border-t-black"
              />
              Submitting...
            </>
          ) : (
            "Submit claim request"
          )}
        </button>

        <p className="max-w-2xl text-xs leading-6 text-white/45">
          Submitting a claim does not provide immediate dashboard access.
          Claims must be reviewed and approved.
        </p>
      </div>
    </form>
  );
}