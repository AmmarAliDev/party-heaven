import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { buildMetadata } from "@/config/metadata";

export const metadata = buildMetadata({
  title: "Privacy Policy",
  path: "/privacy",
  description:
    "Understand how we collect, use, and protect your personal information when you shop with us.",
});

export default function PrivacyPage() {
  return (
    <PageShell className="max-w-7xl gap-10">
      {/* Header */}
      <div className="space-y-3">
        <Badge variant="secondary">Policy</Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm">Last updated: April 2026</p>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          Your privacy matters to us. This policy explains what personal data we collect, why we
          collect it, and how we use and protect it.
        </p>
      </div>

      <Separator />

      {/* Information We Collect */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Information We Collect</h2>
        <p className="text-muted-foreground leading-relaxed">
          We collect information you provide directly — such as your name, email address, delivery
          address, and phone number — when you create an account, place an order, or contact us.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          We also collect certain usage data automatically, including your IP address, browser type,
          pages visited, and referring URLs, to help us understand how you use our site and improve
          it.
        </p>
      </section>

      {/* How We Use It */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">How We Use Your Information</h2>
        <ul className="text-muted-foreground list-disc space-y-2 pl-5 leading-relaxed">
          <li>Processing and fulfilling your orders.</li>
          <li>Sending order confirmations and shipping updates.</li>
          <li>Responding to your customer service enquiries.</li>
          <li>Improving our website and product offerings.</li>
          <li>Sending promotional emails, if you have opted in (you can opt out at any time).</li>
        </ul>
      </section>

      {/* Sharing */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Sharing Your Information</h2>
        <p className="text-muted-foreground leading-relaxed">
          We do not sell or rent your personal information to third parties. We may share your data
          with trusted service providers (such as delivery partners and payment processors) only to
          the extent necessary to fulfill your order. These partners are bound by confidentiality
          obligations.
        </p>
      </section>

      {/* Data Security */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Data Security</h2>
        <p className="text-muted-foreground leading-relaxed">
          We take reasonable technical and organisational measures to protect your personal data
          against unauthorised access, loss, or disclosure. Passwords are stored using
          industry-standard one-way hashing and are never transmitted or stored in plaintext.
        </p>
      </section>

      {/* Cookies */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Cookies</h2>
        <p className="text-muted-foreground leading-relaxed">
          We use essential cookies to maintain your session and shopping cart. We may also use
          analytics cookies to understand site usage. You can manage cookie preferences through your
          browser settings.
        </p>
      </section>

      {/* Your Rights */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Your Rights</h2>
        <p className="text-muted-foreground leading-relaxed">
          You have the right to access, correct, or request deletion of your personal data. To
          exercise these rights, please{" "}
          <a href="/contact" className="text-foreground underline underline-offset-4 hover:opacity-80">
            contact us
          </a>
          .
        </p>
      </section>

      {/* Changes */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Changes to This Policy</h2>
        <p className="text-muted-foreground leading-relaxed">
          We may update this Privacy Policy from time to time. Any changes will be posted on this
          page with an updated revision date. Continued use of our site after changes constitutes
          acceptance of the updated policy.
        </p>
      </section>
    </PageShell>
  );
}
