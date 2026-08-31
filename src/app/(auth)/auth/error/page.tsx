import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import type { SearchParams } from "@/types/app";

export const metadata = buildMetadata({
  title: "Authentication Error",
  path: "/auth/error",
  description: "An error occurred during sign in.",
  noIndex: true,
});

/**
 * Auth error messages keyed by Auth.js `error` query param.
 * Reference: https://authjs.dev/reference/core/errors
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  Configuration: "There is a problem with the server configuration. Please try again later.",
  AccessDenied: "You do not have permission to sign in.",
  Verification:
    "The verification link has expired or has already been used. Please request a new one.",
  OAuthSignin: "An error occurred while signing in with your social account. Please try again.",
  OAuthCallback:
    "An error occurred while processing your social sign-in. Please try again.",
  OAuthCreateAccount:
    "We could not create an account using your social profile. Try a different sign-in method.",
  EmailCreateAccount: "We could not create an account with this email. Please try again.",
  Callback: "An unexpected error occurred. Please try again.",
  Default: "An unexpected sign-in error occurred. Please try again.",
};

function getErrorMessage(error: string | undefined): string {
  if (!error) return AUTH_ERROR_MESSAGES["Default"] ?? "";
  return AUTH_ERROR_MESSAGES[error] ?? AUTH_ERROR_MESSAGES["Default"] ?? "";
}

interface AuthErrorPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const params = await searchParams;
  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const message = getErrorMessage(errorKey);

  return (
    <Card className="w-full max-w-sm text-center">
      <CardHeader>
        <CardTitle className="text-2xl text-destructive">Sign-in error</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <Link href={routes.auth.signIn} className={buttonVariants()}>
          Try again
        </Link>
        <Link href={routes.storefront.home} className={buttonVariants({ variant: "ghost" })}>
          Back to home
        </Link>
      </CardContent>
    </Card>
  );
}
