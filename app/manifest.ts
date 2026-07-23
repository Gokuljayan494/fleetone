import type { MetadataRoute } from "next";

/**
 * Web app manifest — this is what lets a driver "Add to Home Screen" and launch
 * FleetOne like an installed app (its own icon, no browser chrome). Served at
 * /manifest.webmanifest and linked from the document head automatically.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FleetOne — Fleet Management",
    short_name: "FleetOne",
    description: "Track your fleet, log trips and fuel, and run the whole operation from one screen.",
    // Opens the app; the session decides whether that lands on the owner
    // dashboard, the driver app, or the sign-in screen.
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B1020",
    theme_color: "#6366F1",
    categories: ["business", "productivity", "navigation"],
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
