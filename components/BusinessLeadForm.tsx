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
};

import type { ReactNode } from "react";

type FormState = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  subject: string;
  message: string;
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST_TIMEOUT_MS = 20_000;

const INITIAL_FORM: FormState = {
  customer_name: "",
  customer_email: "",
  customer_phone: "",
  subject: "",
  message: "",
};

export default function BusinessLeadForm({ businessId }: Props) {
  const headingId = useId();
  const feedbackId = useId();
  const abortControllerRef = useRef<AbortController | null>(null);

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  const cleanBusinessId = businessId.trim();
  const validBusinessId = UUID_REGEX.test(cleanBusinessId);

  const validationError = useMemo(() => {
    if (!validBusinessId) return "This business cannot currently receive enquiries.";
    if (!form.customer_name.trim()) return "Enter your name.";
    if (!EMAIL_REGEX.test(form.customer_email.trim())) {
      return "Enter a valid email address.";
    }
    if (!form.subject.trim()) return "Enter an enquiry subject.";
    if (form.message.trim().length < 10) {
      return "Your message must be at least 10 characters.";
    }
    return "";
  }, [form, validBusinessId]);

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  function updateField<K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    if (validationError) {
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

    try {
      setLoading(true);
      setSuccessMessage("");
      setErrorMessage("");

      const response = await fetch("/api/business-leads/create", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          business_id: cleanBusinessId,
          customer_name: form.customer_name.trim(),
          customer_email: form.customer_email.trim().toLowerCase(),
          customer_phone: form.customer_phone.trim() || null,
          subject: form.subject.trim(),
          message: form.message.trim(),
        }),
      });

      const data = (await response.json().catch(() => ({}))) as ApiResponse;

      if (!response.ok || data.ok === false) {
        setErrorMessage(data.error?.trim() || "Could not send your enquiry.");
        return;
      }

      setSuccessMessage(
        data.message?.trim() || "Your enquiry was sent successfully."
      );
      setForm(INITIAL_FORM);
    } catch (error) {
      setErrorMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? timedOut
            ? "The enquiry request timed out."
            : "The enquiry request was cancelled."
          : "Could not send your enquiry. Please try again."
      );
    } finally {
      window.clearTimeout(timeoutId);

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }

      setLoading(false);
    }
  }

  const inputClassName =
    "w-full rounded-2xl border border-yellow-500/20 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/10 disabled:opacity-60";

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6"
    >
      <div className="mb-6">
        <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
          Contact business
        </div>
        <h2 id={headingId} className="mt-2 text-3xl font-black text-white">
          Send enquiry
        </h2>
        <p className="mt-2 text-sm leading-6 text-white/55">
          Your message will be sent to the business through SalahNearMe.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Your name *">
          <input
            type="text"
            autoComplete="name"
            maxLength={120}
            required
            value={form.customer_name}
            disabled={loading}
            onChange={(event) => updateField("customer_name", event.target.value)}
            className={inputClassName}
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Email address *">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={254}
              required
              value={form.customer_email}
              disabled={loading}
              onChange={(event) =>
                updateField("customer_email", event.target.value)
              }
              className={inputClassName}
            />
          </Field>

          <Field label="Phone number">
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={40}
              value={form.customer_phone}
              disabled={loading}
              onChange={(event) =>
                updateField("customer_phone", event.target.value)
              }
              className={inputClassName}
            />
          </Field>
        </div>

        <Field label="Subject *">
          <input
            type="text"
            maxLength={160}
            required
            value={form.subject}
            disabled={loading}
            onChange={(event) => updateField("subject", event.target.value)}
            className={inputClassName}
          />
        </Field>

        <Field label="Message *">
          <textarea
            value={form.message}
            maxLength={2_000}
            required
            disabled={loading}
            onChange={(event) => updateField("message", event.target.value)}
            rows={6}
            className={inputClassName}
          />
          <span className="mt-2 block text-right text-xs text-white/35">
            {form.message.length}/2000
          </span>
        </Field>

        <button
          type="submit"
          disabled={loading || !validBusinessId}
          aria-busy={loading}
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-yellow-500 px-6 py-3 font-black text-black transition hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send enquiry"}
        </button>

        <div id={feedbackId} aria-live="polite">
          {errorMessage ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200"
            >
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div
              role="status"
              className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300"
            >
              {successMessage}
            </div>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-white/75">
        {label}
      </span>
      {children}
    </label>
  );
}