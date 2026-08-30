import { StaticPagePlaceholder } from "@/components/layout/static-page-placeholder";
import { buildMetadata } from "@/config/metadata";
import { shouldRenderGuardedSurface } from "@/config/production-visibility";
import { notFound } from "next/navigation";

export const metadata = buildMetadata({
  title: "Return Policy",
  path: "/return-policy",
  description: "Return policy information for Party Heaven customers.",
});

export default function ReturnPolicyPage() {
  if (!shouldRenderGuardedSurface("returnPolicyPlaceholderPage")) {
    notFound();
  }

  return (
    <StaticPagePlaceholder
      pageTag="Policy"
      title="Return Policy"
      description="A placeholder for return eligibility, process, and expected handling times."
    />
  );
}
