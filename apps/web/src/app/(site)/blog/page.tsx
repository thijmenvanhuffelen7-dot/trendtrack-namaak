import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/site/prose";
import { formatDate, POSTS } from "@/lib/site/blog";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Over webshops in Nederland en België: omzet schatten, ads onderzoeken en tools kiezen.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndex() {
  return (
    <div className="s-wrap pt-10 pb-[clamp(72px,8vw,120px)]">
      <PageTitle
        title="Blog"
        lead="Over webshops in Nederland en België: wat ze verkopen, hoe ze adverteren en hoe je dat onderzoekt."
      />
      <ul className="mt-16">
        {POSTS.map((p, i) => (
          <li key={p.slug} className={i % 2 === 0 ? "bg-[var(--s-surface)]" : ""}>
            <Link
              href={`/blog/${p.slug}`}
              className="group grid gap-2 px-5 py-6 md:grid-cols-[var(--s-axis)_1fr] md:items-baseline"
            >
              <time dateTime={p.date} className="text-[15px] text-[var(--s-muted)]">
                {formatDate(p.date)}
              </time>
              <div>
                <h2 className="text-[clamp(1.5rem,2.6vw,2.4rem)] transition-transform duration-200 group-hover:translate-x-1">
                  {p.title}
                </h2>
                <p className="mt-2 max-w-2xl text-[var(--s-muted)]">{p.description}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
