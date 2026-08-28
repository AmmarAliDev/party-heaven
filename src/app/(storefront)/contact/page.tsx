import { ContactForm } from "@/features/contact";
import { buildMetadata } from "@/config/metadata";
import { PageShell } from "@/components/layout/page-shell";

export const metadata = buildMetadata({
  title: "Contact Us",
  path: "/contact",
  description: "Get in touch with our customer support team. We're here to help with your questions and inquiries.",
});

export default function ContactPage() {
  return (
    <PageShell className="py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold tracking-tight mb-4">Contact Us</h1>
          <p className="text-muted-foreground text-lg">
            Have a question or need assistance? Send us a message.
          </p>
        </div>

        <ContactForm />
      </div>
    </PageShell>
  );
}

