/**
 * Category SEO content generator.
 *
 * Produces ready-to-use SEO content packages for storefront category pages
 * targeting Pakistan-based shoppers. The output is deterministic and
 * template-driven — no external AI API required.
 *
 * Usage:
 *   const content = generateCategorySeoContent(category);
 *   // Use content.title as the meta title, content.description as the
 *   // meta description, content.introCopy above the product grid, etc.
 *
 * To add a new category template, add an entry to CATEGORY_TEMPLATES below
 * keyed by the category slug.
 *
 * Deferred: Dynamic personalisation based on live product data
 * (e.g. "over 40 products starting at Rs. X") is deferred until the
 * storefront fully reads from the database. See docs/ai/open-tasks.md.
 */

import { routes } from "@/config/routes";
import type { CatalogCategory } from "@/features/catalog/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single FAQ item for display in an on-page accordion. */
export type CategoryFaqItem = {
  question: string;
  answer: string;
};

/**
 * Internal link suggestion shown in the SEO content panel or storefront.
 * `label` is the anchor text; `href` is the storefront path.
 */
export type CategoryInternalLink = {
  label: string;
  href: string;
};

/**
 * Full SEO content package for a category page.
 * All string fields are safe to render as text (no raw HTML).
 */
export type CategorySeoContent = {
  /** Recommended meta title — aim for ≤70 chars. */
  title: string;
  /** Recommended meta description — aim for ≤160 chars. */
  description: string;
  /**
   * 2–4 sentence introductory paragraph intended for display above the
   * product grid. Plain text; no markdown or HTML.
   */
  introCopy: string;
  /** 3–5 FAQ question/answer pairs for an on-page FAQ section. */
  faqs: CategoryFaqItem[];
  /**
   * Internal link suggestions for sidebar widgets, footer links,
   * or related-links sections. Includes the category itself + siblings.
   */
  internalLinks: CategoryInternalLink[];
  /**
   * Blog post topic ideas related to this category.
   * Pass these to the blog editor or admin content tool as seed ideas.
   */
  blogTopics: string[];
  /**
   * Human-readable notes describing recommended schema markup.
   * These are editorial hints — not structured JSON-LD.
   * Store in the `seoSchemaNotes` admin field.
   * Use `generateCollectionPageJsonLd` (see lib/seo/structured-data.tsx)
   * to emit the actual JSON-LD on the page.
   */
  schemaNotes: string;
};

// ---------------------------------------------------------------------------
// Per-category template data
// ---------------------------------------------------------------------------

type CategoryTemplate = {
  title: string;
  description: string;
  introCopy: string;
  faqs: CategoryFaqItem[];
  blogTopics: string[];
  schemaNotes: string;
};

const CATEGORY_TEMPLATES: Record<string, CategoryTemplate> = {
  "home-care": {
    title: "Home Care Products in Pakistan — Cleaning & Laundry Essentials",
    description:
      "Shop home care products in Pakistan. Detergents, floor cleaners, and household staples — all at honest prices with fast delivery.",
    introCopy:
      "Keep your home clean without overspending. Our Home Care category brings together detergents, floor cleaners, trash bags, and other daily-use essentials trusted by households across Pakistan. Every product is chosen for value, availability, and reliability — so your restock is one order away.",
    faqs: [
      {
        question: "Which detergent works best for hand washing in Pakistan?",
        answer:
          "Powder detergents like Ultra Wash are popular for hand washing because they dissolve well in cold water and remove common stains effectively. Check the product label for the recommended amount per wash.",
      },
      {
        question: "How do I choose a floor cleaner for tiles?",
        answer:
          "Look for a floor cleaner that lists tile-safe or ceramic-safe on the label. Citrus-based cleaners are a good everyday choice — they cut through dust and leave a fresh scent without leaving a residue.",
      },
      {
        question: "Are home care products delivered all over Pakistan?",
        answer:
          "Yes. We deliver home care orders to major cities including Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, and other areas. Delivery times vary by location — check the cart for an estimate at checkout.",
      },
      {
        question: "What is the return policy for cleaning products?",
        answer:
          "Sealed, unused cleaning products can be returned within 7 days of delivery. If an item arrives damaged or incorrect, contact us and we will arrange a replacement or refund.",
      },
      {
        question: "Can I buy home care products in bulk?",
        answer:
          "Yes. Many items in this category are available in family or bulk sizes. Look for multi-pack options on the product page, or filter by pack size in the sidebar.",
      },
    ],
    blogTopics: [
      "10 Home Cleaning Hacks That Save Time and Money in Pakistan",
      "How to Choose the Right Detergent for Your Washing Machine",
      "The Best Floor Cleaners for Karachi's Humid Climate",
      "How to Make Your Cleaning Supplies Last Longer",
      "Eco-Friendly Cleaning Products Available in Pakistan",
    ],
    schemaNotes:
      "Use ItemList or CollectionPage schema for this category. Each listed product should be referenced as a ListItem with url, name, and image. Add a BreadcrumbList (Home > Categories > Home Care). Organization publisher block is already in the site-level layout.",
  },

  grocery: {
    title: "Grocery Products in Pakistan — Pantry Staples & Daily Essentials",
    description:
      "Stock your pantry with everyday grocery essentials. Browse trusted brands, snacks, cooking staples, and household top-ups — delivered across Pakistan.",
    introCopy:
      "From pantry staples to quick snacks, our Grocery category covers everything your household needs between big shopping trips. We source reliable everyday brands at fair prices so you can top up without stepping out. Delivered to homes in Karachi, Lahore, Islamabad, and beyond.",
    faqs: [
      {
        question: "Is the grocery delivery fresh and on time?",
        answer:
          "Packaged grocery items are dispatched from our warehouse within 1–2 business days. Fresh or perishable items, where available, include a freshness guarantee — check individual product listings for details.",
      },
      {
        question: "How do I know if a product is in stock before ordering?",
        answer:
          "Every product listing shows the current stock status (In Stock, Low Stock, or Out of Stock) below the price. You can also filter the category by availability using the sidebar.",
      },
      {
        question: "Can I return a grocery item if I am not satisfied?",
        answer:
          "Sealed, unopened grocery items can be returned within 7 days. If a product arrives expired or damaged, contact us within 48 hours and we will replace it or issue a refund.",
      },
      {
        question: "Are prices listed in Pakistani Rupees?",
        answer:
          "Yes. All prices are shown in Rs. (Pakistani Rupees) and include applicable taxes. No hidden charges are added at checkout beyond standard delivery fees.",
      },
      {
        question: "Do you carry local Pakistani brands?",
        answer:
          "Yes. We stock a mix of well-known local and imported brands. You can use the search bar or browse the category to find specific brands.",
      },
    ],
    blogTopics: [
      "Smart Pantry Stocking Tips for Pakistani Households",
      "Budget Grocery Shopping Guide for Families in Pakistan",
      "How to Reduce Food Waste at Home: A Practical Guide",
      "The Best Cooking Staples to Always Have in Your Kitchen",
      "Understanding Expiry Dates: What They Really Mean",
    ],
    schemaNotes:
      "Use CollectionPage or ItemList schema for the grocery listing. Each product ListItem should include name, url, image, and offers (priceCurrency: PKR). Add a BreadcrumbList (Home > Categories > Grocery). Consider adding a FAQPage schema block for the FAQ section on this page.",
  },

  "personal-care": {
    title: "Personal Care Products in Pakistan — Skincare, Hygiene & Wellness",
    description:
      "Explore daily-use personal care essentials. Skincare, hygiene basics, and wellness products — trusted by Pakistani shoppers and delivered to your door.",
    introCopy:
      "Your daily routine deserves reliable products at honest prices. Our Personal Care category covers skincare, shampoos, soaps, oral hygiene, and wellness basics — all selected for quality and value. Whether you are stocking up for your family or treating yourself, you will find what you need here.",
    faqs: [
      {
        question: "Are personal care products suitable for Pakistan's climate?",
        answer:
          "Yes. We specifically include products that work well in Pakistan's warm and humid climate. Look for lightweight moisturisers and oil-control formulas in skincare, and anti-humidity hair care options in the hair category.",
      },
      {
        question: "Do you sell skincare products suitable for darker skin tones?",
        answer:
          "Yes. We stock a range of skincare products from brands that cater to South Asian skin tones. Filter by skin concern in the sidebar or check the product description for suitability details.",
      },
      {
        question: "Are these products original or imported?",
        answer:
          "All products sold in this category are sourced from authorised distributors. We do not sell counterfeit or unverified goods. Each listing includes the brand name and origin where available.",
      },
      {
        question: "Can I return personal care products?",
        answer:
          "Sealed and unused personal care items can be returned within 7 days. Once opened, products cannot be returned for hygiene reasons unless they are faulty or expired.",
      },
      {
        question: "Do you offer dermatologist-recommended brands?",
        answer:
          "Several products in this category are from clinically tested or dermatologist-recommended brands. Look for this detail in the product description or specifications.",
      },
    ],
    blogTopics: [
      "Best Moisturisers for Pakistan's Dry Winter Months",
      "A Simple Skincare Routine for Busy Pakistanis",
      "Top Hair Care Tips for Hot and Humid Weather",
      "How to Build a Budget Personal Care Kit for Your Family",
      "Understanding SPF: Do You Need Sunscreen in Pakistan?",
    ],
    schemaNotes:
      "Use CollectionPage or ItemList schema. Add a BreadcrumbList (Home > Categories > Personal Care). For individual product pages in this category, include Product schema with offers, aggregateRating (if reviews exist), and brand. Consider a FAQPage schema block for the FAQ accordion if rendered on the page.",
  },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Builds the generic template for categories without a dedicated entry.
 * Uses the category name and description to produce usable defaults.
 */
function buildGenericTemplate(category: CatalogCategory): CategoryTemplate {
  const name = category.name;
  const description = category.description;

  return {
    title: `${name} in Pakistan — Shop Online at Best Prices`,
    description: `Browse ${name} products in Pakistan. ${description} Delivered fast at honest prices.`.slice(
      0,
      160,
    ),
    introCopy:
      `Explore our ${name} range — carefully selected products for Pakistani households. ` +
      `${description} ` +
      `Filter by price, availability, and discount to find exactly what you need. Delivery available across Pakistan.`,
    faqs: [
      {
        question: `What ${name.toLowerCase()} products are available?`,
        answer: `We carry a range of ${name.toLowerCase()} products including popular brands and everyday essentials. Browse the full listing or use the filters to narrow down by price or availability.`,
      },
      {
        question: "Do you deliver across Pakistan?",
        answer:
          "Yes. We deliver to Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, and other cities. Delivery time and charges are shown at checkout.",
      },
      {
        question: "What is your return policy?",
        answer:
          "Unused, sealed items can be returned within 7 days of delivery. Contact our support team if your order arrives damaged or incorrect.",
      },
      {
        question: "Are prices in Rs.?",
        answer:
          "Yes. All prices are shown in Pakistani Rupees (Rs.) and include applicable taxes. No hidden fees are added at checkout beyond standard delivery charges.",
      },
    ],
    blogTopics: [
      `Best ${name} Products to Buy in Pakistan This Year`,
      `How to Choose the Right ${name} Product for Your Needs`,
      `${name} Buying Guide: What Pakistani Shoppers Should Know`,
    ],
    schemaNotes:
      `Use CollectionPage or ItemList schema for the ${name} category. ` +
      `Each product should be a ListItem with name, url, and image. ` +
      `Add a BreadcrumbList (Home > Categories > ${name}). ` +
      `Add a FAQPage schema block if FAQ content is rendered on the page.`,
  };
}

/**
 * Builds internal link suggestions for a category page.
 * Always includes:
 *  - All categories index
 *  - The category itself (canonical self-link)
 *  - Blog index (for topic cross-linking)
 *  - Other known sibling categories (for cross-navigation)
 *
 * @param currentSlug - The slug of the category being generated for.
 * @param allCategorySlugs - Slugs of all published sibling categories.
 */
function buildInternalLinks(
  currentSlug: string,
  allCategorySlugs: string[],
): CategoryInternalLink[] {
  const links: CategoryInternalLink[] = [
    {
      label: "All Categories",
      href: routes.storefront.categories,
    },
    {
      label: "Blog & Buying Guides",
      href: routes.storefront.blog,
    },
  ];

  // Add sibling categories (exclude current)
  for (const slug of allCategorySlugs) {
    if (slug === currentSlug) continue;
    const label = slugToLabel(slug);
    links.push({ label, href: routes.storefront.category(slug) });
  }

  return links;
}

/**
 * Converts a slug like "home-care" to a display label like "Home Care".
 */
function slugToLabel(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Options to customise the generated content. */
export type CategorySeoContentOptions = {
  /**
   * Slugs of all published categories in the store.
   * Used to generate sibling internal links. Defaults to the three seed
   * categories when not provided.
   */
  allCategorySlugs?: string[];
};

const DEFAULT_CATEGORY_SLUGS = ["home-care", "grocery", "personal-care"];

/**
 * Generates a full SEO content package for a storefront category page.
 *
 * Returns deterministic, Pakistan-focused content using category-specific
 * templates for known categories or a generic template for others.
 *
 * @param category - The `CatalogCategory` object from the catalog service.
 * @param options  - Optional customisation (see `CategorySeoContentOptions`).
 * @returns        A fully typed `CategorySeoContent` object.
 *
 * @example
 * ```ts
 * const content = generateCategorySeoContent(category, {
 *   allCategorySlugs: categories.map(c => c.slug),
 * });
 * ```
 */
export function generateCategorySeoContent(
  category: CatalogCategory,
  options: CategorySeoContentOptions = {},
): CategorySeoContent {
  const { allCategorySlugs = DEFAULT_CATEGORY_SLUGS } = options;

  const template = CATEGORY_TEMPLATES[category.slug] ?? buildGenericTemplate(category);

  return {
    title: template.title,
    description: template.description,
    introCopy: template.introCopy,
    faqs: template.faqs,
    internalLinks: buildInternalLinks(category.slug, allCategorySlugs),
    blogTopics: template.blogTopics,
    schemaNotes: template.schemaNotes,
  };
}
