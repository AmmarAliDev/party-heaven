import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata = buildMetadata({
  title: "Forgot Password",
  path: "/auth/forgot-password",
  description: "Request a password reset link for your Party Heaven account.",
});

export default function ForgotPasswordPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Forgot password?</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send a reset link if an account exists.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <ForgotPasswordForm />

        <Link href={routes.auth.signIn} className={buttonVariants({ variant: "outline" })}>
          Back to sign in
        </Link>
      </CardContent>
    </Card>
  );
}
