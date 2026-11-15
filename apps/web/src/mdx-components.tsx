import type { MDXComponents } from "mdx/types";
import Link from "next/link";

/** Interne links in MDX via next/link; de opmaak komt van .s-prose. */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    a: ({ href = "", ...props }) =>
      href.startsWith("/") ? (
        <Link href={href} {...props} />
      ) : (
        <a href={href} rel="noopener noreferrer" {...props} />
      ),
    ...components,
  };
}
