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
              "flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              active
                ? "bg-muted font-medium text-foreground"
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
