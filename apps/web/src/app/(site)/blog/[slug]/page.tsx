import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Column, PageTitle, Prose } from "@/components/site/prose";
import { formatDate, POSTS, postBySlug } from "@/lib/site/blog";
import { SITE } from "@/lib/site/config";

// Bekende posts worden vooraf gebouwd; een onbekende slug geeft notFound() hieronder.
export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const p = postBySlug((await params).slug);
  if (!p) return {};
  return {
    title: p.title,
    description: p.description,
    alternates: { canonical: `/blog/${p.slug}` },
    openGraph: { type: "article", publishedTime: p.date },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = postBySlug((await params).slug);
  if (!p) notFound();
  const { default: Body } = await import(`@/content/blog/${p.slug}.mdx`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title,
    description: p.description,
    datePublished: p.date,
    url: `${SITE.url}/blog/${p.slug}`,
    inLanguage: "nl-NL",
    author: { "@type": "Organization", name: SITE.name },
    publisher: { "@id": `${SITE.url}/#org` },
  };
  return (
    <article className="s-glow relative">
      <div className="s-wrap pt-16 pb-[clamp(80px,9vw,140px)] md:pt-24">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <PageTitle
          size="md"
          title={p.title}
          aside={
            <>
              <Link href="/blog" className="s-link text-[var(--s-ink)]">
                Blog
              </Link>
              <span className="mx-2 text-[var(--s-faint)]">/</span>
              <time dateTime={p.date}>{formatDate(p.date)}</time>
            </>
          }
        />
        <Column>
          <Prose>
            <Body />
          </Prose>
        </Column>
      </div>
    </article>
  );
}
