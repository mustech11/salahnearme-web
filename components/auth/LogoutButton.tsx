"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/browser";

type Props = {
  className?: string;
  redirectTo?: string;
};

function getSafeRedirectPath(
  value: string
): string {
  const candidate =
    value.trim();

  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\")
  ) {
    return "/login";
  }

  return candidate;
}

export default function LogoutButton({
  className = "",
  redirectTo = "/login",
}: Props) {
  const router = useRouter();

  const mountedRef =
    useRef(true);

  const [loading, setLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function handleLogout() {
    if (loading) {
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");

      const supabase =
        createClient();

      const { error } =
        await supabase.auth.signOut();

      if (
        !mountedRef.current
      ) {
        return;
      }

      if (error) {
        setErrorMessage(
          error.message ||
            "Could not log out."
        );
        return;
      }

      router.replace(
        getSafeRedirectPath(
          redirectTo
        )
      );

      router.refresh();
    } catch (error) {
      if (
        !mountedRef.current
      ) {
        return;
      }

      console.error(
        "Logout failed:",
        error
      );

      setErrorMessage(
        "Could not log out. Please try again."
      );
    } finally {
      if (
        mountedRef.current
      ) {
        setLoading(false);
      }
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          void handleLogout()
        }
        disabled={loading}
        aria-busy={loading}
        className={`inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:cursor-wait disabled:opacity-60 ${className}`}
      >
        {loading ? (
          <>
            <span
              aria-hidden="true"
              className="mr-2 size-4 animate-spin rounded-full border-2 border-white/25 border-t-white"
            />

            Logging out…
          </>
        ) : (
          "Log out"
        )}
      </button>

      {errorMessage ? (
        <div
          role="alert"
          className="mt-2 max-w-sm rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs leading-5 text-red-200"
        >
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}