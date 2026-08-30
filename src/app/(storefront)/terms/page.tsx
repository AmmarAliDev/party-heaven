import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { buildMetadata } from "@/config/metadata";

export const metadata = buildMetadata({
  title: "Terms and Conditions",
  path: "/terms",
  description:
    "Read the terms and conditions that govern your use of our website and purchasing from our store.",
});

export default function TermsPage() {
  return (
    <PageShell className="max-w-7xl gap-10">
      {/* Header */}
      <div className="space-y-3">
        <Badge variant="secondary">Policy</Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Terms and Conditions</h1>
        <p className="text-muted-foreground text-sm">Last updated: April 2026</p>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          Please read these terms carefully before using our website or placing an order. By using
          our site you agree to be bound by these terms.
        </p>
      </div>

      <Separator />

      {/* Use of Website */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Use of Our Website</h2>
        <p className="text-muted-foreground leading-relaxed">
          You may use our website for lawful purposes only. You must not use it in any way that
          breaches applicable laws, is fraudulent, or causes harm to others. We reserve the right to
          restrict access to our site at our discretion.
        </p>
      </section>

      {/* Account Responsibility */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Account Responsibility</h2>
        <p className="text-muted-foreground leading-relaxed">
          If you create an account with us, you are responsible for maintaining the confidentiality
          of your login credentials and for all activity that takes place under your account. Notify
          us immediately if you suspect any unauthorised use of your account.
        </p>
      </section>

      {/* Orders and Pricing */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Orders and Pricing</h2>
        <p className="text-muted-foreground leading-relaxed">
          All prices are displayed inclusive of applicable taxes unless stated otherwise. We reserve
          the right to correct pricing errors at any time. An order confirmation does not constitute
          acceptance; we may cancel or refuse an order if a pricing error is identified, if the item
          is out of stock, or if we suspect fraudulent activity.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          We reserve the right to update or discontinue products without notice.
        </p>
      </section>

      {/* Payment */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Payment</h2>
        <p className="text-muted-foreground leading-relaxed">
          Payment is required at the time of placing an order. Currently accepted payment methods
          are displayed at checkout. We use secure payment processing and do not store full card
          details on our servers.
        </p>
      </section>

      {/* Delivery */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Delivery</h2>
        <p className="text-muted-foreground leading-relaxed">
          Delivery timelines and charges are described in our{" "}
          <a
            href="/shipping-policy"
            className="text-foreground underline underline-offset-4 hover:opacity-80"
          >
            Shipping Policy
          </a>
          . We are not responsible for delays caused by circumstances beyond our control.
        </p>
      </section>

      {/* Returns */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Returns and Refunds</h2>
        <p className="text-muted-foreground leading-relaxed">
          Our return and refund process is outlined in our{" "}
          <a
            href="/return-policy"
            className="text-foreground underline underline-offset-4 hover:opacity-80"
          >
            Return Policy
          </a>
          . Items must meet the eligibility criteria described there to qualify for a return.
        </p>
      </section>

      {/* Intellectual Property */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Intellectual Property</h2>
        <p className="text-muted-foreground leading-relaxed">
          All content on this website — including text, images, logos, and product descriptions —
          is our property or used with permission. You may not reproduce, distribute, or use any
          content without our prior written consent.
        </p>
      </section>

      {/* Limitation of Liability */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Limitation of Liability</h2>
        <p className="text-muted-foreground leading-relaxed">
          To the fullest extent permitted by law, we are not liable for indirect, incidental, or
          consequential losses arising from your use of our site or products. Our total liability
          shall not exceed the amount you paid for the relevant order.
        </p>
      </section>

      {/* Governing Law */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Governing Law</h2>
        <p className="text-muted-foreground leading-relaxed">
          These terms are governed by applicable local law. Any disputes shall be resolved through
          the appropriate legal channels in the jurisdiction where we operate.
        </p>
      </section>

      {/* Changes */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Changes to These Terms</h2>
        <p className="text-muted-foreground leading-relaxed">
          We may update these terms periodically. Continued use of our website after changes
          constitutes acceptance of the revised terms.
        </p>
        {/* <p className="text-muted-foreground text-sm"> */}
          {/* TODO: Review and update with legal counsel before going live */}
          {/* This is an interim version and should be reviewed by qualified legal counsel before
          launch.
        </p> */}
      </section>
    </PageShell>
  );
}
