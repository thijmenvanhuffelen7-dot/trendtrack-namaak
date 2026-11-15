/** Instellingen van de publieke site. Contactadres en URL komen uit env zodat ze per omgeving kloppen. */
export const SITE = {
  name: "TrendTrack",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hallo@trendtrack.nl",
  city: "Utrecht",
};

export const NAV = [
  { href: "/tools", label: "Gratis tools" },
  { href: "/prijzen", label: "Prijzen" },
  { href: "/blog", label: "Blog" },
  { href: "/docs/api", label: "API" },
];
