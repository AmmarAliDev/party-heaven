import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { verifyEmailByToken } from "@/features/auth/email-verification";

export const metadata = buildMetadata({
  title: "Verify Email",
  path: "/auth/verify-email",
  description: "Verify your Party Heaven account email.",
});

type VerifyEmailPageProps = {
  searchParams?: Promise<{
    token?: string;
  }>;
};

function normalizeToken(raw: string | undefined) {
  return (raw ?? "").trim();
}

function renderMissingTokenState() {
  return (
    <Card className="w-full max-w-sm text-center">
      <CardHeader>
        <CardTitle className="text-2xl">Verification link required</CardTitle>
        <CardDescription>
          This page needs a valid verification link. Request a new sign-up or sign-in to get a fresh
          verification email.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Link href={routes.auth.signUp} className={buttonVariants()}>
          Create account
        </Link>
        <Link href={routes.auth.signIn} className={buttonVariants({ variant: "outline" })}>
          Back to sign in
        </Link>
      </CardContent>
    </Card>
  );
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const resolvedSearchParams = await searchParams;
  const token = normalizeToken(resolvedSearchParams?.token);

  if (!token) {
    return renderMissingTokenState();
  }

  const status = await verifyEmailByToken(token);

  if (status === "verified" || status === "already-verified") {
    return (
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Email verified</CardTitle>
          <CardDescription>
            Your account email is now verified. You can sign in with your credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Link href={routes.auth.signIn} className={buttonVariants()}>
            Continue to sign in
          </Link>
          <Link href={routes.storefront.home} className={buttonVariants({ variant: "outline" })}>
            Back to home
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm text-center">
      <CardHeader>
        <CardTitle className="text-2xl">Verification link invalid</CardTitle>
        <CardDescription>
          This verification link is invalid or expired. Sign in to request a fresh verification email.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Link href={routes.auth.signIn} className={buttonVariants()}>
          Back to sign in
        </Link>
        <Link href={routes.auth.signUp} className={buttonVariants({ variant: "outline" })}>
          Create account
        </Link>
      </CardContent>
    </Card>
  );
}
