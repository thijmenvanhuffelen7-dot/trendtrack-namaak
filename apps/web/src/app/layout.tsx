import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrendTrack Benelux",
  description: "Onderzoek en volg webshops, ads en e-mails in de Benelux.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
