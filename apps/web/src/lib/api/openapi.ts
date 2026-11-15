import { API_RATE_LIMITS, PLANS } from "@trendtrack/core";
import { z } from "zod";
import {
  Ad,
  Advertiser,
  AdsQuery,
  AdvertisersQuery,
  Email,
  EmailsQuery,
  ErrorBody,
  ListEnvelope,
  Lookup,
  LookupBody,
  Product,
  ProductsQuery,
  ShopDetail,
  Shop,
  ShopsQuery,
} from "./schemas";

/** Beschrijving van alle endpoints. Bron voor /api/v1/openapi.json en /docs/api. */
export interface EndpointDoc {
  method: "get" | "post";
  path: string;
  summary: string;
  description: string;
  query?: z.ZodObject;
  pathParams?: { name: string; description: string; example: string }[];
  body?: z.ZodType;
  response: z.ZodType;
  status?: number;
  example: string;
}

export const ENDPOINTS: EndpointDoc[] = [
  {
    method: "get",
    path: "/shops",
    summary: "Shops zoeken",
    description:
      "Snelgroeiende webshops, met dezelfde filters als het dashboard. Standaard gesorteerd op groei.",
    query: ShopsQuery,
    response: ListEnvelope(Shop),
    example: "/shops?country=NL&niche=Kettingen&sort=revenue&limit=10",
  },
  {
    method: "get",
    path: "/shops/{domain}",
    summary: "Shop-detail",
    description:
      "Schattingen (omzet, bestellingen), tech (thema, apps), samenvatting van ads en e-mails en 30 dagen historie.",
    pathParams: [{ name: "domain", description: "Domein van de shop", example: "zilverzand.nl" }],
    response: ShopDetail,
    example: "/shops/zilverzand.nl",
  },
  {
    method: "get",
    path: "/shops/{domain}/products",
    summary: "Producten van een shop",
    description: "Producten uit de laatste crawl, nieuwste of duurste eerst.",
    pathParams: [{ name: "domain", description: "Domein van de shop", example: "zilverzand.nl" }],
    query: ProductsQuery,
    response: ListEnvelope(Product),
    example: "/shops/zilverzand.nl/products?sort=price",
  },
  {
    method: "get",
    path: "/ads",
    summary: "Ads zoeken",
    description:
      'Ads uit de officiële Meta Ad Library. `q` zoekt in de advertentietekst (websearch-syntax: `"gratis verzending"`, `korting OR sale`). Lang lopende ads (`min_days=30`) zijn vaak winnaars.',
    query: AdsQuery,
    response: ListEnvelope(Ad),
    example: "/ads?q=gratis%20verzending&country=NL&active=true&min_days=30",
  },
  {
    method: "get",
    path: "/ads/{id}",
    summary: "Eén ad",
    description: "Alle velden van één ad.",
    pathParams: [
      {
        name: "id",
        description: "Ad-id (uuid) uit /ads",
        example: "00000000-0000-0000-0000-000000000000",
      },
    ],
    response: Ad,
    example: "/ads/{id}",
  },
  {
    method: "get",
    path: "/advertisers",
    summary: "Adverteerders",
    description: "Facebook- en Instagram-pagina's, gesorteerd op actieve ads of totaal bereik.",
    query: AdvertisersQuery,
    response: ListEnvelope(Advertiser),
    example: "/advertisers?sort=reach",
  },
  {
    method: "get",
    path: "/advertisers/{id}",
    summary: "Eén adverteerder",
    description: "Tellingen, bereik en geschatte spend van één adverteerder.",
    pathParams: [
      {
        name: "id",
        description: "Adverteerder-id (uuid) uit /advertisers",
        example: "00000000-0000-0000-0000-000000000000",
      },
    ],
    response: Advertiser,
    example: "/advertisers/{id}",
  },
  {
    method: "get",
    path: "/emails",
    summary: "E-mails",
    description:
      "Nieuwsbrieven van webshops: welkomstmails, flows en campagnes. Zonder HTML; die bekijk je via `url`.",
    query: EmailsQuery,
    response: ListEnvelope(Email),
    example: "/emails?domain=zilverzand.nl&type=welcome",
  },
  {
    method: "post",
    path: "/lookups",
    summary: "Shop laten ophalen",
    description:
      "Zet een domein in de wachtrij. Meestal staat de shop er binnen een minuut; vraag daarna `shop_url` op.",
    body: LookupBody,
    response: Lookup,
    status: 202,
    example: '{"domain": "nieuwe-shop.nl"}',
  },
];

const jsonSchema = (s: z.ZodType, io: "input" | "output") =>
  z.toJSONSchema(s, { io, unrepresentable: "any", target: "draft-2020-12" }) as Record<
    string,
    unknown
  > & {
    properties?: Record<string, Record<string, unknown>>;
    required?: string[];
  };

function queryParameters(q: z.ZodObject) {
  const js = jsonSchema(q, "input");
  return Object.entries(js.properties ?? {}).map(([name, schema]) => {
    const { description, ...rest } = schema;
    return {
      name,
      in: "query",
      required: js.required?.includes(name) && rest.default === undefined,
      description,
      schema: rest,
    };
  });
}

const error = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

export function buildOpenApi(serverUrl: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const e of ENDPOINTS) {
    paths[e.path] ??= {};
    paths[e.path]![e.method] = {
      summary: e.summary,
      description: e.description,
      parameters: [
        ...(e.pathParams ?? []).map((p) => ({
          name: p.name,
          in: "path",
          required: true,
          description: p.description,
          schema: { type: "string", example: p.example },
        })),
        ...(e.query ? queryParameters(e.query) : []),
      ],
      ...(e.body
        ? {
            requestBody: {
              required: true,
              content: { "application/json": { schema: jsonSchema(e.body, "input") } },
            },
          }
        : {}),
      responses: {
        [String(e.status ?? 200)]: {
          description: "OK",
          content: { "application/json": { schema: jsonSchema(e.response, "output") } },
        },
        "400": error("Ongeldige parameters of body"),
        "401": error("API-key ontbreekt of is ongeldig"),
        "402": error("Plan zonder API-toegang, of het maandquotum is op"),
        ...(e.path.includes("{") ? { "404": error("Niet gevonden") } : {}),
        "429": error("Rate limit: te veel requests per seconde of per dag"),
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "TrendTrack Benelux API",
      version: "1.0.0",
      description: [
        "Data over webshops, ads en e-mails in de Benelux.",
        "",
        "**Authenticatie:** `Authorization: Bearer tt_live_...` (maak een key op /app/api).",
        `**Plannen:** Pro (${PLANS.pro.limits.apiCallsPerMonth} calls/maand, ${API_RATE_LIMITS.pro.perSecond}/s) en Agency (${PLANS.agency.limits.apiCallsPerMonth} calls/maand, ${API_RATE_LIMITS.agency.perSecond}/s). API en MCP delen het quotum.`,
        "**Schattingen:** omzet, bestellingen en ad spend zijn schattingen, altijd een bandbreedte met `estimate: true`.",
        "**Paginering:** geef `next_cursor` mee als `cursor` tot hij `null` is.",
      ].join("\n"),
    },
    servers: [{ url: `${serverUrl}/api/v1` }],
    security: [{ bearer: [] }],
    components: {
      securitySchemes: {
        bearer: { type: "http", scheme: "bearer", description: "API-key: tt_live_..." },
      },
      schemas: { Error: jsonSchema(ErrorBody, "output") },
    },
    paths,
  };
}
