import type { MetadataRoute } from "next";

/** Web-app-manifest: naam, kleuren en icoon als iemand TrendTrack op het beginscherm zet. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TrendTrack",
    short_name: "TrendTrack",
    description: "Omzet, Meta-ads en nieuwsbrieven van webshops in Nederland en België.",
    start_url: "/app/shops",
    display: "standalone",
    background_color: "#f3f3f0",
    theme_color: "#0b3a31",
    lang: "nl",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
      { src: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
  };
}
