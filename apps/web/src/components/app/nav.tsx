"use client";

import {
  BookMarked,
  Building2,
  Code2,
  Megaphone,
  Mail,
  Radar,
  Settings,
  ShieldCheck,
  Store,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/app/shops", key: "shops", icon: Store },
  { href: "/app/ads", key: "ads", icon: Megaphone },
  { href: "/app/advertisers", key: "advertisers", icon: Building2 },
  { href: "/app/emails", key: "emails", icon: Mail },
  { href: "/app/brandtracker", key: "brandtracker", icon: Radar },
  { href: "/app/folders", key: "folders", icon: BookMarked },
  { href: "/app/api", key: "api", icon: Code2 },
  { href: "/app/settings", key: "settings", icon: Settings },
] as const;

export function AppNav({
  isAdmin,
  orientation,
}: {
  isAdmin: boolean;
  orientation: "vertical" | "horizontal";
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const items = isAdmin
    ? [...ITEMS, { href: "/admin", key: "admin", icon: ShieldCheck } as const]
    : ITEMS;
  return (
    <nav
      className={cn(
        "flex gap-1",
        orientation === "vertical" ? "flex-col" : "overflow-x-auto px-4 py-2",
      )}
      aria-label="Hoofdmenu"
    >
      {items.map(({ href, key, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors",
              orientation === "vertical"
                ? active
                  ? "bg-[#ecefed] font-medium text-[#0f1412] shadow-[0_1px_2px_rgb(0_0_0/0.2)]"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
                : active
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
