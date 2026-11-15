import { listOptoutRequests } from "@trendtrack/db";
import { Button } from "@/components/ui/button";
import { serviceDb } from "@/lib/server/db";
import { decideOptout } from "./actions";

export const dynamic = "force-dynamic";

export default async function OptoutAdminPage() {
  const requests = await listOptoutRequests(serviceDb());
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Opt-out-verzoeken</h1>
        <p className="text-sm text-muted-foreground">
          Controleer of het e-mailadres bij het domein hoort (of mail de eigenaar) voor je
          goedkeurt. Goedkeuren verwijdert de shop met alle gegevens en kan niet ongedaan worden
          gemaakt.
        </p>
      </header>
      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">Geen verzoeken.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1">Domein</th>
              <th>E-mail</th>
              <th>Toelichting</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const emailDomain = r.email.split("@")[1]?.toLowerCase() ?? "";
              const matches = emailDomain === r.domain || emailDomain.endsWith(`.${r.domain}`);
              return (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="py-2 font-medium">{r.domain}</td>
                  <td className="py-2">
                    {r.email}
                    <span
                      className={`ml-2 text-xs ${matches ? "text-emerald-600" : "text-amber-600"}`}
                    >
                      {matches ? "zelfde domein" : "ander domein: navragen"}
                    </span>
                  </td>
                  <td className="max-w-xs py-2 whitespace-pre-wrap text-muted-foreground">
                    {r.reason ?? "–"}
                  </td>
                  <td className="py-2">
                    {r.status}
                    <div className="text-xs text-muted-foreground">
                      {new Date(r.decided_at ?? r.created_at).toLocaleDateString("nl-NL")}
                    </div>
                  </td>
                  <td className="py-2">
                    {r.status === "pending" && (
                      <form action={decideOptout} className="flex flex-wrap gap-2">
                        <input type="hidden" name="id" value={r.id} />
                        <input
                          name="note"
                          placeholder="Notitie"
                          aria-label={`Notitie bij ${r.domain}`}
                          className="h-8 w-32 rounded-md border bg-background px-2 text-xs"
                        />
                        <Button
                          type="submit"
                          name="decision"
                          value="approve"
                          size="sm"
                          className="bg-red-600 text-white hover:bg-red-700"
                        >
                          Verwijderen
                        </Button>
                        <Button
                          type="submit"
                          name="decision"
                          value="reject"
                          size="sm"
                          variant="outline"
                        >
                          Afwijzen
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
