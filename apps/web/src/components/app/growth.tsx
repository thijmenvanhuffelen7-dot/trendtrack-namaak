import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { formatGrowth, growthTrend } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Groeiscore met pijl én getal (nooit alleen kleur). */
export function Growth({ score, locale }: { score: number | null; locale: string }) {
  const trend = growthTrend(score);
  if (!trend) return <span className="text-muted-foreground">–</span>;
  const Icon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : ArrowRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 tabular",
        trend === "up" && "text-positive",
        trend === "down" && "text-danger",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {formatGrowth(score, locale)}
    </span>
  );
}
