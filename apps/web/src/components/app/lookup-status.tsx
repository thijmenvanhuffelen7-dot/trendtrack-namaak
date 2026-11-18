"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Ververst de pagina elke 3 seconden zolang de lookup loopt, zodat de status live meeloopt. */
export function LookupPending({
  title,
  body,
  note,
}: {
  title: string;
  body: string;
  note?: string | null;
}) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [router]);
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-border bg-card px-6 py-10 text-center"
    >
      <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" aria-hidden />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
      {note && <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
