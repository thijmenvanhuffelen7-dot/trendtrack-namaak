import Link from "next/link";

/** Kleine upgrade-melding in een formulier (bv. bij "Opslaan in folder" of "Volgen"). */
export function LimitInline({ message }: { message: string }) {
  return (
    <span role="alert" className="text-sm">
      {message}.{" "}
      <Link href="/app/settings/billing" className="font-medium underline underline-offset-2">
        →
      </Link>
    </span>
  );
}
