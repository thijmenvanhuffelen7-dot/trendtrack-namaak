import { API_RATE_LIMITS, PLANS } from "@trendtrack/core";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ENDPOINTS, buildOpenApi } from "@/lib/api/openapi";
import { siteUrl } from "@/lib/server/session";

export const metadata: Metadata = {
  title: "API-documentatie · TrendTrack",
  description:
    "REST API voor webshops, ads en e-mails in de Benelux. Authenticatie, limieten, endpoints en voorbeelden.",
};

type Param = {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema: Record<string, unknown>;
};

function typeOf(schema: Record<string, unknown>): string {
  if (Array.isArray(schema.enum))
    return (schema.enum as unknown[]).map((v) => JSON.stringify(v)).join(" | ");
  if (Array.isArray(schema.anyOf))
    return (schema.anyOf as Record<string, unknown>[]).map(typeOf).join(" | ");
  const t = schema.type;
  return Array.isArray(t) ? t.join(" | ") : String(t ?? "any");
}

/** Leesbare API-docs, gegenereerd uit dezelfde spec als /api/v1/openapi.json. */
export default async function ApiDocsPage() {
  const origin = siteUrl(await headers());
  const spec = buildOpenApi(origin);
  const base = `${origin}/api/v1`;
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <p className="text-sm font-semibold tracking-tight">TrendTrack</p>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">API-documentatie</h1>
      <p className="mt-2 text-muted-foreground">
        Versie {spec.info.version}. Machineleesbaar:{" "}
        <a href="/api/v1/openapi.json" className="underline underline-offset-2">
          openapi.json
        </a>{" "}
        (OpenAPI 3.1, te importeren in Postman of Insomnia).
      </p>

      <section className="mt-10 space-y-4 text-[15px] leading-relaxed">
        <h2 className="text-xl font-semibold">Beginnen</h2>
        <p>
          Maak een API-key op{" "}
          <Link href="/app/api" className="underline underline-offset-2">
            /app/api
          </Link>{" "}
          en stuur hem mee als Bearer-token. De key zie je één keer; bewaar hem als een wachtwoord.
        </p>
        <pre className="overflow-x-auto rounded-2xl border border-border bg-muted p-4 text-sm">{`curl ${base}/shops?country=NL \\
  -H "Authorization: Bearer tt_live_..."`}</pre>

        <h2 className="pt-4 text-xl font-semibold">Plannen en limieten</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1 font-medium">Plan</th>
              <th className="font-medium">Calls per maand (API + MCP)</th>
              <th className="font-medium">Per seconde</th>
              <th className="font-medium">Per dag</th>
            </tr>
          </thead>
          <tbody>
            {(["pro", "agency"] as const).map((p) => (
              <tr key={p} className="border-t border-border">
                <td className="py-1">{PLANS[p].name}</td>
                <td className="tabular">
                  {PLANS[p].limits.apiCallsPerMonth?.toLocaleString("nl-NL")}
                </td>
                <td className="tabular">{API_RATE_LIMITS[p].perSecond}</td>
                <td className="tabular">{API_RATE_LIMITS[p].perDay.toLocaleString("nl-NL")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Elke response heeft de headers <code>x-ratelimit-remaining</code> (vandaag) en{" "}
          <code>x-quota-remaining</code> (deze maand). Bij te veel requests krijg je{" "}
          <code>429</code> met <code>retry-after</code>; is je maandquotum op of zit de API niet in
          je plan, dan <code>402</code> met uitleg en een upgrade-link.
        </p>

        <h2 className="pt-4 text-xl font-semibold">Schattingen</h2>
        <p>
          Omzet, bestellingen en ad spend zijn <strong>schattingen</strong>. Ze komen altijd als
          bandbreedte met <code>estimate: true</code>, bijvoorbeeld{" "}
          <code>{`{"low": 18000, "mid": 26000, "high": 37000, "confidence": 0.45, "currency": "EUR", "estimate": true}`}</code>
          . Hoe we schatten staat op{" "}
          <Link href="/schattingen" className="underline underline-offset-2">
            /schattingen
          </Link>
          .
        </p>

        <h2 className="pt-4 text-xl font-semibold">Paginering en fouten</h2>
        <p>
          Lijsten geven <code>{`{ data, total, next_cursor }`}</code>. Geef <code>next_cursor</code>{" "}
          mee als <code>cursor</code> tot hij <code>null</code> is. Fouten hebben altijd de vorm{" "}
          <code>{`{ "error": { "code", "message", "details" } }`}</code>.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Endpoints</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {ENDPOINTS.map((e) => (
            <li key={e.method + e.path}>
              <a
                href={`#${e.method}-${e.path}`}
                className="font-mono underline-offset-2 hover:underline"
              >
                {e.method.toUpperCase()} {e.path}
              </a>{" "}
              <span className="text-muted-foreground">· {e.summary}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 space-y-12">
          {ENDPOINTS.map((e) => {
            const op = (spec.paths[e.path] as Record<string, { parameters: Param[] }>)[e.method]!;
            const curl =
              e.method === "post"
                ? `curl -X POST ${base}${e.path} \\\n  -H "Authorization: Bearer tt_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '${e.example}'`
                : `curl "${base}${e.example}" \\\n  -H "Authorization: Bearer tt_live_..."`;
            return (
              <article key={e.method + e.path} id={`${e.method}-${e.path}`} className="scroll-mt-6">
                <h3 className="font-mono text-lg">
                  <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-sm">
                    {e.method.toUpperCase()}
                  </span>
                  {e.path}
                </h3>
                <p className="mt-2 text-[15px]">{e.description}</p>
                {op.parameters.length > 0 && (
                  <table className="mt-4 w-full text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <th className="py-1 font-medium">Parameter</th>
                        <th className="font-medium">Type</th>
                        <th className="font-medium">Uitleg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {op.parameters.map((p) => (
                        <tr key={p.name} className="border-t border-border align-top">
                          <td className="py-1.5 pr-3 font-mono">
                            {p.name}
                            {p.required && <span className="text-danger">*</span>}
                            {p.in === "path" && (
                              <span className="ml-1 text-xs text-muted-foreground">(pad)</span>
                            )}
                          </td>
                          <td className="py-1.5 pr-3 font-mono text-xs text-muted-foreground">
                            {typeOf(p.schema)}
                            {p.schema.default !== undefined &&
                              ` = ${JSON.stringify(p.schema.default)}`}
                          </td>
                          <td className="py-1.5">{p.description ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <pre className="mt-4 overflow-x-auto rounded-2xl border border-border bg-muted p-4 text-sm">
                  {curl}
                </pre>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
