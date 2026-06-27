import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("Invalid NEXT_PUBLIC_SUPABASE_URL"),

  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, "Missing or invalid NEXT_PUBLIC_SUPABASE_ANON_KEY"),

  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

  NEXT_PUBLIC_DAILY_MODE: z.string().optional(),
});

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(20, "Missing or invalid SUPABASE_SERVICE_ROLE_KEY"),

  ADMIN_EMAILS: z.string().optional(),

  CRON_SECRET: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),

  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  STRIPE_PRICE_FEATURED_BUSINESS: z.string().optional(),

  STRIPE_PRICE_SPONSOR_MOSQUE: z.string().optional(),

  HASH_SALT: z.string().min(10).optional(),
});

function parsePublicEnv() {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_DAILY_MODE: process.env.NEXT_PUBLIC_DAILY_MODE,
  });
}

function parseServerEnv() {
  return serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    CRON_SECRET: process.env.CRON_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_FEATURED_BUSINESS:
      process.env.STRIPE_PRICE_FEATURED_BUSINESS,
    STRIPE_PRICE_SPONSOR_MOSQUE: process.env.STRIPE_PRICE_SPONSOR_MOSQUE,
    HASH_SALT: process.env.HASH_SALT,
  });
}

export const publicEnv = parsePublicEnv();

export const serverEnv = parseServerEnv();

export function getSiteUrl() {
  return (
    publicEnv.NEXT_PUBLIC_SITE_URL ??
    publicEnv.NEXT_PUBLIC_APP_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://salahnearme.com"
      : "http://localhost:3000")
  ).replace(/\/+$/, "");
}

export function getAdminEmails() {
  return (serverEnv.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function maskSecret(value: string | undefined) {
  if (!value) {
    return null;
  }

  if (value.length <= 10) {
    return "configured";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function getEnvHealthReport() {
  return {
    node_env: process.env.NODE_ENV ?? "unknown",
    site_url: getSiteUrl(),
    public: {
      NEXT_PUBLIC_SUPABASE_URL: {
        configured: Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL),
        masked: maskSecret(publicEnv.NEXT_PUBLIC_SUPABASE_URL),
      },
      NEXT_PUBLIC_SUPABASE_ANON_KEY: {
        configured: Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        masked: maskSecret(publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      },
      NEXT_PUBLIC_APP_URL: {
        configured: Boolean(publicEnv.NEXT_PUBLIC_APP_URL),
        masked: publicEnv.NEXT_PUBLIC_APP_URL ?? null,
      },
      NEXT_PUBLIC_SITE_URL: {
        configured: Boolean(publicEnv.NEXT_PUBLIC_SITE_URL),
        masked: publicEnv.NEXT_PUBLIC_SITE_URL ?? null,
      },
      NEXT_PUBLIC_DAILY_MODE: {
        configured: Boolean(publicEnv.NEXT_PUBLIC_DAILY_MODE),
        masked: publicEnv.NEXT_PUBLIC_DAILY_MODE ?? null,
      },
    },
    server: {
      SUPABASE_SERVICE_ROLE_KEY: {
        configured: Boolean(serverEnv.SUPABASE_SERVICE_ROLE_KEY),
        masked: maskSecret(serverEnv.SUPABASE_SERVICE_ROLE_KEY),
      },
      ADMIN_EMAILS: {
        configured: Boolean(serverEnv.ADMIN_EMAILS),
        masked: serverEnv.ADMIN_EMAILS ? "configured" : null,
      },
      CRON_SECRET: {
        configured: Boolean(serverEnv.CRON_SECRET),
        masked: maskSecret(serverEnv.CRON_SECRET),
      },
      OPENAI_API_KEY: {
        configured: Boolean(serverEnv.OPENAI_API_KEY),
        masked: maskSecret(serverEnv.OPENAI_API_KEY),
      },
      STRIPE_SECRET_KEY: {
        configured: Boolean(serverEnv.STRIPE_SECRET_KEY),
        masked: maskSecret(serverEnv.STRIPE_SECRET_KEY),
      },
      STRIPE_WEBHOOK_SECRET: {
        configured: Boolean(serverEnv.STRIPE_WEBHOOK_SECRET),
        masked: maskSecret(serverEnv.STRIPE_WEBHOOK_SECRET),
      },
      STRIPE_PRICE_FEATURED_BUSINESS: {
        configured: Boolean(serverEnv.STRIPE_PRICE_FEATURED_BUSINESS),
        masked: maskSecret(serverEnv.STRIPE_PRICE_FEATURED_BUSINESS),
      },
      STRIPE_PRICE_SPONSOR_MOSQUE: {
        configured: Boolean(serverEnv.STRIPE_PRICE_SPONSOR_MOSQUE),
        masked: maskSecret(serverEnv.STRIPE_PRICE_SPONSOR_MOSQUE),
      },
      HASH_SALT: {
        configured: Boolean(serverEnv.HASH_SALT),
        masked: maskSecret(serverEnv.HASH_SALT),
      },
    },
    safe_note:
      "Only configuration status and masked values are shown. Full secrets are never returned.",
  };
}

