import Link from "next/link";

export const metadata = { title: "Admin · TrendTrack", robots: { index: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
      </nav>
      {children}
    </div>
  );
}
