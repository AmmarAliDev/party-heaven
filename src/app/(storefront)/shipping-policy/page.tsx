import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { buildMetadata } from "@/config/metadata";

export const metadata = buildMetadata({
  title: "Shipping Policy",
  path: "/shipping-policy",
  description:
    "Find out how we ship your orders, estimated delivery timelines, charges, and what to do if something goes wrong.",
});

export default function ShippingPolicyPage() {
  return (
    <PageShell className="max-w-7xl gap-10">
      {/* Header */}
      <div className="space-y-3">
        <Badge variant="secondary">Policy</Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Shipping Policy</h1>
        <p className="text-muted-foreground text-sm">Last updated: April 2026</p>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          We want your order to reach you quickly and safely. Here&apos;s everything you need to
          know about how we handle shipping.
        </p>
      </div>

      <Separator />

      {/* Delivery Areas */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Delivery Areas</h2>
        <p className="text-muted-foreground leading-relaxed">
          We currently deliver within{" "}
          <strong className="text-foreground font-medium">Karachi</strong>, covering all major areas
          and neighbourhoods across the city. We are working to expand our delivery coverage to
          additional cities — check back for updates.
        </p>
      </section>

      {/* Processing Time */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Order Processing</h2>
        <p className="text-muted-foreground leading-relaxed">
          Orders are typically processed within{" "}
          <strong className="text-foreground font-medium">1 business day</strong> of being placed.
          Orders placed on weekends or public holidays are processed on the next business day. You
          will receive a confirmation once your order is dispatched.
        </p>
      </section>

      {/* Delivery Timeline */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Estimated Delivery Time</h2>
        <div className="text-muted-foreground space-y-2 leading-relaxed">
          <p>
            <strong className="text-foreground font-medium">Within Karachi:</strong> 1–3 business
            days from dispatch.
          </p>
          <p>
            Delivery estimates are not guaranteed and may vary during peak periods, public holidays,
            or due to circumstances beyond our control (such as weather or courier delays).
          </p>
        </div>
      </section>

      {/* Shipping Charges */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Shipping Charges</h2>
        <p className="text-muted-foreground leading-relaxed">
          A flat shipping fee applies to all orders. The exact charge is shown at checkout before
          you confirm your order. We periodically run free-shipping promotions — if one is active,
          it will be automatically applied at checkout.
        </p>
      </section>

      {/* Order Tracking */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Order Tracking</h2>
        <p className="text-muted-foreground leading-relaxed">
          Once your order is dispatched, you can monitor its status in{" "}
          <Link
            href="/account/orders"
            className="text-foreground underline underline-offset-4 hover:opacity-80"
          >
            My Orders
          </Link>
          . If you placed an order as a guest, you can track it using the order reference number
          sent to your email.
        </p>
      </section>

      {/* Missing or Damaged Orders */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Missing or Damaged Orders</h2>
        <p className="text-muted-foreground leading-relaxed">
          If your order has not arrived within the estimated window, or if items arrive damaged,
          please{" "}
          <a href="/contact" className="text-foreground underline underline-offset-4 hover:opacity-80">
            contact us
          </a>{" "}
          within 48 hours of the expected delivery date. We will investigate promptly and work to
          resolve the issue as quickly as possible.
        </p>
      </section>

      {/* Returns */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Returns and Refunds</h2>
        <p className="text-muted-foreground leading-relaxed">
          For information on returning items, please see our{" "}
          <a
            href="/return-policy"
            className="text-foreground underline underline-offset-4 hover:opacity-80"
          >
            Return Policy
          </a>
          .
        </p>
        <p className="text-muted-foreground text-sm">
          {/* TODO: Update delivery timelines and coverage as the business expands */}
          Delivery areas and timelines above reflect current operational scope and should be updated
          as coverage expands.
        </p>
      </section>
    </PageShell>
  );
}
