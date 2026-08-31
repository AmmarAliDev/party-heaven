/**
 * Client-safe runtime environment access.
 *
 * Contains ONLY `NEXT_PUBLIC_*` values, which Next.js statically inlines into
 * client bundles at build time.
 *
 * This module deliberately avoids zod (unlike `@/config/env`): importing zod
 * from a client component pulls the whole zod library into the client bundle,
 * and zod 4's internal `Function("")` CSP probe triggers a harmless-but-noisy
 * `Content-Security-Policy` violation in the production `Issues` panel (and
 * Lighthouse's Best Practices audit). Keeping this module zod-free removes a
 * large dependency from the initial client bundle on every page.
 *
 * Use this module in `'use client'` components; keep `@/config/env` for
 * server-only code that needs validated/secret configuration.
 */
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
  defaultCity: process.env.NEXT_PUBLIC_DEFAULT_CITY?.trim() || "Karachi",
  enableAdmin: process.env.NEXT_PUBLIC_ENABLE_ADMIN !== "false",
  enableAuth: process.env.NEXT_PUBLIC_ENABLE_AUTH !== "false",
  gaId: process.env.NEXT_PUBLIC_GA_ID?.trim() || undefined,
  gtmId: process.env.NEXT_PUBLIC_GTM_ID?.trim() || undefined,
  metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || undefined,
} as const;
