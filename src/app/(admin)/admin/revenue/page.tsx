import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMetadata } from "@/config/metadata";
import {
  AdminListPattern,
  AdminPageHeader,
} from "@/features/admin/components/admin-page-patterns";
import {
  type AdminRevenueReport,
  getAdminRevenueReport,
} from "@/features/admin/revenue";
import { formatPrice } from "@/lib/currency";
import type { AppError } from "@/lib/errors/app-error";
import { toUserMessage } from "@/lib/errors/error-messages";

export const metadata = buildMetadata({
  title: "Admin Revenue",
  path: "/admin/revenue",
  description: "Database-backed revenue reporting page with practical summaries for non-technical admins.",
});

function formatDateRange(startAt: Date, endAt: Date) {
  return `${startAt.toLocaleDateString("en-PK", { dateStyle: "medium" })} - ${endAt.toLocaleDateString("en-PK", { dateStyle: "medium" })}`;
}

export default async function AdminRevenuePage() {
  let report: AdminRevenueReport | null = null;
  let errorMessage: string | null = null;

  // Load data first; JSX is intentionally constructed after the try/catch so
  // render-time errors are handled by the app error boundary, not a local catch.
  try {
    report = await getAdminRevenueReport();
  } catch (error) {
    errorMessage = toUserMessage(error as AppError);
  }

  if (report === null) {
    return (
      <PageShell className="gap-8">
        <AdminPageHeader
          eyebrow="Revenue"
          title="Revenue reporting"
          description="Review recognized revenue, recent performance windows, and practical order totals from live order data."
        />

        <AdminListPattern
          state="error"
          emptyTitle="No order data yet"
          emptyDescription="Revenue reporting will appear automatically after the first orders are placed and processed."
          errorDescription={errorMessage ?? "We could not load revenue data right now."}
        />
      </PageShell>
    );
  }

  return (
    <PageShell className="gap-8">
      <AdminPageHeader
        eyebrow="Revenue"
        title="Revenue reporting"
        description="Review recognized revenue, recent performance windows, and practical order totals from live order data."
      />

      {report.isEmpty ? (
        <AdminListPattern
          state="empty"
          emptyTitle="No order data yet"
          emptyDescription="Revenue reporting will appear automatically after the first orders are placed and processed."
          errorDescription="We could not load revenue data right now."
        />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardDescription>Total recognized revenue</CardDescription>
                <CardTitle>{formatPrice(report.recognizedRevenue.total)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">Delivered orders that are not marked as completed refunds.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Included delivered orders</CardDescription>
                <CardTitle>{report.recognizedRevenue.orderCount.toLocaleString("en-PK")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">Orders included in recognized revenue calculations.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Average order value</CardDescription>
                <CardTitle>{formatPrice(report.recognizedRevenue.averageOrderValue)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">Based on recognized delivered orders only.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Refunded delivered orders excluded</CardDescription>
                <CardTitle>{report.refundedDeliveredOrdersExcluded.toLocaleString("en-PK")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">Delivered orders removed from revenue because refunds are completed.</p>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            {report.periods.map((period) => (
              <Card key={period.key}>
                <CardHeader>
                  <CardDescription>{period.label}</CardDescription>
                  <CardTitle>{formatPrice(period.total)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-muted-foreground text-sm">{formatDateRange(period.startAt, period.endAt)}</p>
                  <p className="text-sm">
                    {period.orderCount.toLocaleString("en-PK")} delivered orders included
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Average order value: {formatPrice(period.averageOrderValue)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order totals summary</CardTitle>
                <CardDescription>Simple operational counts to support daily admin decisions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Total orders: {report.orderTotals.totalOrders.toLocaleString("en-PK")}</p>
                <p>Delivered orders: {report.orderTotals.deliveredOrders.toLocaleString("en-PK")}</p>
                <p>Pending orders: {report.orderTotals.pendingOrders.toLocaleString("en-PK")}</p>
                <p>Cancelled orders: {report.orderTotals.cancelledOrders.toLocaleString("en-PK")}</p>
                <p>Gross order value: {formatPrice(report.orderTotals.grossOrderValue)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue inclusion rules</CardTitle>
                <CardDescription>These assumptions define what appears as recognized revenue.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-2 pl-5 text-sm">
                  {report.assumptions.map((assumption) => (
                    <li key={assumption}>{assumption}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </PageShell>
  );
}
