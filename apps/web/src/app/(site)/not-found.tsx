import { NotFoundBody } from "@/components/site/not-found-body";

export const metadata = { title: "Pagina niet gevonden", robots: { index: false } };

/** 404 binnen de publieke site (bijv. een onbekend blogartikel of tool). */
export default function NotFound() {
  return <NotFoundBody />;
}
