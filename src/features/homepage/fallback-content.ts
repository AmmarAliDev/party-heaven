import { routes } from "@/config/routes";
import { PARTY_HEAVEN_CATEGORY_SLUG, PARTY_HEAVEN_MAX_PRICE_PKR } from "@/features/catalog/party-heaven";

import type { HomepageSection } from "./types";

export function buildHomepageFallbackSections(): HomepageSection[] {
  return [
    {
      id: "fallback-featured-categories",
      kind: "featured-categories",
      title: "Featured categories",
      description: "Initial sections can be managed later from admin campaigns and homepage settings.",
      displayOrder: 25,
      categories: [
        {
          id: "cat-home-care",
          name: "Home Care",
          description: "Cleaning and household essentials for weekly restocks.",
          slug: "home-care",
          href: routes.storefront.category("home-care"),
        },
        {
          id: "cat-grocery",
          name: "Grocery",
          description: "Pantry staples, snacks, and quick top-ups.",
          slug: "grocery",
          href: routes.storefront.category("grocery"),
        },
        {
          id: "cat-personal-care",
          name: "Personal Care",
          description: "Daily hygiene and wellness picks.",
          slug: "personal-care",
          href: routes.storefront.category("personal-care"),
        },
      ],
    },
    {
      // Party Heaven section: products are hydrated at runtime from the catalog.
      // This fallback defines the section shell; real products are injected by
      // hydratePartyHeavenSections() in the homepage service.
      id: "fallback-party-heaven",
      kind: "party-heaven",
      title: "Party Heaven deals",
      description: `Products priced at Rs. ${PARTY_HEAVEN_MAX_PRICE_PKR} or less — the best value picks across all categories.`,
      displayOrder: 20,
      products: [],
      ctaLabel: "View all Party Heaven deals",
      ctaHref: routes.storefront.category(PARTY_HEAVEN_CATEGORY_SLUG),
      placeholderMessage: "No Party Heaven products are available right now. Check back soon for fresh picks.",
    },
    {
      id: "fallback-featured-products",
      kind: "featured-products",
      title: "Featured products",
      description: "Top-selling products ranked from order volume, with temporary fallback picks while sales data matures.",
      displayOrder: 30,
      products: [
        {
          id: "prod-detergent",
          name: "Ultra Wash Detergent 1kg",
          description: "Powerful cleaning formula for everyday laundry.",
          href: routes.storefront.preview,
          price: 899,
          compareAt: 1099,
          badge: "Top pick",
        },
        {
          id: "prod-olive-oil",
          name: "Olive Blend Cooking Oil 1L",
          description: "Premium blend ideal for frying and salads.",
          href: routes.storefront.preview,
          price: 1299,
          compareAt: 1499,
        },
        {
          id: "prod-skin-care",
          name: "Hydra Care Face Wash",
          description: "Gentle daily cleanser for all skin types.",
          href: routes.storefront.preview,
          price: 699,
        },
        {
          id: "prod-rice",
          name: "Daily Select Basmati Rice 1kg",
          description: "Reliable pantry staple for everyday meals and weekly restocks.",
          href: routes.storefront.preview,
          price: 549,
          compareAt: 649,
        },
      ],
    },
    // {
    //   id: "fallback-deal-spotlight",
    //   kind: "deal-spotlight",
    //   title: "Deal spotlight",
    //   description: "Campaign-ready banner block for short-term promotions managed from admin.",
    //   dealLabel: "48-hour flash deal",
    //   price: 1599,
    //   compareAt: 1999,
    //   ctaLabel: "View deal",
    //   ctaHref: routes.storefront.preview,
    //   displayOrder: 40,
    // },
  ];
}

export const HOMEPAGE_FALLBACK_SECTIONS: HomepageSection[] = buildHomepageFallbackSections();
