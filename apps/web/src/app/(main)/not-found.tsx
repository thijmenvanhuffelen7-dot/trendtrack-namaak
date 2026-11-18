import { NotFoundBody } from "@/components/site/not-found-body";
import { cabinet, satoshi } from "../fonts";

export const metadata = { title: "Niet gevonden · TrendTrack", robots: { index: false } };

/** 404 binnen het dashboard (bijv. een onbekende shop, folder of e-mail). */
export default function NotFound() {
  return (
    <div className={`site ${satoshi.variable} ${cabinet.variable} min-h-screen py-2`}>
      <NotFoundBody dashboard />
    </div>
  );
}
