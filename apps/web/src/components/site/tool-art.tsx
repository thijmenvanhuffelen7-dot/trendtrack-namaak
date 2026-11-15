import {
  Calculator,
  FileSpreadsheet,
  Megaphone,
  Palette,
  Percent,
  Puzzle,
  Users,
} from "lucide-react";
import type { ToolInfo } from "@/lib/site/tools";

/** Kleurvlak per tool in de huiskleuren (teal, blauw, rood, geel) met een glazen icoon. */
const ART: Record<ToolInfo["kind"], { bg: string; Icon: typeof Calculator }> = {
  theme: {
    bg: "radial-gradient(120% 120% at 20% 10%, #2ad1ae 0%, #0c7866 45%, #062f28 100%)",
    Icon: Palette,
  },
  apps: {
    bg: "radial-gradient(120% 120% at 80% 0%, #8aa4ff 0%, #3e63dd 45%, #101c4a 100%)",
    Icon: Puzzle,
  },
  export: {
    bg: "radial-gradient(120% 120% at 10% 90%, #fff6a0 0%, #ffe927 35%, #8a6d00 100%)",
    Icon: FileSpreadsheet,
  },
  ads: {
    bg: "radial-gradient(120% 120% at 50% 0%, #ff9a9d 0%, #e5484d 45%, #4a0d10 100%)",
    Icon: Megaphone,
  },
  roas: {
    bg: "conic-gradient(from 210deg at 70% 60%, #0c7866, #3e63dd, #0c7866)",
    Icon: Calculator,
  },
  margin: {
    bg: "radial-gradient(120% 120% at 90% 90%, #ffe927 0%, #0c7866 55%, #052a24 100%)",
    Icon: Percent,
  },
  clv: {
    bg: "radial-gradient(120% 120% at 0% 0%, #e5484d 0%, #3e63dd 60%, #0d1640 100%)",
    Icon: Users,
  },
};

export function ToolArt({
  kind,
  className = "h-40",
}: {
  kind: ToolInfo["kind"];
  className?: string;
}) {
  const { bg, Icon } = ART[kind];
  return (
    <div
      aria-hidden
      className={`relative grid place-items-center overflow-hidden rounded-[16px] ${className}`}
      style={{ background: bg }}
    >
      <div className="absolute inset-0 opacity-30 [background:repeating-radial-gradient(circle_at_50%_120%,transparent_0_22px,rgb(255_255_255/0.12)_22px_23px)]" />
      <span className="relative grid size-16 place-items-center rounded-full border border-white/30 bg-white/15 shadow-[inset_0_1px_0_rgb(255_255_255/0.4)] backdrop-blur-md">
        <Icon className="size-7 text-white drop-shadow" strokeWidth={1.75} />
      </span>
    </div>
  );
}
