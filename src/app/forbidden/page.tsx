import Link from "next/link";
import { ShieldX } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";

export const metadata = buildMetadata({
  title: "Forbidden",
  path: "/forbidden",
  description: "Access is blocked when the signed-in role lacks admin permissions.",
  noIndex: true,
});

export default function ForbiddenPage() {
  return (
    <PageShell className="items-center justify-center">
      <EmptyState
        align="center"
        className="w-full max-w-2xl"
        icon={ShieldX}
        eyebrow="403"
        title="Access restricted"
        description="Your account is signed in, but it does not currently have the required permission for this admin area. Contact a super admin if you need access."
        action={
          <>
            <Link href={routes.storefront.home} className={buttonVariants()}>
              Go back home
            </Link>
            <Link href={routes.auth.signIn} className={buttonVariants({ variant: "outline" })}>
              Switch account
            </Link>
          </>
        }
      />
    </PageShell>
  );
}
