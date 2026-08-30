"use client";

/**
 * Auth session provider wrapper.
 *
 * Wraps `SessionProvider` from `next-auth/react` so Client Components
 * throughout the app can call `useSession()` without prop drilling.
 *
 * Added to the root layout.
 */

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
