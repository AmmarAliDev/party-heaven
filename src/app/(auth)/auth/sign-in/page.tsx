import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import {
  getAuthenticatedUserAuthPageRedirect,
} from "@/features/auth/auth-page-redirect";
import { GoogleSignInButton } from "@/features/auth/components/google-sign-in-button";
import { SignInForm } from "@/features/auth/components/sign-in-form";

export const metadata = buildMetadata({
  title: "Sign In",
  path: "/auth/sign-in",
  description: "Sign in to your Party Heaven account.",
});

type SignInPageProps = {
  searchParams?: Promise<{
    from?: string;
  }>;
};

function isSafeRelativePath(value: string) {
  const candidate = value.trim();

  if (!candidate.startsWith("/")) {
    return false;
  }

  if (candidate.startsWith("//") || candidate.includes("://") || candidate.includes("\\")) {
    return false;
  }

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(candidate.slice(1)) || /[\r\n]/.test(candidate)) {
    return false;
  }

  return true;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const [session, resolvedSearchParams] = await Promise.all([auth(), searchParams]);
  const authenticatedRedirectPath = getAuthenticatedUserAuthPageRedirect(routes.auth.signIn, session?.user?.id);

  if (authenticatedRedirectPath) {
    redirect(authenticatedRedirectPath);
  }

  const redirectTo = isSafeRelativePath(`${resolvedSearchParams?.from ?? ""}`)
    ? `${resolvedSearchParams?.from}`.trim()
    : routes.storefront.home;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Sign in</CardTitle>
        <CardDescription>Welcome back — enter your details to continue.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Credentials form */}
        <SignInForm redirectTo={redirectTo} />

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Google SSO */}
        <GoogleSignInButton />

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href={routes.auth.signUp}
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
