import type { MetadataRoute } from "next";
import { POSTS } from "@/lib/site/blog";
import { SITE } from "@/lib/site/config";
import { TOOLS } from "@/lib/site/tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number, lastModified?: string) => ({
    url: `${SITE.url}${path}`,
    lastModified: lastModified ?? new Date().toISOString().slice(0, 10),
    priority,
  });
  return [
    page("/", 1),
    page("/prijzen", 0.9),
    page("/tools", 0.8),
    ...TOOLS.map((t) => page(`/tools/${t.slug}`, 0.8)),
    page("/blog", 0.6),
    ...POSTS.map((p) => page(`/blog/${p.slug}`, 0.6, p.date)),
    page("/schattingen", 0.5),
    page("/docs/api", 0.5),
    page("/affiliate", 0.4),
    page("/opt-out", 0.2),
    page("/privacy", 0.2),
    page("/voorwaarden", 0.2),
  ];
}
