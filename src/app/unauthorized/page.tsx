import Link from "next/link";
import { LockKeyhole } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";

export const metadata = buildMetadata({
  title: "Unauthorized",
  path: "/unauthorized",
  description: "Sign in is required before accessing protected admin routes.",
  noIndex: true,
});

export default function UnauthorizedPage() {
  return (
    <PageShell className="items-center justify-center">
      <EmptyState
        align="center"
        className="w-full max-w-2xl"
        icon={LockKeyhole}
        eyebrow="Authentication required"
        title="Please sign in to continue"
        description="This area is reserved for authenticated staff accounts. Sign in with an approved admin role to continue safely."
        action={
          <>
            <Link href={routes.auth.signIn} className={buttonVariants()}>
              Sign in
            </Link>
            <Link href={routes.storefront.home} className={buttonVariants({ variant: "outline" })}>
              Go back home
            </Link>
          </>
        }
      />
    </PageShell>
  );
}
