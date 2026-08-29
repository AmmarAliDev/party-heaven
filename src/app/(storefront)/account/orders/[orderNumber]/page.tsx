import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, PackageCheck } from "lucide-react";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceDisplay } from "@/components/ui/price-display";
import { SectionHeader } from "@/components/ui/section-header";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import {
  buildOrderInvoiceUrl,
  formatOrderStatusLabel,
  getOrderDetailsForUser,
  getOrderStatusVariant,
} from "@/features/orders";
import { ReorderOrderForm } from "@/features/orders/components/reorder-order-form";
import { getDisplayVariantLabel } from "@/lib/variant-label";

type AccountOrderDetailPageProps = {
  params: Promise<{ orderNumber: string }>;
};

export async function generateMetadata({ params }: AccountOrderDetailPageProps): Promise<Metadata> {
  const { orderNumber } = await params;

  return buildMetadata({
    title: `Order ${orderNumber}`,
    path: routes.storefront.accountOrderDetail(orderNumber),
    description: "Review order items, delivery details, and invoice download.",
  });
}

export default async function AccountOrderDetailPage({ params }: AccountOrderDetailPageProps) {
  const [{ orderNumber }, session] = await Promise.all([params, auth()]);
  const userId = session?.user?.id;

  if (!userId) {
    notFound();
  }

  const order = await getOrderDetailsForUser({ userId, orderNumber });

  if (!order) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Order detail"
        title={`Order ${order.orderNumber}`}
        description="Track status, download your invoice, and re-order previously purchased items."
        actions={
          <>
            <Link href={buildOrderInvoiceUrl(order.orderNumber)} className={buttonVariants({ variant: "outline" })}>
              <Download className="h-4 w-4" />
              Download invoice
            </Link>
            <Link href={routes.storefront.accountOrders} className={buttonVariants({ variant: "ghost" })}>
              Back to orders
            </Link>
          </>
        }
      />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageCheck className="h-5 w-5" />
              Order summary
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Placed {order.placedAt.toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
          <Badge variant={getOrderStatusVariant(order.status)}>{formatOrderStatusLabel(order.status)}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {order.items.map((item) => {
            const variantLabel = getDisplayVariantLabel(item.variantTitle);

            return (
              <div key={item.id} className="flex items-start justify-between gap-4 border-b border-border/60 pb-4 last:border-b-0 last:pb-0">
                <div className="space-y-1">
                  <p className="font-medium">{item.productName}</p>
                  <p className="text-muted-foreground text-sm">
                    {variantLabel ? `${variantLabel} · ` : ""}Qty {item.quantity}
                  </p>
                  <p className="text-muted-foreground text-xs">SKU: {item.sku ?? "N/A"}</p>
                </div>
                <PriceDisplay amount={item.subtotal} size="sm" />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
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
            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3 font-semibold">
              <span>Total</span>
              <PriceDisplay amount={order.total} size="sm" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Need these items again?</CardTitle>
        </CardHeader>
        <CardContent>
          <ReorderOrderForm orderNumber={order.orderNumber} />
        </CardContent>
      </Card>
    </div>
  );
}
