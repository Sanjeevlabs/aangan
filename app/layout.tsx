import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aangan — family closeness",
  description: "Memory Lane and Festive Rituals for distant families.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#7c2d12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
