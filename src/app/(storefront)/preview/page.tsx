import Link from "next/link";
import { notFound } from "next/navigation";
import { Palette } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { PreviewToastButton } from "@/components/layout/preview-toast-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { PriceDisplay } from "@/components/ui/price-display";
import { SectionErrorState } from "@/components/ui/section-error-state";
import { SectionHeader } from "@/components/ui/section-header";
import { PageSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { env } from "@/config/env";
import { buildMetadata } from "@/config/metadata";
import { shouldRenderGuardedSurface } from "@/config/production-visibility";
import { routes } from "@/config/routes";

export const metadata = buildMetadata({
  title: "Storefront Preview",
  path: "/preview",
  description: "Customer-facing placeholder shell for the Karachi-first storefront architecture.",
  noIndex: true,
});

export default function StorefrontPreviewPage() {
  if (!shouldRenderGuardedSurface("storefrontPreviewRoute")) {
    notFound();
  }

  return (
    <PageShell className="gap-8">
      <SectionHeader
        eyebrow="Storefront preview"
        title="Shared storefront shell is ready for the next commerce steps."
        description="Theme support, responsive spacing, reusable state components, and frontend feedback are now available for future catalog and checkout work."
        actions={<PreviewToastButton />}
      />

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <Badge variant="secondary" className="w-fit">
              Foundation defaults
            </Badge>
            <CardTitle>Preview values are centralized and easy to extend.</CardTitle>
            <CardDescription>
              Later prompts can keep using the same tokens and route structure without reworking the
              base shell.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">App URL: {env.appUrl}</p>
            <p className="text-muted-foreground">Launch city: {env.defaultCity}</p>
            <div className="rounded-[var(--radius)] border border-border/70 bg-muted/35 p-4">
              <p className="text-muted-foreground text-sm">Sample product price treatment</p>
              <PriceDisplay amount={1299} compareAt={1499} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div>
            <p className="mb-3 text-sm font-medium">Skeleton preview</p>
            <PageSkeleton />
          </div>

          <Card>
            <CardHeader>
              <Badge variant="secondary" className="w-fit">
                Reliable UX defaults
              </Badge>
              <CardTitle>Errors, forms, and confirmations now share one pattern.</CardTitle>
              <CardDescription>
                These primitives keep raw internal details out of the UI while staying easy to reuse.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <InlineSpinner label="Preparing a safe preview state" />
              <FormErrorSummary
                title="Sample validation summary"
                errors={["Email is required", "Password must be at least 8 characters"]}
              />
              <SectionErrorState
                title="Section fallback preview"
                description="Feature modules can now fail gracefully without collapsing the rest of the page."
              />
              <ConfirmationDialog
                triggerLabel="Preview confirmation"
                title="Discard draft changes?"
                description="Use this shared dialog for destructive or high-impact actions across admin and storefront flows."
                confirmLabel="Discard draft"
                confirmVariant="destructive"
              >
                <p className="text-muted-foreground">
                  This keeps confirmations consistent for future product, cart, and order actions.
                </p>
              </ConfirmationDialog>
            </CardContent>
          </Card>

          <div>
            <p className="mb-3 text-sm font-medium">Table loading preview</p>
            <TableSkeleton rows={3} columns={4} />
          </div>
        </div>
      </div>

      <EmptyState
        icon={Palette}
        title="Business modules are still intentionally deferred"
        description="Product catalog pages, cart, checkout, and customer account flows will be added later on top of this visual foundation."
        action={
          <Link href={routes.storefront.home} className={buttonVariants({ variant: "outline" })}>
            Back to foundation overview
          </Link>
        }
      />
    </PageShell>
  );
}
