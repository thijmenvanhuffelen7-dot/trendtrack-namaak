import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app", "/admin", "/api/", "/oauth", "/share", "/login", "/auth"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
