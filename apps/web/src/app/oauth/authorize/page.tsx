import { PLANS } from "@trendtrack/core";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { validateAuthorize } from "@/lib/oauth/authorize";
import { serviceDb } from "@/lib/server/db";
import { getPlan, getSession } from "@/lib/server/session";
import { createUserClient } from "@/lib/supabase/server";
import { decideAction } from "./actions";

export const metadata: Metadata = { title: "Toegang geven · TrendTrack", robots: { index: false } };
export const dynamic = "force-dynamic";

/** OAuth-toestemmingsscherm voor MCP-clients (Claude, ChatGPT, Cursor, ...). */
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const check = await validateAuthorize(serviceDb(), sp);
  if (!check.ok) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-xl font-semibold">Kan niet verbinden</h1>
        <p className="mt-2 text-sm text-muted-foreground">{check.message}</p>
      </main>
    );
  }

  // Niet ingelogd: eerst inloggen en daarna terug naar dit scherm.
  const {
    data: { user },
  } = await (await createUserClient()).auth.getUser();
  if (!user) {
    const here = `/oauth/authorize?${new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => e[1] !== undefined))}`;
    redirect(`/login?next=${encodeURIComponent(here)}`);
  }
  const { workspace } = await getSession();
  const plan = await getPlan();
  const allowed = PLANS[plan.plan].limits.api;
  const { req } = check;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <p className="text-sm font-semibold tracking-tight">TrendTrack</p>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{req.clientName} wil verbinden</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dan kan {req.clientName} namens workspace{" "}
        <strong className="text-foreground">{workspace.name}</strong> shops, ads en e-mails
        opzoeken, domeinen laten ophalen en merken volgen in je Brandtracker. Elke vraag telt mee in
        je maandquotum.
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        Terug naar: {new URL(req.redirectUri).host}
      </p>
      {allowed ? (
        <form action={decideAction} className="mt-6 flex gap-2">
          {Object.entries(sp).map(([k, v]) =>
            v === undefined ? null : <input key={k} type="hidden" name={k} value={v} />,
          )}
          <Button type="submit" name="decision" value="allow">
            Toestaan
          </Button>
          <Button type="submit" name="decision" value="deny" variant="outline">
            Weigeren
          </Button>
        </form>
      ) : (
        <div className="mt-6 rounded-lg border border-border bg-muted p-4 text-sm">
          De MCP-server zit in Pro en Agency; je hebt nu {PLANS[plan.plan].name}.{" "}
          <Link href="/app/settings/billing" className={`${buttonVariants({ size: "sm" })} mt-3`}>
            Bekijk plannen
          </Link>
        </div>
      )}
    </main>
  );
}
