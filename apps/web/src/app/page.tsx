import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-4">
      <h1 className="text-3xl font-semibold tracking-tight">TrendTrack Benelux</h1>
      <p className="text-muted-foreground">
        Shops, ads en e-mails van NL/BE-webshops op één plek. De publieke site komt in Prompt 13.
      </p>
      <div>
        <Link href="/login" className={buttonVariants()}>
          Inloggen
        </Link>
      </div>
    </main>
  );
}
