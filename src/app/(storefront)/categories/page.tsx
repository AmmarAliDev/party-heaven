import { Layers3 } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { buildMetadata } from "@/config/metadata";
import { CategoryOverviewCard, getCatalogCategories } from "@/features/catalog";
import { testIds } from "@/lib/test-selectors";

export const revalidate = 900;

export const metadata = buildMetadata({
  title: "Categories",
  path: "/categories",
  description:
    "Browse our product categories to find premium deals and items you love — all at Party Heaven.",
});

export default async function CategoriesPage() {
  const categories = await getCatalogCategories();

  return (
    <PageShell className="gap-8">
      <SectionHeader
        eyebrow="Catalog"
        title="Shop by Category"
        titleAs="h1"
        titleId="categories-page-heading"
        description="Browse our categories to find exactly what you're looking for — from everyday essentials to hard-to-find items, all in one place."      />

      {categories.length === 0 ? (
        <EmptyState
          icon={Layers3}
          title="No categories available yet"
          description="Catalog categories will appear here once the product catalog is connected to real data."
        />
      ) : (
        <ul
          aria-labelledby="categories-page-heading"
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          data-testid={testIds.storefront.categoryGrid}
        >
          {categories.map((category, index) => (
            <li key={category.id} className="list-none">
              <CategoryOverviewCard category={category} eagerImage={index === 0} />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
