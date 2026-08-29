import type { RuntimeEnv } from "@/config/env";
import type { NavItem } from "@/types/app";

import { env } from "./env";
import { routes } from "./routes";

export const storefrontNav: NavItem[] = [
  {
    title: "Home",
    href: routes.storefront.home,
    description: "Storefront landing page.",
  },
  {
    title: "Categories",
    href: routes.storefront.categories,
    description: "Browse storefront category listing pages.",
  },
  {
    title: "About",
    href: routes.storefront.about,
    description: "Company story and mission placeholder.",
  },
  {
    title: "Blog",
    href: routes.storefront.blog,
    description: "English-first storefront blog and buying guides.",
  },
  {
    title: "Contact",
    href: routes.storefront.contact,
    description: "Customer contact page placeholder.",
  },
  // {
  //   title: "Shipping Policy",
  //   href: routes.storefront.shippingPolicy,
  //   description: "Delivery policy placeholder.",
  // },
  // {
  //   title: "Returns",
  //   href: routes.storefront.returnPolicy,
  //   description: "Return policy placeholder.",
  // },
];

export const adminNav: NavItem[] = [
  {
    title: "Dashboard",
    href: routes.admin.dashboard,
    description: "Daily operations summary and quick actions.",
  },
  {
    title: "Products",
    href: routes.admin.products,
    description: "Manage product content, pricing, stock, and SEO.",
  },
  {
    title: "Orders",
    href: routes.admin.orders,
    description: "Order queue and fulfillment placeholder.",
  },
  {
    title: "Revenue",
    href: routes.admin.revenue,
    description: "Revenue summary and trends placeholder.",
  },
  {
    title: "Inventory",
    href: routes.admin.inventory,
    description: "Low-stock and catalog health placeholder.",
  },
  {
    title: "Activity",
    href: routes.admin.activity,
    description: "Recent staff and system activity placeholder.",
  },
  {
    title: "Settings",
    href: routes.admin.settings,
    description: "Admin preferences and access controls placeholder.",
  },
];

export function loadSiteConfig(runtimeEnv: RuntimeEnv = env) {
  return {
    name: "PARTY HEAVEN",
    shortName: "PARTY HEAVEN",
    logoPath: "/app-logo.svg",
    appIcon: "/app-logo.svg",
    description:
      "Production-ready Karachi-first e-commerce foundation built with Next.js App Router, TypeScript, Tailwind CSS, and shadcn/ui patterns.",
    locale: "en-PK",
    country: "Pakistan",
    defaultCity: runtimeEnv.defaultCity,
    supportEmail: "support@onedollar.local",
    primaryNav: storefrontNav,
    storefrontNav,
    adminNav,
  } as const;
}

export const siteConfig = loadSiteConfig();
