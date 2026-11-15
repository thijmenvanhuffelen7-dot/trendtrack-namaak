import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Paginering aan de serverkant: links met ?page=N, de overige filters blijven staan. */
export async function Pagination({
  total,
  page,
  perPage,
  hrefFor,
}: {
  total: number;
  page: number;
  perPage: number;
  hrefFor: (page: number) => string;
}) {
  const t = await getTranslations("common");
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  const link = (target: number, label: string, disabled: boolean) =>
    disabled ? (
      <span
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "pointer-events-none opacity-40",
        )}
      >
        {label}
      </span>
    ) : (
      <Link
        href={hrefFor(target)}
        className={buttonVariants({ variant: "outline", size: "sm" })}
        scroll
      >
        {label}
      </Link>
    );
  return (
    <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Paginering">
      {link(page - 1, t("previous"), page <= 1)}
      <span className="text-sm text-muted-foreground tabular">{t("pageOf", { page, pages })}</span>
      {link(page + 1, t("next"), page >= pages)}
    </nav>
  );
}
