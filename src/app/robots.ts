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
      // ],
      disallow: "/",
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}