import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { buildMetadata } from "@/config/metadata";
import { shouldRenderGuardedSurface } from "@/config/production-visibility";

export const metadata = buildMetadata({
  title: "About Us",
  path: "/about",
  description:
    "Learn about our story, mission, and commitment to delivering quality products at unbeatable value.",
});

export default function AboutPage() {
  const showInterimNarrativeNote = shouldRenderGuardedSurface("aboutInterimNarrativeNote");

  return (
    <PageShell className="max-w-7xl gap-10">
      {/* Hero */}
      <div className="space-y-3">
        <Badge variant="secondary">Company</Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">About Us</h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
          We started with a single belief: everyone deserves access to quality products without
          breaking the bank. That belief shapes everything we do — from the products we stock to the
          service we provide.
        </p>
      </div>

      <Separator />

      {/* Mission */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Our Mission</h2>
        <p className="text-muted-foreground leading-relaxed">
          Our mission is straightforward: make everyday essentials affordable and accessible for
          every household. We work directly with suppliers to remove unnecessary markups, so the
          savings pass straight to you.
        </p>
      </section>

      {/* What We Offer */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">What We Offer</h2>
        <ul className="text-muted-foreground list-disc space-y-2 pl-5 leading-relaxed">
          <li>A curated selection of products across everyday categories.</li>
          <li>Transparent pricing with no hidden fees at checkout.</li>
          <li>Reliable delivery to your doorstep.</li>
          <li>A straightforward returns process if something isn&apos;t right.</li>
        </ul>
      </section>

      {/* Customer Promise */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Our Promise to You</h2>
        <p className="text-muted-foreground leading-relaxed">
          Every order matters to us. Whether you&apos;re a first-time buyer or a returning customer,
          you&apos;ll receive the same care and attention. If you ever have a question or concern,
          our support team is ready to help.
        </p>
      </section>

      {/* Contact nudge */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Get in Touch</h2>
        <p className="text-muted-foreground leading-relaxed">
          Have questions or feedback?{" "}
          <a href="/contact" className="text-foreground underline underline-offset-4 hover:opacity-80">
            Contact our team
          </a>{" "}
          — we&apos;re happy to hear from you.
        </p>
        {showInterimNarrativeNote ? (
          <p className="text-muted-foreground text-sm">
            {/* TODO: Replace with real brand story, team details, and founding narrative */}
            Content above is an interim version and should be updated to reflect the real brand story
            and mission.
          </p>
        ) : null}
      </section>
    </PageShell>
  );
}
