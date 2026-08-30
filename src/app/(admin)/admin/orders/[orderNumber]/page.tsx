import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Download,
  FileText,
  History,
  MapPin,
  MessageSquare,
  PackageCheck,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceDisplay } from "@/components/ui/price-display";
import { Textarea } from "@/components/ui/textarea";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { AdminPageHeader } from "@/features/admin/components/admin-page-patterns";
import {
  getAdminOrderByNumber,
  getAdminOrderErrorMessage,
  getAdminOrderNoticeMessage,
} from "@/features/admin/orders";
import {
  updateAdminOrderInternalNoteAction,
  updateAdminOrderStatusAction,
} from "@/features/admin/orders/actions";
import { AdminOrderSubmitButton } from "@/features/admin/orders/components/admin-order-submit-button";
import { buildOrderInvoiceUrl, getOrderStatusVariant } from "@/features/orders";
import { requireRouteAccess } from "@/lib/auth/guards";
import { hasPermission, rbacPermissions } from "@/lib/auth/rbac";
import { testIds } from "@/lib/test-selectors";

type AdminOrderDetailPageProps = {
  params: Promise<{ orderNumber: string }>;
  searchParams?: Promise<{
    notice?: string;
    error?: string;
  }>;
};

export async function generateMetadata({ params }: AdminOrderDetailPageProps): Promise<Metadata> {
  const { orderNumber } = await params;

  return buildMetadata({
    title: `Admin Order ${orderNumber}`,
    path: routes.admin.orderDetail(orderNumber),
    description:
      "Review customer details, fulfillment progress, invoice access, and audit history.",
  });
}

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: AdminOrderDetailPageProps) {
  const [{ orderNumber }, query, access] = await Promise.all([
    params,
    searchParams,
    requireRouteAccess({
      permissions: [rbacPermissions.adminAccess, rbacPermissions.ordersRead],
      from: routes.admin.orders,
    }),
  ]);

  const order = await getAdminOrderByNumber(orderNumber);

  if (!order) {
    notFound();
  }

  const canManage = hasPermission(access.role, rbacPermissions.ordersWrite);
  const noticeMessage = getAdminOrderNoticeMessage(query?.notice);
  const errorMessage = getAdminOrderErrorMessage(query?.error);
  const returnTo = routes.admin.orderDetail(order.orderNumber);

  return (
    <PageShell className="gap-8">
      <AdminPageHeader
        eyebrow="Orders"
        title={`Order ${order.orderNumber}`}
        description="Give staff one clear place to review customer details, update fulfillment, and check history."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildOrderInvoiceUrl(order.orderNumber)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download className="size-4" />
              Download invoice
            </Link>
            <Link
              href={routes.admin.orders}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <ArrowLeft className="size-4" />
              Back to orders
            </Link>
          </div>
        }
      />

      {noticeMessage ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900">
          {noticeMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-4 py-3 text-sm">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PackageCheck className="size-5" />
                  Order overview
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  Placed{" "}
                  {order.placedAt.toLocaleString("en-PK", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <Badge variant={getOrderStatusVariant(order.status)}>{order.statusLabel}</Badge>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">Customer</p>
                <p className="mt-1 font-medium">{order.customerName}</p>
                <p className="text-muted-foreground text-xs">{order.customerEmail ?? "No email"}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">Contact</p>
                <p className="mt-1 font-medium">{order.customerPhone ?? "Not provided"}</p>
                <p className="text-muted-foreground text-xs">Invoice {order.invoiceNumber}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">Items</p>
                <p className="mt-1 font-medium">
                  {order.itemCount} line{order.itemCount === 1 ? "" : "s"}
                </p>
                <p className="text-muted-foreground text-xs">{order.paymentMethodLabel}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">Order total</p>
                <div className="mt-1 font-medium">
                  <PriceDisplay amount={order.total} size="sm" />
                </div>
                <p className="text-muted-foreground text-xs">Payment {order.paymentStatus}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-5" />
                Items and totals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-auto rounded-md border">
                <table className="divide-muted-foreground/20 min-w-full divide-y text-sm">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium">Item</th>
                      <th className="px-4 py-3 font-medium">SKU</th>
                      <th className="px-4 py-3 font-medium">Qty</th>
                      <th className="px-4 py-3 font-medium">Unit price</th>
                      <th className="px-4 py-3 font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-muted-foreground/10 divide-y">
                    {order.items.map((item) => (
                      <tr key={item.id} className="align-top">
                        <td className="px-4 py-3">
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-muted-foreground mt-1 text-xs">
                            {item.variantTitle ?? "Standard item"}
                          </p>
                        </td>
                        <td className="text-muted-foreground px-4 py-3 text-xs">
                          {item.sku ?? "N/A"}
                        </td>
                        <td className="px-4 py-3">{item.quantity}</td>
                        <td className="px-4 py-3">
                          <PriceDisplay amount={item.unitPrice} size="sm" />
                        </td>
                        <td className="px-4 py-3">
                          <PriceDisplay amount={item.subtotal} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border p-3 text-sm">
                  <p className="text-muted-foreground">Customer note</p>
                  <p className="mt-1">
                    {order.customerNote ?? "No delivery note left by the customer."}
                  </p>
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Subtotal</span>
                    <PriceDisplay amount={order.subtotal} size="sm" />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Shipping</span>
                    <PriceDisplay amount={order.shipping} size="sm" />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Tax</span>
                    <PriceDisplay amount={order.tax} size="sm" />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Discount</span>
                    <PriceDisplay amount={order.discount} size="sm" />
                  </div>
                  <div className="border-border/60 mt-3 flex items-center justify-between gap-3 border-t pt-3 font-semibold">
                    <span>Total</span>
                    <PriceDisplay amount={order.total} size="sm" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserRound className="size-5" />
                  Customer and delivery
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium">{order.customerName}</p>
                {order.customerEmail ? <p>{order.customerEmail}</p> : null}
                {order.customerPhone ? <p>{order.customerPhone}</p> : null}
                <div className="border-border/60 mt-3 border-t pt-3">
                  <p>{order.shippingAddress.street1}</p>
                  {order.shippingAddress.street2 ? <p>{order.shippingAddress.street2}</p> : null}
                  <p>
                    {order.shippingAddress.city}
                    {order.shippingAddress.province ? `, ${order.shippingAddress.province}` : ""}
                  </p>
                  <p>
                    {order.shippingAddress.country}
                    {order.shippingAddress.postcode ? `, ${order.shippingAddress.postcode}` : ""}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="size-5" />
                  Audit history
                </CardTitle>
              </CardHeader>
              <CardContent>
                {order.history.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No order history has been recorded yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {order.history.map((entry) => (
                      <div key={entry.id} className="rounded-md border p-3 text-sm">
                        <p className="font-medium">{entry.summary}</p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {entry.createdAt.toLocaleString("en-PK", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                          {entry.actorId ? ` · Staff ${entry.actorId}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-5" />
                Fulfillment status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">Current status</p>
                <div className="mt-2">
                  <Badge variant={getOrderStatusVariant(order.status)}>{order.statusLabel}</Badge>
                </div>
              </div>

              {canManage ? (
                order.nextStatuses.length > 0 ? (
                  <form
                    action={updateAdminOrderStatusAction}
                    className="space-y-3"
                    data-testid={testIds.admin.orderStatusForm}
                  >
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="orderNumber" value={order.orderNumber} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <label htmlFor="nextStatus" className="text-sm font-medium">
                      Next status
                    </label>
                    <select
                      id="nextStatus"
                      name="nextStatus"
                      defaultValue={order.nextStatuses[0]}
                      className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-[calc(var(--radius)-2px)] border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      data-testid={testIds.admin.orderStatusSelect}
                    >
                      {order.nextStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status.charAt(0) + status.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                    <p className="text-muted-foreground text-xs">
                      Staff can move this order only through the approved fulfillment steps.
                    </p>
                    <AdminOrderSubmitButton
                      label="Update status"
                      pendingLabel="Updating status..."
                      className="w-full"
                      data-testid={testIds.admin.orderStatusSubmit}
                    />
                  </form>
                ) : (
                  <p className="text-muted-foreground">
                    This order is already in a final state and cannot be changed further.
                  </p>
                )
              ) : (
                <p className="text-muted-foreground">Your role has read-only order access.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="size-5" />
                Internal notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Use this space for staff-only handling notes, courier context, or follow-up
                reminders.
              </p>
              {canManage ? (
                <form action={updateAdminOrderInternalNoteAction} className="space-y-3">
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="orderNumber" value={order.orderNumber} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <Textarea
                    id="note"
                    name="note"
                    rows={6}
                    defaultValue={order.internalNote ?? ""}
                    placeholder="Example: Customer requested afternoon delivery window."
                  />
                  <AdminOrderSubmitButton
                    label="Save internal note"
                    pendingLabel="Saving note..."
                    className="w-full"
                  />
                </form>
              ) : (
                <div className="rounded-md border p-3 text-sm">
                  {order.internalNote ?? "No internal note recorded."}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="size-5" />
                Payment snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Payment method</span>
                <span className="font-medium">{order.paymentMethodLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Payment status</span>
                <span className="font-medium">{order.paymentStatus}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Refund status</span>
                <span className="font-medium">{order.refundStatus}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
