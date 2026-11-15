import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/server/session";

export const metadata = { title: "Admin · TrendTrack", robots: { index: false } };

/** Alleen voor gebruikers met profiles.is_admin. Anderen krijgen een 404 (we verklappen niet dat /admin bestaat). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin } = await getSession();
  if (!isAdmin) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <nav className="mb-6 flex gap-4 border-b border-border pb-3 text-sm">
        <span className="font-semibold">Admin</span>
        <Link href="/admin/jobs" className="text-muted-foreground hover:text-foreground">
          Jobs
        </Link>
        <Link href="/admin/inboxes" className="text-muted-foreground hover:text-foreground">
          Seed-inboxen
        </Link>
        <Link href="/admin/opt-out" className="text-muted-foreground hover:text-foreground">
          Opt-out
        </Link>
        <Link href="/app/shops" className="ml-auto text-muted-foreground hover:text-foreground">
          ← Dashboard
        </Link>
      </nav>
      {children}
    </div>
  );
}
