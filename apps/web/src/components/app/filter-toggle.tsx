import { SlidersHorizontal } from "lucide-react";

const IGNORE = new Set(["sort", "dir", "page", "per_page"]);

/** Aantal ingevulde filters (sorteren en paginering tellen niet mee). */
export function countActiveFilters(filters: Record<string, unknown>): number {
  return Object.entries(filters).filter(
    ([k, v]) =>
      !IGNORE.has(k) &&
      v !== undefined &&
      v !== null &&
      v !== "" &&
      !(Array.isArray(v) && v.length === 0),
  ).length;
}

/**
 * Knop "Filters" voor telefoons. Een verborgen checkbox is de `peer` van het formulier dat er direct na
 * komt: het formulier krijgt `hidden peer-checked:grid md:grid`. Werkt zonder JavaScript. Met actieve
 * filters staat het formulier meteen open.
 */
export function FilterToggle({
  id,
  label,
  active,
  results,
}: {
  id: string;
  label: string;
  active: number;
  results: string;
}) {
  return (
    <>
      <input
        id={id}
        type="checkbox"
        className="peer sr-only"
        defaultChecked={active > 0}
        aria-label={label}
      />
      <label
        htmlFor={id}
        className="mb-3 flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium peer-focus-visible:ring-2 peer-focus-visible:ring-ring md:hidden"
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        {label}
        {active > 0 && (
          <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">
            {active}
          </span>
        )}
        <span className="ml-auto font-normal text-muted-foreground">{results}</span>
      </label>
    </>
  );
}
