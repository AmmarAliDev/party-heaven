import { loadHomepageContentForStorefront } from "@/features/admin/homepage/service";
import { getCatalogCategories } from "@/features/catalog";
import { listPublishedDeals, type StorefrontDeal } from "@/features/deals";
import { createLogger } from "@/lib/logger";

import { mapCatalogCategoriesToFeaturedCategoryItems } from "./featured-categories";
import { resolveHomepageFeaturedProducts } from "./featured-products";
import { resolveHomepageSections } from "./resolver";
import type {
  FeaturedCategoriesSection,
  FeaturedDealItem,
  FeaturedDealsSection,
  FeaturedProductsSection,
  HomepageContent,
  HomepageContentResult,
  HomepageSection,
} from "./types";

const logger = createLogger("homepage.service");
/**
 * Maximum number of Featured Deals fetched for the homepage section. Matches
 * HOMEPAGE_CAROUSEL_MAX_ITEMS so the carousel can display the full set without
 * server-side truncation.
 */
const HOMEPAGE_FEATURED_DEALS_LIMIT = 8;

function isFeaturedCategoriesSection(section: HomepageSection): section is FeaturedCategoriesSection {
  return section.kind === "featured-categories";
}

function isFeaturedProductsSection(section: HomepageSection): section is FeaturedProductsSection {
  return section.kind === "featured-products";
}

async function hydrateFeaturedCategorySections(sections: HomepageSection[]): Promise<HomepageSection[]> {
  const hasFeaturedCategoriesSection = sections.some(isFeaturedCategoriesSection);

  if (!hasFeaturedCategoriesSection) {
    return sections;
  }

  try {
    const catalogCategories = await getCatalogCategories();
    const categories = mapCatalogCategoriesToFeaturedCategoryItems(catalogCategories);

    if (categories.length === 0) {
      return sections;
    }

    return sections.map((section) => {
      if (!isFeaturedCategoriesSection(section)) {
        return section;
      }

      return {
        ...section,
        categories,
      };
    });
  } catch (error) {
    logger.error("Failed to hydrate homepage featured categories from catalog categories.", error);
    return sections;
  }
}

async function hydrateFeaturedProductsSections(sections: HomepageSection[]): Promise<HomepageSection[]> {
  const featuredProductsSections = sections.filter(isFeaturedProductsSection);

  if (featuredProductsSections.length === 0) {
    return sections;
  }

  const fallbackProducts = featuredProductsSections[0]?.products ?? [];
  const products = await resolveHomepageFeaturedProducts(fallbackProducts);

  return sections.map((section) => {
    if (!isFeaturedProductsSection(section)) {
      return section;
    }

    return {
      ...section,
      products,
    };
  });
}

function isFeaturedDealsSection(section: HomepageSection): section is FeaturedDealsSection {
  return section.kind === "featured-deals";
}

/**
 * Maps a StorefrontDeal to a FeaturedDealItem for use in the Featured Deals
 * homepage section. The card image prefers deal-specific media; the subtitle
 * summarizes the included products.
 */
function toFeaturedDealItem(deal: StorefrontDeal): FeaturedDealItem {
  const primaryImage = deal.images[0];
  const names = deal.products.map((product) => product.name);

  return {
    id: deal.id,
    slug: deal.slug,
    title: deal.title,
    href: `/deals/${deal.slug}`,
    price: deal.price,
    ...(typeof deal.compareAt === "number" ? { compareAt: deal.compareAt } : {}),
    ...(primaryImage
      ? {
          imageUrl: primaryImage.url,
          imageAlt: primaryImage.alt,
        }
      : {}),
    productSummary:
      names.length === 0
        ? "Bundle deal"
        : names.length === 1
          ? (names[0] ?? "Bundle deal")
          : names.length === 2
            ? `${names[0] ?? ""} + ${names[1] ?? ""}`
            : `${names.slice(0, 2).join(" + ")} +${names.length - 2} more`,
    itemCount: deal.products.length,
    isAvailable: deal.isAvailable,
  };
}

/**
 * Hydrates any `featured-deals` sections in the resolved list with live
 * published deals. If the deals fetch fails, the section renders its empty
 * state gracefully instead of breaking the page.
 */
async function hydrateFeaturedDealsSections(sections: HomepageSection[]): Promise<HomepageSection[]> {
  const hasFeaturedDealsSection = sections.some(isFeaturedDealsSection);

  if (!hasFeaturedDealsSection) {
    return sections;
  }

  try {
    const deals = (await listPublishedDeals()).slice(0, HOMEPAGE_FEATURED_DEALS_LIMIT);
    const dealItems: FeaturedDealItem[] = deals.map(toFeaturedDealItem);

    return sections.map((section) => {
      if (!isFeaturedDealsSection(section)) {
        return section;
      }

      return { ...section, deals: dealItems };
    });
  } catch (error) {
    logger.error("Failed to hydrate Featured Deals homepage section.", error);
    // Return sections unchanged so the component hides the empty section.
    return sections;
  }
}

export async function fetchHomepageContentFromCms(): Promise<HomepageContent | null> {
  try {
    const content = await loadHomepageContentForStorefront();

    if (!content || !content.sections?.length) {
      logger.debug("No admin-managed homepage content is available; using fallback content.");
      return null;
    }

    return content;
  } catch (error) {
    logger.error("Failed to load homepage content from admin-managed sources.", error);
    return null;
  }
}

export async function getHomepageContent(): Promise<HomepageContentResult> {
  const cmsContent = await fetchHomepageContentFromCms();
  const resolved = resolveHomepageSections(cmsContent?.sections);
  const hydratedWithCategories = await hydrateFeaturedCategorySections(resolved.sections);
  const hydratedWithFeaturedProducts = await hydrateFeaturedProductsSections(hydratedWithCategories);
  const hydratedSections = await hydrateFeaturedDealsSections(hydratedWithFeaturedProducts);

  return {
    ...resolved,
    sections: hydratedSections,
  };
}
