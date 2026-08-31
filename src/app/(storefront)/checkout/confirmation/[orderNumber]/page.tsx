import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, PackageCheck, ShoppingBag } from "lucide-react";

import { auth } from "@/auth";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceDisplay } from "@/components/ui/price-display";
import { SectionHeader } from "@/components/ui/section-header";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { PurchaseTracker } from "@/features/analytics/components/purchase-tracker";
import {
  buildOrderInvoiceUrl,
  formatOrderStatusLabel,
  getOrderDetailsForAccess,
  getOrderStatusVariant,
} from "@/features/orders";
import { testIds } from "@/lib/test-selectors";

type OrderConfirmationPageProps = {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: OrderConfirmationPageProps): Promise<Metadata> {
  const { orderNumber } = await params;

  return buildMetadata({
    title: `Order ${orderNumber}`,
    path: routes.storefront.checkoutConfirmation(orderNumber),
    description: "Review your placed order, delivery details, and invoice.",
    noIndex: true,
  });
}

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: OrderConfirmationPageProps) {
  const [{ orderNumber }, rawSearchParams, session] = await Promise.all([
    params,
    searchParams,
    auth(),
  ]);
  const token = typeof rawSearchParams.token === "string" ? rawSearchParams.token : undefined;
  const order = await getOrderDetailsForAccess({
    orderNumber,
    ...(session?.user?.id ? { userId: session.user.id } : {}),
    ...(token ? { accessToken: token } : {}),
  });

  if (!order) {
    notFound();
  }

  const invoiceUrl = buildOrderInvoiceUrl(
    order.orderNumber,
    token ?? order.confirmationAccessToken,
  );

  return (
    <PageShell className="gap-8" data-testid={testIds.storefront.checkoutConfirmation}>
      <PurchaseTracker
        transactionId={order.orderNumber}
        items={order.items.map((item) => ({
          id: item.sku ?? item.productName,
          name: item.productName,
          price: item.unitPrice,
          quantity: item.quantity,
        }))}
        value={order.total}
        currency="PKR"
        tax={0}
        shipping={order.shipping}
      />
      <SectionHeader
        eyebrow="Order confirmed"
        title={`Order ${order.orderNumber}`}
        description="Your order has been placed successfully. Keep this page for delivery tracking and invoice download."
        actions={
          <>
            <Link href={invoiceUrl} className={buttonVariants({ variant: "outline" })}>
              <Download className="h-4 w-4" />
              Download invoice
            </Link>
            <Link href={routes.storefront.categories} className={buttonVariants()}>
              <ShoppingBag className="h-4 w-4" />
              Continue shopping
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PackageCheck className="h-5 w-5" />
                  Order summary
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  Placed{" "}
                  {order.placedAt.toLocaleString("en-PK", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <Badge variant={getOrderStatusVariant(order.status)}>
                {formatOrderStatusLabel(order.status)}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="border-border/60 flex items-start justify-between gap-4 border-b pb-4 last:border-b-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-muted-foreground text-sm">
                      {item.variantTitle ? `${item.variantTitle} · ` : ""}Qty {item.quantity}
                    </p>
                    <p className="text-muted-foreground text-xs">SKU: {item.sku ?? "N/A"}</p>
                  </div>
                  <PriceDisplay amount={item.subtotal} size="sm" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Delivery address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{order.shippingAddress.fullName}</p>
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
              {order.shippingAddress.phone ? <p>Phone: {order.shippingAddress.phone}</p> : null}
              {order.shippingAddress.email ? <p>Email: {order.shippingAddress.email}</p> : null}
              {order.shippingAddress.notes ? <p>Notes: {order.shippingAddress.notes}</p> : null}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Payment and totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Invoice</span>
              <span className="font-medium">{order.invoiceNumber}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Payment method</span>
              <span className="font-medium">{order.paymentMethodLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Payment status</span>
              <span className="font-medium capitalize">{order.paymentStatus ?? "pending"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Subtotal</span>
              <PriceDisplay amount={order.subtotal} size="sm" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Shipping</span>
              <PriceDisplay amount={order.shipping} size="sm" />
            </div>
            <div className="border-border/60 flex items-center justify-between gap-3 border-t pt-3 font-semibold">
              <span>Total</span>
              <PriceDisplay amount={order.total} size="sm" />
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
