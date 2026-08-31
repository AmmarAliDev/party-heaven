import type { MetadataRoute } from "next";

import { env } from "@/config/env";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = env.appUrl.endsWith("/") ? env.appUrl.slice(0, -1) : env.appUrl;

  return {
    rules: {
      userAgent: "*",
      // allow: "/",
      // disallow: [
      //   "/admin/",
      //   "/api/",
      //   "/*?*query=", // Search results
      //   "/checkout/",
      //   "/account/",
      //   "/auth/",
      //   "/wishlist",
      //   "/preview",
      //   "/unauthorized",
      //   "/forbidden",
      // ],
      disallow: "/"
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

// Intentionally disallowing all pages from being indexed by search engines. This is a temporary measure until the site is ready for public indexing.