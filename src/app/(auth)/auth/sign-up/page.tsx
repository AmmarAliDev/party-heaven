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
import { SignUpForm } from "@/features/auth/components/sign-up-form";

export const metadata = buildMetadata({
  title: "Create Account",
  path: "/auth/sign-up",
  description: "Create your Party Heaven account to start shopping.",
  noIndex: true,
});

export default async function SignUpPage() {
  const session = await auth();
  const authenticatedRedirectPath = getAuthenticatedUserAuthPageRedirect(routes.auth.signUp, session?.user?.id);

  if (authenticatedRedirectPath) {
    redirect(authenticatedRedirectPath);
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Create account</CardTitle>
        <CardDescription>
          Sign up to start shopping with Party Heaven. We&apos;ll ask you to verify your email.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Credentials sign-up form */}
        <SignUpForm />

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Google SSO (also creates account on first use) */}
        <GoogleSignInButton label="Sign up with Google" />

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href={routes.auth.signIn}
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
