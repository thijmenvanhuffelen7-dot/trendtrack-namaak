import { PLANS } from "@trendtrack/core";
import { listConnectedClients } from "@trendtrack/db";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { CopyField } from "@/components/app/copy-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/format";
import { serviceDb } from "@/lib/server/db";
import { getPlan, getSession } from "@/lib/server/session";
import { revokeClientAction } from "./actions";

export const metadata = { title: "MCP-server · TrendTrack" };

const EXAMPLES = [
  "Welke NL-webshops in sieraden draaien de meeste ads die langer dan 30 dagen lopen?",
  "Wat is de geschatte omzet van zilverzand.nl en welke apps gebruiken ze?",
  "Volg bosbad.be en vertel me elke maandag wat er bij mijn gevolgde merken is veranderd.",
  "Welke welkomstmails sturen Belgische verzorgingsmerken en welke korting geven ze?",
];

export default async function McpPage() {
  const { workspace } = await getSession();
  const [plan, clients, locale] = await Promise.all([
    getPlan(),
    listConnectedClients(serviceDb(), workspace.id),
    getLocale(),
  ]);
  const url = `${(process.env.NEXT_PUBLIC_MCP_URL ?? "http://localhost:3333").replace(/\/$/, "")}/mcp`;
  const hasAccess = PLANS[plan.plan].limits.api;
  const cursorConfig = JSON.stringify({ mcpServers: { trendtrack: { url } } }, null, 2);

  return (
    <>
      <PageHeader
        title="MCP-server"
        description="Gebruik TrendTrack rechtstreeks in Claude, ChatGPT of Cursor. Je stelt een vraag in gewone taal; de AI haalt de data bij ons op."
        actions={
          <Link href="/app/api" className={buttonVariants({ variant: "outline" })}>
            API-keys
          </Link>
        }
      />
      {!hasAccess && (
        <p
          role="status"
          className="mb-5 rounded-md border border-border bg-muted px-3 py-2 text-sm"
        >
          De MCP-server zit in Pro en Agency.{" "}
          <Link href="/app/settings/billing" className="font-medium underline underline-offset-2">
            Bekijk plannen
          </Link>
        </p>
      )}

      <Card className="mb-6 p-4">
        <h2 className="text-sm font-medium">Server-URL</h2>
        <div className="mt-2 max-w-xl">
          <CopyField value={url} label="Server-URL" copyLabel="Kopiëren" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Inloggen gaat via OAuth: je logt in bij TrendTrack en geeft toestemming. Elke vraag telt
          mee in je maandquotum (samen met de API).
        </p>
      </Card>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Card className="p-4 text-sm">
          <h2 className="font-medium">Claude</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted-foreground">
            <li>Instellingen → Connectors → Custom connector toevoegen.</li>
            <li>Naam: TrendTrack. URL: de server-URL hierboven.</li>
            <li>Klik Verbinden, log in bij TrendTrack en kies Toestaan.</li>
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">
            Werkt in Claude op web, desktop en mobiel (Pro, Max, Team, Enterprise).
          </p>
        </Card>
        <Card className="p-4 text-sm">
          <h2 className="font-medium">ChatGPT</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted-foreground">
            <li>Instellingen → Apps &amp; Connectors → Geavanceerd: zet ontwikkelaarsmodus aan.</li>
            <li>Connector maken met de server-URL en authenticatie OAuth.</li>
            <li>Log in bij TrendTrack en kies Toestaan.</li>
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">
            Beschikbaarheid hangt af van je ChatGPT-abonnement.
          </p>
        </Card>
        <Card className="p-4 text-sm">
          <h2 className="font-medium">Cursor</h2>
          <p className="mt-2 text-muted-foreground">
            Zet dit in <code>~/.cursor/mcp.json</code>; Cursor opent de inlogpagina vanzelf:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-2 text-xs">{cursorConfig}</pre>
          <p className="mt-2 text-xs text-muted-foreground">
            Of zonder OAuth: header <code>Authorization: Bearer tt_live_...</code> met een API-key.
          </p>
        </Card>
      </div>

      <Card className="mb-8 p-4">
        <h2 className="text-sm font-medium">Voorbeeldvragen</h2>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {EXAMPLES.map((q) => (
            <li key={q}>“{q}”</li>
          ))}
        </ul>
      </Card>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Verbonden apps</h2>
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nog geen apps verbonden.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {clients.map((c) => (
              <li key={c.clientId} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="flex-1">
                  <span className="font-medium">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    Verbonden sinds {formatDateTime(c.since, locale)}
                  </span>
                </span>
                <form action={revokeClientAction}>
                  <input type="hidden" name="client_id" value={c.clientId} />
                  <Button type="submit" variant="ghost" size="sm">
                    Toegang intrekken
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
