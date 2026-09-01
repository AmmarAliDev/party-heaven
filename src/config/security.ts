type EnvSource = Readonly<Record<string, string | undefined>>;

type SecurityHeader = {
  key: string;
  value: string;
};

const LOCAL_DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"] as const;
// GTM is the single tracking pipeline: the loader lives on googletagmanager.com
// and the GTM container injects the Meta Pixel loader from connect.facebook.net.
const TRACKING_SCRIPT_SOURCES = [
  "https://www.googletagmanager.com",
  "https://connect.facebook.net",
] as const;
function normalizeOrigin(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}

function parseAllowedOrigins(rawValue: string | undefined): string[] {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value));
}

function buildDirective(name: string, values: Array<string | undefined | null>): string {
  const tokens = [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
  return `${name} ${tokens.join(" ")}`.trim();
}

function hasGoogleTaggingConfig(rawEnv: EnvSource): boolean {
  return Boolean(rawEnv.NEXT_PUBLIC_GTM_ID?.trim());
}

export function getTrustedOrigins(rawEnv: EnvSource = process.env): string[] {
  const trustedOrigins = new Set<string>();

  if (rawEnv.NODE_ENV !== "production") {
    for (const origin of LOCAL_DEV_ORIGINS) {
      trustedOrigins.add(origin);
    }
  }

  const appOrigin = normalizeOrigin(rawEnv.NEXT_PUBLIC_APP_URL);
  const authOrigin = normalizeOrigin(rawEnv.AUTH_URL);

  if (appOrigin) {
    trustedOrigins.add(appOrigin);
  }

  if (authOrigin) {
    trustedOrigins.add(authOrigin);
  }

  for (const origin of parseAllowedOrigins(rawEnv.APP_ALLOWED_ORIGINS)) {
    trustedOrigins.add(origin);
  }

  return [...trustedOrigins];
}

export function getServerActionAllowedOrigins(rawEnv: EnvSource = process.env): string[] {
  return getTrustedOrigins(rawEnv).map((origin) => new URL(origin).host);
}

export function buildContentSecurityPolicy(rawEnv: EnvSource = process.env): string {
  const isDevelopment = rawEnv.NODE_ENV !== "production";
  const trustedOrigins = getTrustedOrigins(rawEnv);
  const isGoogleTaggingEnabled = hasGoogleTaggingConfig(rawEnv);

  const directives = [
    "default-src 'self'",
    buildDirective("script-src", [
      "'self'",
      "'unsafe-inline'",
      // Allow the GTM loader + GTM-injected Meta Pixel loader when GTM is configured.
      ...(isGoogleTaggingEnabled ? TRACKING_SCRIPT_SOURCES : []),
      isDevelopment ? "'unsafe-eval'" : undefined,
    ]),
    buildDirective("style-src", ["'self'", "'unsafe-inline'"]),
    buildDirective("img-src", ["'self'", "data:", "blob:", "https:"]),
    buildDirective("font-src", ["'self'", "data:", "https:"]),
    buildDirective("connect-src", [
      "'self'",
      ...trustedOrigins,
      "https:",
      isDevelopment ? "ws:" : undefined,
    ]),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    !isDevelopment ? "upgrade-insecure-requests" : undefined,
  ];

  return directives.filter(Boolean).join("; ");
}

export function getSecurityHeaders(rawEnv: EnvSource = process.env): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(rawEnv),
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), browsing-topics=()",
    },
    {
      key: "X-DNS-Prefetch-Control",
      value: "off",
    },
    {
      key: "Cross-Origin-Opener-Policy",
      value: "same-origin",
    },
    {
      key: "Cross-Origin-Resource-Policy",
      value: "same-origin",
    },
    {
      key: "X-Permitted-Cross-Domain-Policies",
      value: "none",
    },
  ];

  if (rawEnv.NODE_ENV === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}
