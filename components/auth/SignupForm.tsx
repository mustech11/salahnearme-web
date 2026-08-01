"use client";

import Link from "next/link";
import {
  type FormEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/browser";

type SubmitState =
  | "idle"
  | "submitting"
  | "success"
  | "error";

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_PASSWORD_LENGTH = 8;

function cleanString(
  value: string,
  maxLength: number
): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export default function SignupForm() {
  const feedbackId = useId();

  const mountedRef =
    useRef(true);

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [fullName, setFullName] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [submitState, setSubmitState] =
    useState<SubmitState>("idle");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const isSubmitting =
    submitState === "submitting";

  const validationError = useMemo(() => {
    const cleanName =
      cleanString(
        fullName,
        120
      );

    const cleanEmail =
      email
        .trim()
        .toLowerCase();

    if (!cleanName) {
      return "Enter your full name.";
    }

    if (!cleanEmail) {
      return "Enter your email address.";
    }

    if (
      !EMAIL_REGEX.test(
        cleanEmail
      )
    ) {
      return "Enter a valid email address.";
    }

    if (
      password.length <
      MIN_PASSWORD_LENGTH
    ) {
      return `Your password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    return "";
  }, [
    email,
    fullName,
    password,
  ]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function handleSignup(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    if (validationError) {
      setSubmitState("error");
      setErrorMessage(
        validationError
      );
      return;
    }

    try {
      setSubmitState(
        "submitting"
      );

      const supabase =
        createClient();

      const callbackUrl =
        new URL(
          "/auth/callback",
          window.location.origin
        );

      callbackUrl.searchParams.set(
        "next",
        "/dashboard/business"
      );

      const { data, error } =
        await supabase.auth.signUp(
          {
            email: email
              .trim()
              .toLowerCase(),
            password,
            options: {
              data: {
                full_name:
                  cleanString(
                    fullName,
                    120
                  ),
              },
              emailRedirectTo:
                callbackUrl.toString(),
            },
          }
        );

      if (
        !mountedRef.current
      ) {
        return;
      }

      if (error) {
        setSubmitState("error");
        setErrorMessage(
          error.message ||
            "Could not create your account."
        );
        return;
      }

      setSubmitState("success");

      setSuccessMessage(
        data.session
          ? "Your account has been created and you are signed in."
          : "Your account has been created. Check your email to confirm your account."
      );

      setEmail("");
      setPassword("");
      setFullName("");
      setShowPassword(false);
    } catch (error) {
      if (
        !mountedRef.current
      ) {
        return;
      }

      console.error(
        "Signup failed:",
        error
      );

      setSubmitState("error");
      setErrorMessage(
        "Could not create your account. Please check your connection and try again."
      );
    }
  }

  const inputClassName =
    "w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/10 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <form
      onSubmit={handleSignup}
      className="grid gap-5"
      noValidate
    >
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-white/80">
          Full name
        </span>

        <input
          type="text"
          autoComplete="name"
          maxLength={120}
          value={fullName}
          disabled={isSubmitting}
          onChange={(event) => {
            setFullName(
              event.target.value
            );
            setErrorMessage("");
            setSuccessMessage("");
          }}
          className={inputClassName}
          placeholder="Your full name"
          required
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-white/80">
          Email address
        </span>

        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          value={email}
          disabled={isSubmitting}
          onChange={(event) => {
            setEmail(
              event.target.value
            );
            setErrorMessage("");
            setSuccessMessage("");
          }}
          className={inputClassName}
          placeholder="you@example.com"
          required
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-white/80">
          Password
        </span>

        <div className="relative">
          <input
            type={
              showPassword
                ? "text"
                : "password"
            }
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={200}
            value={password}
            disabled={isSubmitting}
            onChange={(event) => {
              setPassword(
                event.target.value
              );
              setErrorMessage("");
              setSuccessMessage("");
            }}
            className={`${inputClassName} pr-24`}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            required
          />

          <button
            type="button"
            onClick={() =>
              setShowPassword(
                (current) =>
                  !current
              )
            }
            disabled={isSubmitting}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-3 py-2 text-xs font-bold text-yellow-300 transition hover:bg-yellow-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
          >
            {showPassword
              ? "Hide"
              : "Show"}
          </button>
        </div>

        <p className="mt-2 text-xs text-white/40">
          Use at least {MIN_PASSWORD_LENGTH} characters and avoid reusing a password from another service.
        </p>
      </label>

      <div
        id={feedbackId}
        aria-live="polite"
      >
        {errorMessage ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-200"
          >
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div
            role="status"
            className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-200"
          >
            {successMessage}
          </div>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        aria-describedby={
          errorMessage ||
          successMessage
            ? feedbackId
            : undefined
        }
        className="inline-flex min-h-12 items-center justify-center rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-black transition hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:cursor-wait disabled:opacity-60"
      >
        {isSubmitting ? (
          <>
            <span
              aria-hidden="true"
              className="mr-2 size-4 animate-spin rounded-full border-2 border-black/30 border-t-black"
            />

            Creating account…
          </>
        ) : (
          "Create account"
        )}
      </button>

      <p className="text-center text-sm text-white/50">
        Already registered?{" "}
        <Link
          href="/login"
          className="font-bold text-yellow-300 hover:text-yellow-200"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}