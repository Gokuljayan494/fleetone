import type { Metadata, Viewport } from "next";
import "./globals.css";
import { IconDefs } from "@/components/Icons";
import { InstallPWA } from "@/components/InstallPWA";

export const metadata: Metadata = {
  title: "FleetOne — Fleet Management",
  description: "Every vehicle, every rupee, one calm screen.",
  manifest: "/manifest.webmanifest",
  // Makes an installed icon on iOS launch full-screen, like a native app.
  appleWebApp: {
    capable: true,
    title: "FleetOne",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366F1",
  width: "device-width",
  initialScale: 1,
  // Let the driver app fill the screen edge-to-edge on notched phones.
  viewportFit: "cover",
};

const themeInit = `try{if(localStorage.getItem("theme")==="dark"||(!localStorage.getItem("theme")&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <IconDefs />
        {children}
        <InstallPWA />
      </body>
    </html>
  );
}
