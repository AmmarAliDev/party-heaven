import { routes } from "@/config/routes";

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
    {
      // Featured Deals section: deals are hydrated at runtime from the
      // published Deal records by hydrateFeaturedDealsSections() in the
      // homepage service. Rendered AFTER Featured products.
      id: "fallback-featured-deals",
      kind: "featured-deals",
      title: "Featured Deals",
      description: "Hand-picked deals curated from the catalog by the team.",
      displayOrder: 35,
      deals: [],
      ctaLabel: "View all",
      ctaHref: routes.storefront.deals,
      placeholderMessage: "No Featured Deals are available right now. Check back soon for fresh picks.",
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
