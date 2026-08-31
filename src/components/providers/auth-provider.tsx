"use client";

/**
 * Auth session provider wrapper.
 *
 * Wraps `SessionProvider` from `next-auth/react` so Client Components
 * throughout the app can call `useSession()` without prop drilling.
 *
 * Added to the root layout.
 */

import { useEffect, useRef } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * Delay before re-checking the session after a failed initial fetch.
 * Gives the dev server time to finish compiling the auth route.
 */
const SESSION_SELF_HEAL_DELAY_MS = 1500;

/**
 * Dev-only self-heal for the auth session.
 *
 * On a fresh `next dev` (Turbopack) start, the first `/api/auth/session`
 * request can race the `[...nextauth]` route's initial compilation and
 * receive an HTML response instead of JSON. `next-auth/react` surfaces that
 * as a transient "unauthenticated" state and logs a `ClientFetchError`.
 *
 * Retrying once after a short delay lets the session settle to the real
 * server state. This never runs in production, where routes are precompiled
 * and the initial fetch always succeeds.
 */
function SessionSelfHeal() {
  const { status, update } = useSession();
  const hasAttemptedRef = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    if (status === "unauthenticated" && !hasAttemptedRef.current) {
      hasAttemptedRef.current = true;
      const timer = setTimeout(() => {
        void update();
      }, SESSION_SELF_HEAL_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [status, update]);

  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <SessionSelfHeal />
    </SessionProvider>
  );
}
