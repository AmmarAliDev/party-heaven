import Link from "next/link";
import { AlertTriangle, ClipboardList, DollarSign, History, LayoutTemplate, PackageOpen } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionErrorState } from "@/components/ui/section-error-state";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import {
  AdminPageHeader,
  AdminTablePattern,
} from "@/features/admin/components/admin-page-patterns";
import { getAdminDashboardMetrics } from "@/features/admin/dashboard";
import { formatPrice } from "@/lib/currency";
import type { AppError } from "@/lib/errors/app-error";
import { toUserMessage } from "@/lib/errors/error-messages";

export const metadata = buildMetadata({
  title: "Admin Dashboard",
  path: "/admin",
  description: "Simple operations dashboard with live metrics for pending orders, recognized revenue, low stock, and activity.",
});

type DashboardCard = {
  title: string;
  value: string;
  description: string;
  icon: typeof ClipboardList;
  href: string;
};

function formatActivityTimestamp(date: Date) {
  return date.toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function buildFallbackCards(errorMessage: string): DashboardCard[] {
  return [
    {
      title: "Orders",
      value: "Unavailable",
      description: errorMessage,
      icon: ClipboardList,
      href: routes.admin.orders,
    },
    {
      title: "Revenue",
      value: "Unavailable",
      description: "Revenue summary is temporarily unavailable.",
      icon: DollarSign,
      href: routes.admin.revenue,
    },
    {
      title: "Low Stock",
      value: "Unavailable",
      description: "Inventory alert counts are temporarily unavailable.",
      icon: AlertTriangle,
      href: routes.admin.inventory,
    },
    {
      title: "Homepage content",
      value: "CMS-ready",
      description: "Manage sections, banners, and campaign visibility without code changes.",
      icon: LayoutTemplate,
      href: routes.admin.homepage,
    },
    {
      title: "Recent Activity",
      value: "Unavailable",
      description: "Activity preview could not be loaded.",
      icon: History,
      href: routes.admin.activity,
    },
  ];
}

function buildMetricCards(input: {
  pendingOrdersCount: number;
  lowStockItemCount: number;
  recognizedRevenueTotal: number;
  recentActivityCount: number;
}): DashboardCard[] {
  return [
    {
      title: "Orders",
      value: `${input.pendingOrdersCount} pending`,
      description: "New and active orders waiting for your review.",
      icon: ClipboardList,
      href: routes.admin.orders,
    },
    {
      title: "Revenue",
      value: formatPrice(input.recognizedRevenueTotal),
      description: "Recognized from delivered orders, excluding completed refunds.",
      icon: DollarSign,
      href: routes.admin.revenue,
    },
    {
      title: "Low Stock",
      value: `${input.lowStockItemCount} items`,
      description: "Items at or below safety stock based on current on-hand quantity.",
      icon: AlertTriangle,
      href: routes.admin.inventory,
    },
    {
      title: "Homepage content",
      value: "CMS-ready",
      description: "Manage sections, banners, and campaign visibility without code changes.",
      icon: LayoutTemplate,
      href: routes.admin.homepage,
    },
    {
      title: "Recent Activity",
      value: input.recentActivityCount > 0 ? `${input.recentActivityCount} events` : "No new events",
      description: "Recent changes and staff actions appear in one simple feed.",
      icon: History,
      href: routes.admin.activity,
    },
  ];
}

export default async function AdminPage() {
  let cards: DashboardCard[];
  let activityItems: Array<{ id: string; title: string; summary: string; createdAt: Date }> = [];
  let activityError: string | null = null;

  try {
    const metrics = await getAdminDashboardMetrics();
    cards = buildMetricCards({
      pendingOrdersCount: metrics.pendingOrdersCount,
      lowStockItemCount: metrics.lowStockItemCount,
      recognizedRevenueTotal: metrics.revenue.recognizedTotal,
      recentActivityCount: metrics.recentActivity.length,
    });
    activityItems = metrics.recentActivity;
  } catch (error) {
    activityError = toUserMessage(error as AppError);
    cards = buildFallbackCards(activityError);
  }

  return (
    <PageShell className="gap-8">
      <AdminPageHeader
        eyebrow="Admin dashboard"
        title="Store operations at a glance"
        description="Use this simple panel to review daily workload, content controls, delivered-order revenue, inventory health, and recent activity in one place."
        actions={
          <Link href={routes.admin.homepage} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Open homepage controls
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardDescription>{card.title}</CardDescription>
                <card.icon className="text-muted-foreground size-4" />
              </div>
              <CardTitle>{card.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">{card.description}</p>
              <Link
                href={card.href}
                className="text-primary mt-3 inline-flex text-sm font-medium hover:underline"
              >
                View details
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PackageOpen className="size-4" />
                Orders table pattern
              </CardTitle>
              <CardDescription>Consistent table placeholder pattern for order and inventory pages.</CardDescription>
            </CardHeader>
            <CardContent>
              <AdminTablePattern
                state="empty"
                emptyTitle="No orders in queue"
                emptyDescription="New orders will appear here when customers complete checkout."
                errorDescription="Order records could not be loaded right now."
              />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="size-4" />
                Recent activity preview
              </CardTitle>
              <CardDescription>Latest team and system updates from the audit trail.</CardDescription>
            </CardHeader>
            <CardContent>
              {activityError ? (
                <SectionErrorState
                  title="Could not load activity preview"
                  description={activityError}
                />
              ) : activityItems.length === 0 ? (
                <EmptyState
                  title="No recent activity"
                  description="Staff and system events will appear here once actions are recorded."
                />
              ) : (
                <ul className="space-y-3">
                  {activityItems.map((item) => (
                    <li key={item.id} className="border-border rounded-md border p-3">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-muted-foreground mt-1 text-sm">{item.summary}</p>
                      <p className="text-muted-foreground mt-1 text-xs">{formatActivityTimestamp(item.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}

              <Link
                href={routes.admin.activity}
                className="text-primary mt-3 inline-flex text-sm font-medium hover:underline"
              >
                Open activity page
              </Link>
            </CardContent>
          </Card>
        </section>
      </div>
    </PageShell>
  );
}
