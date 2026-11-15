import { listSeedInboxes } from "@trendtrack/db";
import { Button } from "@/components/ui/button";
import { serviceDb } from "@/lib/server/db";
import { subscribeNow } from "./actions";
import { CreateInboxForm } from "./create-form";

export const dynamic = "force-dynamic";

export default async function InboxesPage() {
  const inboxes = await listSeedInboxes(serviceDb());
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Seed-inboxen</h1>
        <p className="text-sm text-muted-foreground">
          Maak een adres, schrijf je ermee in op de nieuwsbrief van de shop en klik direct op
          &quot;Ingeschreven&quot;. Zonder dat moment kunnen we welcome- en flowmails niet
          herkennen.
        </p>
      </header>
      <CreateInboxForm />
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-1">Shop</th>
            <th>Seed-adres</th>
            <th>Ingeschreven</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {inboxes.map((i) => (
            <tr key={i.address} className="border-t border-border">
              <td className="py-2">{i.shops.domain}</td>
              <td className="font-mono">{i.address}</td>
              <td>
                {i.subscribed_at ? (
                  new Date(i.subscribed_at).toLocaleString("nl-NL", {
                    timeZone: "Europe/Amsterdam",
                  })
                ) : (
                  <span className="text-amber-600">nog niet</span>
                )}
              </td>
              <td className="text-right">
                <form action={subscribeNow}>
                  <input type="hidden" name="domain" value={i.shops.domain} />
                  <Button type="submit" variant="outline" size="sm">
                    {i.subscribed_at ? "Opnieuw: nu" : "Ingeschreven"}
                  </Button>
                </form>
              </td>
            </tr>
          ))}
          {inboxes.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-muted-foreground">
                Nog geen seed-inboxen.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
