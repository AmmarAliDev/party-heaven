import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/ui/page-container";
import { shouldRenderGuardedSurface } from "@/config/production-visibility";

type HomepageContentSourceIndicatorProps = {
  source: "cms" | "fallback";
};

export function HomepageContentSourceIndicator({ source }: HomepageContentSourceIndicatorProps) {
  if (source === "cms") {
    return null;
  }

  if (!shouldRenderGuardedSurface("homepageFallbackIndicator")) {
    return null;
  }

  return (
    <PageContainer as="section" className="pt-6">
      <Badge variant="outline" className="max-w-full whitespace-normal text-left">
        Using fallback homepage content until CMS data is available.
      </Badge>
    </PageContainer>
  );
}
