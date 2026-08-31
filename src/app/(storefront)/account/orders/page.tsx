import Link from "next/link";
import { ExternalLink, PackageSearch } from "lucide-react";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PriceDisplay } from "@/components/ui/price-display";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import {
  buildOrderInvoiceUrl,
  formatOrderStatusLabel,
  getOrderHistoryForUser,
  getOrderStatusVariant,
} from "@/features/orders";
import { ReorderOrderForm } from "@/features/orders/components/reorder-order-form";

function formatOrderDate(date: Date | null | undefined): string {
  if (!date) {
    return "N/A";
  }
  return date.toLocaleDateString(siteConfig.locale);
}

export const metadata = buildMetadata({
  title: "Order History",
  path: routes.storefront.accountOrders,
  description: "Review your recent orders.",
  noIndex: true,
});

export default async function AccountOrdersPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="Order history unavailable"
        description="Please sign in again to load your order history."
      />
    );
  }

  const orders = await getOrderHistoryForUser(userId, 20);

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="No orders yet"
        description="Your order history will appear here after your first checkout."
      />
    );
  }

  return (
    <div className="grid gap-4">
      {orders.map((order) => (
        <Card key={order.id}>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">
                <Link
                  href={routes.storefront.accountOrderDetail(order.orderNumber)}
                  className="hover:text-foreground transition-colors"
                >
                  Order {order.orderNumber}
                </Link>
              </CardTitle>
              <Badge variant={getOrderStatusVariant(order.status)}>{formatOrderStatusLabel(order.status)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground">Placed {formatOrderDate(order.placedAt)}</p>
              <PriceDisplay amount={order.total} size="sm" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">{order.itemCount} item(s)</p>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={routes.storefront.accountOrderDetail(order.orderNumber)}
                  className="text-xs font-medium underline underline-offset-4"
                >
                  View details
                </Link>
                <Link
                  href={buildOrderInvoiceUrl(order.orderNumber)}
                  className="inline-flex items-center gap-1 text-xs font-medium underline underline-offset-4"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Invoice
                  <ExternalLink className="size-3" />
                </Link>              </div>
            </div>

            <ReorderOrderForm orderNumber={order.orderNumber} compact />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}