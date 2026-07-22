import { z } from "zod";

const optionalString = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().optional()
);

const optionalUrl = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().url().optional()
);

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({
      error: "Missing NEXT_PUBLIC_SUPABASE_URL",
    })
    .trim()
    .url("Invalid NEXT_PUBLIC_SUPABASE_URL"),

  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string({
      error: "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY",
    })
    .trim()
    .min(
      20,
      "Missing or invalid NEXT_PUBLIC_SUPABASE_ANON_KEY"
    ),

  NEXT_PUBLIC_APP_URL: optionalUrl,

  NEXT_PUBLIC_SITE_URL: optionalUrl,

  NEXT_PUBLIC_DAILY_MODE: optionalString,
});

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string({
      error: "Missing SUPABASE_SERVICE_ROLE_KEY",
    })
    .trim()
    .min(
      20,
      "Missing or invalid SUPABASE_SERVICE_ROLE_KEY"
    ),

  ADMIN_EMAILS: optionalString,

  CRON_SECRET: optionalString,

  OPENAI_API_KEY: optionalString,

  STRIPE_SECRET_KEY: optionalString,

  STRIPE_WEBHOOK_SECRET: optionalString,

  STRIPE_PRICE_FEATURED_BUSINESS: optionalString,

  STRIPE_PRICE_SPONSOR_MOSQUE: optionalString,

  HASH_SALT: z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();

      return trimmed.length > 0 ? trimmed : undefined;
    },
    z
      .string()
      .min(10, "HASH_SALT must contain at least 10 characters")
      .optional()
  ),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

function formatValidationError(
  error: z.ZodError
): Error {
  const details = error.issues
    .map((issue) => {
      const field =
        issue.path.length > 0
          ? issue.path.join(".")
          : "environment";

      return `${field}: ${issue.message}`;
    })
    .join("; ");

  return new Error(
    `Invalid environment configuration: ${details}`
  );
}

function parsePublicEnv(): PublicEnv {
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_DAILY_MODE:
      process.env.NEXT_PUBLIC_DAILY_MODE,
  });

  if (!result.success) {
    throw formatValidationError(result.error);
  }

  return result.data;
}

function parseServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error(
      "Server environment variables cannot be accessed in the browser."
    );
  }

  const result = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY:
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    CRON_SECRET: process.env.CRON_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    STRIPE_SECRET_KEY:
      process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET:
      process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_FEATURED_BUSINESS:
      process.env.STRIPE_PRICE_FEATURED_BUSINESS,
    STRIPE_PRICE_SPONSOR_MOSQUE:
      process.env.STRIPE_PRICE_SPONSOR_MOSQUE,
    HASH_SALT: process.env.HASH_SALT,
  });

  if (!result.success) {
    throw formatValidationError(result.error);
  }

  return result.data;
}

export const publicEnv = parsePublicEnv();

let cachedServerEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  cachedServerEnv = parseServerEnv();

  return cachedServerEnv;
}

/**
 * Backwards-compatible lazy server environment object.
 *
 * Importing this module in a client bundle will no longer immediately parse
 * server-only environment variables. Validation happens only when a server
 * property is actually accessed.
 */
export const serverEnv = new Proxy(
  {} as ServerEnv,
  {
    get(_target, property: string | symbol) {
      const env = getServerEnv();

      return Reflect.get(env, property);
    },

    has(_target, property: string | symbol) {
      const env = getServerEnv();

      return Reflect.has(env, property);
    },

    ownKeys() {
      const env = getServerEnv();

      return Reflect.ownKeys(env);
    },

    getOwnPropertyDescriptor(
      _target,
      property: string | symbol
    ) {
      const env = getServerEnv();

      if (!Reflect.has(env, property)) {
        return undefined;
      }

      return {
        configurable: true,
        enumerable: true,
        value: Reflect.get(env, property),
        writable: false,
      };
    },
  }
);

export function getSiteUrl(): string {
  const configuredUrl =
    publicEnv.NEXT_PUBLIC_SITE_URL ??
    publicEnv.NEXT_PUBLIC_APP_URL;

  const fallbackUrl =
    process.env.NODE_ENV === "production"
      ? "https://www.salahnearme.com"
      : "http://localhost:3000";

  return (configuredUrl ?? fallbackUrl).replace(
    /\/+$/,
    ""
  );
}

export function getAdminEmails(): string[] {
  const env = getServerEnv();

  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(
      (email, index, emails) =>
        Boolean(email) &&
        emails.indexOf(email) === index
    );
}

function maskSecret(
  value: string | undefined
): string | null {
  if (!value) {
    return null;
  }

  if (value.length <= 10) {
    return "configured";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function getEnvHealthReport() {
  const env = getServerEnv();

  return {
    node_env: process.env.NODE_ENV ?? "unknown",
    site_url: getSiteUrl(),

    public: {
      NEXT_PUBLIC_SUPABASE_URL: {
        configured: Boolean(
          publicEnv.NEXT_PUBLIC_SUPABASE_URL
        ),
        masked: maskSecret(
          publicEnv.NEXT_PUBLIC_SUPABASE_URL
        ),
      },

      NEXT_PUBLIC_SUPABASE_ANON_KEY: {
        configured: Boolean(
          publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ),
        masked: maskSecret(
          publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ),
      },

      NEXT_PUBLIC_APP_URL: {
        configured: Boolean(
          publicEnv.NEXT_PUBLIC_APP_URL
        ),
        masked:
          publicEnv.NEXT_PUBLIC_APP_URL ?? null,
      },

      NEXT_PUBLIC_SITE_URL: {
        configured: Boolean(
          publicEnv.NEXT_PUBLIC_SITE_URL
        ),
        masked:
          publicEnv.NEXT_PUBLIC_SITE_URL ?? null,
      },

      NEXT_PUBLIC_DAILY_MODE: {
        configured: Boolean(
          publicEnv.NEXT_PUBLIC_DAILY_MODE
        ),
        masked:
          publicEnv.NEXT_PUBLIC_DAILY_MODE ?? null,
      },
    },

    server: {
      SUPABASE_SERVICE_ROLE_KEY: {
        configured: Boolean(
          env.SUPABASE_SERVICE_ROLE_KEY
        ),
        masked: maskSecret(
          env.SUPABASE_SERVICE_ROLE_KEY
        ),
      },

      ADMIN_EMAILS: {
        configured: Boolean(env.ADMIN_EMAILS),
        masked: env.ADMIN_EMAILS
          ? "configured"
          : null,
      },

      CRON_SECRET: {
        configured: Boolean(env.CRON_SECRET),
        masked: maskSecret(env.CRON_SECRET),
      },

      OPENAI_API_KEY: {
        configured: Boolean(env.OPENAI_API_KEY),
        masked: maskSecret(env.OPENAI_API_KEY),
      },

      STRIPE_SECRET_KEY: {
        configured: Boolean(
          env.STRIPE_SECRET_KEY
        ),
        masked: maskSecret(
          env.STRIPE_SECRET_KEY
        ),
      },

      STRIPE_WEBHOOK_SECRET: {
        configured: Boolean(
          env.STRIPE_WEBHOOK_SECRET
        ),
        masked: maskSecret(
          env.STRIPE_WEBHOOK_SECRET
        ),
      },

      STRIPE_PRICE_FEATURED_BUSINESS: {
        configured: Boolean(
          env.STRIPE_PRICE_FEATURED_BUSINESS
        ),
        masked: maskSecret(
          env.STRIPE_PRICE_FEATURED_BUSINESS
        ),
      },

      STRIPE_PRICE_SPONSOR_MOSQUE: {
        configured: Boolean(
          env.STRIPE_PRICE_SPONSOR_MOSQUE
        ),
        masked: maskSecret(
          env.STRIPE_PRICE_SPONSOR_MOSQUE
        ),
      },

      HASH_SALT: {
        configured: Boolean(env.HASH_SALT),
        masked: maskSecret(env.HASH_SALT),
      },
    },

    safe_note:
      "Only configuration status and masked values are shown. Full secrets are never returned.",
  };
}