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
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import { createClient } from "@/lib/supabase/browser";

type SubmitState =
  | "idle"
  | "submitting"
  | "error";

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_REDIRECT =
  "/dashboard/business";

function cleanString(
  value: string | null | undefined,
  maxLength = 2_000
): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function getSafeRedirectPath(
  value: string | null
): string {
  const candidate =
    cleanString(value);

  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\")
  ) {
    return DEFAULT_REDIRECT;
  }

  return candidate;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams =
    useSearchParams();

  const errorId = useId();
  const mountedRef =
    useRef(true);

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [submitState, setSubmitState] =
    useState<SubmitState>("idle");

  const [errorMessage, setErrorMessage] =
    useState("");

  const redirectPath = useMemo(
    () =>
      getSafeRedirectPath(
        searchParams.get("next")
      ),
    [searchParams]
  );

  const isSubmitting =
    submitState === "submitting";

  const validationError = useMemo(() => {
    const cleanEmail =
      email.trim().toLowerCase();

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

    if (!password) {
      return "Enter your password.";
    }

    return "";
  }, [email, password]);

  useEffect(() => {
    mountedRef.current = true;

    const suppliedError =
      cleanString(
        searchParams.get("error"),
        500
      );

    if (suppliedError) {
      setSubmitState("error");
      setErrorMessage(
        suppliedError
      );
    }

    return () => {
      mountedRef.current = false;
    };
  }, [searchParams]);

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage("");

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

      const { error } =
        await supabase.auth.signInWithPassword(
          {
            email: email
              .trim()
              .toLowerCase(),
            password,
          }
        );

      if (!mountedRef.current) {
        return;
      }

      if (error) {
        setSubmitState("error");
        setErrorMessage(
          error.message ||
            "The email or password was not accepted."
        );
        return;
      }

      router.replace(
        redirectPath
      );

      router.refresh();
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      console.error(
        "Login failed:",
        error
      );

      setSubmitState("error");
      setErrorMessage(
        "Could not log in. Please check your connection and try again."
      );
    }
  }

  const inputClassName =
    "w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/10 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <form
      onSubmit={handleLogin}
      className="grid gap-5"
      noValidate
    >
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
            autoComplete="current-password"
            maxLength={200}
            value={password}
            disabled={isSubmitting}
            onChange={(event) => {
              setPassword(
                event.target.value
              );
              setErrorMessage("");
            }}
            className={`${inputClassName} pr-24`}
            placeholder="Your password"
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
      </label>

      <div className="-mt-2 flex justify-end">
        <Link
          href="/forgot-password"
          className="text-xs font-bold text-yellow-300 transition hover:text-yellow-200"
        >
          Forgot password?
        </Link>
      </div>

      {errorMessage ? (
        <div
          id={errorId}
          role="alert"
          className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-200"
        >
          {errorMessage}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        aria-describedby={
          errorMessage
            ? errorId
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

            Logging in…
          </>
        ) : (
          "Log in"
        )}
      </button>

      <p className="text-center text-sm text-white/50">
        New to SalahNearMe?{" "}
        <Link
          href="/signup"
          className="font-bold text-yellow-300 hover:text-yellow-200"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}