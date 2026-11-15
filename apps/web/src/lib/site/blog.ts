/** De blogposts. De tekst staat in src/content/blog/<slug>.mdx. */
export interface Post {
  slug: string;
  title: string;
  description: string;
  date: string;
}

export const POSTS: Post[] = [
  {
    slug: "omzet-shopify-store-checken",
    title: "Hoe check je de omzet van een Shopify-store?",
    description:
      "Vijf manieren om de omzet van een webshop te schatten, wat ze waard zijn en waarom je altijd een bandbreedte moet zien in plaats van één getal.",
    date: "2026-11-12",
  },
  {
    slug: "alternatieven-voor-shopify-spy-tools",
    title: "Alternatieven voor Shopify-spy-tools: waar let je op?",
    description:
      "Een neutrale vergelijking van tools om webshops en hun ads te onderzoeken: databronnen, schattingen, regio, prijs en koppelingen met AI.",
    date: "2026-11-05",
  },
];

export const postBySlug = (slug: string) => POSTS.find((p) => p.slug === slug);

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(iso),
  );
