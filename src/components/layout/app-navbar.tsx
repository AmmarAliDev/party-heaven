import { getCatalogCategories } from "@/features/catalog";
import { logger } from "@/lib/logger";

import { PageContainer } from "../ui/page-container";
import { StorefrontNavbarCarousel } from "./storefront-navbar-carousel";
import { buildStorefrontNavbarCategories } from "./storefront-navbar-categories";

/**
 * Storefront category navbar. Fetches the live published catalog categories
 * and renders them as a swipeable pill carousel (5 per view on mobile, arrows
 * on overflow). Each category title opens a scrollable dropdown listing that
 * category's products; the circular image links to the category listing page.
 *
 * The navbar renders on a plain (page) background — it deliberately sits on
 * its own full-width band below the dark header strip, not inside it.
 */
export default async function AppNavbar() {
  let categoriesError = false;
  let categories = [] as Awaited<ReturnType<typeof getCatalogCategories>>;

  try {
    categories = await getCatalogCategories();
  } catch (error) {
    categoriesError = true;
    logger.error("Failed to load header categories", {
      code: "HEADER_CATEGORY_NAV_LOAD_FAILED",
      error,
    });
  }

  if (categoriesError || categories.length === 0) {
    return null;
  }

  const items = buildStorefrontNavbarCategories(categories);

  return (
    <nav
      aria-label="Categories"
      className="border-border/70 bg-background w-full border-b"
    >
      <PageContainer className="py-2 md:py-2.5">
        <StorefrontNavbarCarousel items={items} />
      </PageContainer>
    </nav>
  );
}