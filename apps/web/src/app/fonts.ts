import localFont from "next/font/local";

// Satoshi (tekst) en Cabinet Grotesk (koppen) van Fontshare, gratis ook voor commercieel gebruik.
// Zelf gehost via next/font: geen externe request bij bezoekers. Gedeeld door de site en de loginpagina.
export const satoshi = localFont({
  src: [
    { path: "./fonts/satoshi-400.woff2", weight: "400" },
    { path: "./fonts/satoshi-500.woff2", weight: "500" },
    { path: "./fonts/satoshi-700.woff2", weight: "700" },
  ],
  variable: "--font-satoshi",
  display: "swap",
});

export const cabinet = localFont({
  src: [
    { path: "./fonts/cabinet-grotesk-500.woff2", weight: "500" },
    { path: "./fonts/cabinet-grotesk-700.woff2", weight: "700" },
    { path: "./fonts/cabinet-grotesk-800.woff2", weight: "800" },
  ],
  variable: "--font-cabinet",
  display: "swap",
});
