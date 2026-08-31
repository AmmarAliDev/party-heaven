import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata = buildMetadata({
  title: "Reset Password",
  path: "/auth/reset-password",
  description: "Set a new password for your Party Heaven account.",
  noIndex: true,
});

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    token?: string;
  }>;
};

function normalizeToken(raw: string | undefined) {
  return (raw ?? "").trim();
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const resolvedSearchParams = await searchParams;
  const token = normalizeToken(resolvedSearchParams?.token);

  if (!token) {
    return (
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Reset link required</CardTitle>
          <CardDescription>
            This page needs a valid password reset link. Request a new email to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Link href={routes.auth.forgotPassword} className={buttonVariants()}>
            Request new reset link
          </Link>
          <Link href={routes.auth.signIn} className={buttonVariants({ variant: "outline" })}>
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Reset your password</CardTitle>
        <CardDescription>Enter a new password for your account.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <ResetPasswordForm token={token} />
      </CardContent>
    </Card>
  );
}
