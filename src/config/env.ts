import { z } from "zod";

import { AppError } from "@/lib/errors/app-error";

const BOOLEAN_TRUE_VALUES = ["1", "true", "yes", "on"] as const;
const BOOLEAN_FALSE_VALUES = ["0", "false", "no", "off"] as const;

const booleanFromEnv = (defaultValue: boolean) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value, context) => {
      if (value === undefined || value.length === 0) {
        return defaultValue;
      }

      const normalized = value.toLowerCase();

      if (BOOLEAN_TRUE_VALUES.includes(normalized as (typeof BOOLEAN_TRUE_VALUES)[number])) {
        return true;
      }

      if (BOOLEAN_FALSE_VALUES.includes(normalized as (typeof BOOLEAN_FALSE_VALUES)[number])) {
        return false;
      }

      context.addIssue({
        code: "custom",
        message:
          'Expected a boolean-like value: "true", "false", "1", "0", "yes", "no", "on", or "off".',
      });

      return z.NEVER;
    });

export const publicEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z
    .url({ error: "Provide a valid absolute URL, for example http://localhost:3000." })
    .trim()
    .default("http://localhost:3000"),
  NEXT_PUBLIC_DEFAULT_CITY: z
    .string()
    .trim()
    .min(1, "City name cannot be empty.")
    .default("Karachi"),
  NEXT_PUBLIC_ENABLE_ADMIN: booleanFromEnv(true),
  NEXT_PUBLIC_ENABLE_AUTH: booleanFromEnv(true),
  // GTM is the single tracking pipeline (GA4 + Meta Pixel are configured in
  // the GTM container), so only the container ID is needed here.
  NEXT_PUBLIC_GTM_ID: z.string().trim().optional(),
});

export const serverEnvSchema = z
  .object({
    APP_SECRET: z.string().trim().min(1, "APP_SECRET cannot be empty.").optional(),

    // Auth.js v5 secret — required in any non-development environment.
    // Generate with: openssl rand -base64 32
    AUTH_SECRET: z
      .string()
      .trim()
      .min(32, "AUTH_SECRET must be at least 32 characters for security.")
      .optional(),
    AUTH_URL: z.url({ error: "AUTH_URL must be a valid absolute URL." }).trim().optional(),

    // Google OAuth credentials — required when Google SSO is enabled.
    AUTH_GOOGLE_ID: z.string().trim().min(1, "AUTH_GOOGLE_ID cannot be empty.").optional(),
    AUTH_GOOGLE_SECRET: z.string().trim().min(1, "AUTH_GOOGLE_SECRET cannot be empty.").optional(),

    // Optional Redis-backed rate limiting (recommended for production).
    UPSTASH_REDIS_REST_URL: z
      .url({ error: "UPSTASH_REDIS_REST_URL must be a valid absolute URL." })
      .trim()
      .optional(),
    UPSTASH_REDIS_REST_TOKEN: z
      .string()
      .trim()
      .min(1, "UPSTASH_REDIS_REST_TOKEN cannot be empty.")
      .optional(),

    // Extra trusted origins for reverse proxies or separate first-party domains.
    APP_ALLOWED_ORIGINS: z.string().trim().optional(),

    // Notification recipients and channels.
    NOTIFY_ADMIN_EMAILS: z.string().trim().optional(),
    SMTP_HOST: z.string().trim().min(1, "SMTP_HOST cannot be empty.").optional(),
    SMTP_PORT: z
      .string()
      .trim()
      .regex(/^\d+$/, "SMTP_PORT must be a valid port number.")
      .optional(),
    SMTP_SECURE: z.string().trim().optional(),
    SMTP_USER: z.string().trim().min(1, "SMTP_USER cannot be empty.").optional(),
    SMTP_PASSWORD: z.string().trim().min(1, "SMTP_PASSWORD cannot be empty.").optional(),
    SMTP_FROM_EMAIL: z.email("SMTP_FROM_EMAIL must be a valid email address.").trim().optional(),
    SMTP_FROM_NAME: z.string().trim().optional(),
    TELEGRAM_BOT_TOKEN: z.string().trim().min(1, "TELEGRAM_BOT_TOKEN cannot be empty.").optional(),
    TELEGRAM_CHAT_ID: z.string().trim().min(1, "TELEGRAM_CHAT_ID cannot be empty.").optional(),

    // Meta Conversion API (server-side events). Both the Pixel ID and the
    // access token are required to enable CAPI; the token is server-only and
    // must never be exposed to the browser via a NEXT_PUBLIC_* variable.
    META_PIXEL_ID: z.string().trim().min(1, "META_PIXEL_ID cannot be empty.").optional(),
    META_CAPI_ACCESS_TOKEN: z
      .string()
      .trim()
      .min(1, "META_CAPI_ACCESS_TOKEN cannot be empty.")
      .optional(),
    // Optional "Test Events" code from Meta Events Manager for validation.
    META_CAPI_TEST_EVENT_CODE: z.string().trim().optional(),
    // Optional Graph API version override (defaults to a supported version).
    META_CAPI_GRAPH_VERSION: z
      .string()
      .trim()
      .regex(/^v\d+\.\d+$/, "META_CAPI_GRAPH_VERSION must look like v21.0.")
      .optional(),
  })
  .superRefine((value, context) => {
    const hasRedisUrl = Boolean(value.UPSTASH_REDIS_REST_URL);
    const hasRedisToken = Boolean(value.UPSTASH_REDIS_REST_TOKEN);

    if (hasRedisUrl !== hasRedisToken) {
      context.addIssue({
        code: "custom",
        message:
          "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must either both be set or both be omitted.",
        path: [hasRedisUrl ? "UPSTASH_REDIS_REST_TOKEN" : "UPSTASH_REDIS_REST_URL"],
      });
    }

    const smtpRequiredKeys: Array<keyof typeof value> = [
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_FROM_EMAIL",
    ];
    const hasAnySmtpConfig = smtpRequiredKeys.some((key) => Boolean(value[key]));

    if (hasAnySmtpConfig) {
      for (const key of smtpRequiredKeys) {
        if (!value[key]) {
          context.addIssue({
            code: "custom",
            message: `${key} is required when SMTP email notifications are configured.`,
            path: [key],
          });
        }
      }
    }

    const hasSmtpUser = Boolean(value.SMTP_USER);
    const hasSmtpPassword = Boolean(value.SMTP_PASSWORD);

    if (hasSmtpUser !== hasSmtpPassword) {
      context.addIssue({
        code: "custom",
        message: "SMTP_USER and SMTP_PASSWORD must either both be set or both be omitted.",
        path: [hasSmtpUser ? "SMTP_PASSWORD" : "SMTP_USER"],
      });
    }

    if (value.NOTIFY_ADMIN_EMAILS) {
      const emails = value.NOTIFY_ADMIN_EMAILS.split(",").map((email) => email.trim());

      for (const email of emails) {
        if (email.length === 0) {
          continue;
        }

        const parsed = z.email().safeParse(email);
        if (!parsed.success) {
          context.addIssue({
            code: "custom",
            message: `Invalid email in NOTIFY_ADMIN_EMAILS: ${email}`,
            path: ["NOTIFY_ADMIN_EMAILS"],
          });
        }
      }
    }

    const hasTelegramToken = Boolean(value.TELEGRAM_BOT_TOKEN);
    const hasTelegramChatId = Boolean(value.TELEGRAM_CHAT_ID);

    if (hasTelegramToken !== hasTelegramChatId) {
      context.addIssue({
        code: "custom",
        message:
          "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must either both be set or both be omitted.",
        path: [hasTelegramToken ? "TELEGRAM_CHAT_ID" : "TELEGRAM_BOT_TOKEN"],
      });
    }

    const hasMetaPixelId = Boolean(value.META_PIXEL_ID);
    const hasMetaCapiToken = Boolean(value.META_CAPI_ACCESS_TOKEN);

    if (hasMetaPixelId !== hasMetaCapiToken) {
      context.addIssue({
        code: "custom",
        message:
          "META_PIXEL_ID and META_CAPI_ACCESS_TOKEN must either both be set or both be omitted.",
        path: [hasMetaPixelId ? "META_CAPI_ACCESS_TOKEN" : "META_PIXEL_ID"],
      });
    }

    if (!value.APP_ALLOWED_ORIGINS) {
      return;
    }

    for (const origin of value.APP_ALLOWED_ORIGINS.split(",")) {
      const trimmedOrigin = origin.trim();

      if (trimmedOrigin.length === 0) {
        continue;
      }

      try {
        new URL(trimmedOrigin);
      } catch {
        context.addIssue({
          code: "custom",
          message: `Invalid origin in APP_ALLOWED_ORIGINS: ${trimmedOrigin}`,
          path: ["APP_ALLOWED_ORIGINS"],
        });
      }
    }
  });

type PublicEnvValues = z.infer<typeof publicEnvSchema>;
type ServerEnvValues = z.infer<typeof serverEnvSchema>;

export type EnvSource = Readonly<Record<string, string | undefined>>;
export type ServerEnvName = keyof ServerEnvValues;

export type RuntimeEnv = Readonly<{
  nodeEnv: PublicEnvValues["NODE_ENV"];
  appUrl: PublicEnvValues["NEXT_PUBLIC_APP_URL"];
  defaultCity: PublicEnvValues["NEXT_PUBLIC_DEFAULT_CITY"];
  enableAdminPreview: PublicEnvValues["NEXT_PUBLIC_ENABLE_ADMIN"];
  enableAuthPreview: PublicEnvValues["NEXT_PUBLIC_ENABLE_AUTH"];
  gtmId: PublicEnvValues["NEXT_PUBLIC_GTM_ID"];
}>;

function formatEnvErrors(scope: "public" | "server", error: z.ZodError) {
  const details = error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "unknown";
      return `- ${path}: ${issue.message}`;
    })
    .join("\n");

  return `Invalid ${scope} environment configuration:\n${details}`;
}

export function loadRuntimeEnv(rawEnv: EnvSource = process.env): RuntimeEnv {
  const result = publicEnvSchema.safeParse(rawEnv);

  if (!result.success) {
    throw new AppError(formatEnvErrors("public", result.error), "CONFIG_ERROR", {
      cause: result.error,
    });
  }

  const {
    NODE_ENV,
    NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_DEFAULT_CITY,
    NEXT_PUBLIC_ENABLE_ADMIN,
    NEXT_PUBLIC_ENABLE_AUTH,
    NEXT_PUBLIC_GTM_ID,
  } = result.data;

  return {
    nodeEnv: NODE_ENV,
    appUrl: NEXT_PUBLIC_APP_URL,
    defaultCity: NEXT_PUBLIC_DEFAULT_CITY,
    enableAdminPreview: NEXT_PUBLIC_ENABLE_ADMIN,
    enableAuthPreview: NEXT_PUBLIC_ENABLE_AUTH,
    gtmId: NEXT_PUBLIC_GTM_ID,
  };
}

export function loadServerEnv(rawEnv: EnvSource = process.env): ServerEnvValues {
  const result = serverEnvSchema.safeParse(rawEnv);

  if (!result.success) {
    throw new AppError(formatEnvErrors("server", result.error), "CONFIG_ERROR", {
      cause: result.error,
    });
  }

  return result.data;
}

export function getRequiredServerEnv(name: ServerEnvName, rawEnv: EnvSource = process.env) {
  const serverEnv = loadServerEnv(rawEnv);
  const value = serverEnv[name];

  if (!value) {
    throw new AppError(
      `Missing required environment variable: ${name}. Add it to \`.env.local\` for local development or to your deployment secrets before enabling the related server integration.`,
      "CONFIG_ERROR",
    );
  }

  return value;
}

export const env = loadRuntimeEnv();
