import type { Metadata } from "next";
import "./globals.css";
import { IconDefs } from "@/components/Icons";

export const metadata: Metadata = {
  title: "FleetOne — Fleet Management",
  description: "Every vehicle, every rupee, one calm screen.",
};

const themeInit = `try{if(localStorage.getItem("theme")==="dark"||(!localStorage.getItem("theme")&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <IconDefs />
        {children}
      </body>
    </html>
  );
}
