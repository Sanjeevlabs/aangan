import type { Metadata, Viewport } from "next";
import { Kalam, Literata, Onest } from "next/font/google";
import { Providers } from "@/components/providers";
import { Shell } from "@/components/shell";
import "./globals.css";

const onest = Onest({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const literata = Literata({ subsets: ["latin"], style: ["italic"], weight: ["400", "500"], variable: "--font-voice", display: "swap" });
// Handwriting on printed photos (when, where, a note). Kalam covers Latin and Devanagari, so Hindi notes are handwritten too.
const kalam = Kalam({ subsets: ["latin", "devanagari"], weight: ["400"], variable: "--font-hand", display: "swap", preload: false });

export const metadata: Metadata = {
  title: "Aangan — far from home, never far from them",
  description: "A window into your parents' day, and theirs into yours. Voices, the light in the window, the family's occasions.",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icons/icon-192.png", sizes: "192x192" }, { url: "/icons/icon.svg", type: "image/svg+xml" }], apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Aangan", statusBarStyle: "black-translucent" },
  openGraph: { title: "Aangan", description: "Far from home. Never far from them.", images: ["/icons/icon-1024.png"] },
};

export const viewport: Viewport = {
  themeColor: "#2f5684",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${onest.variable} ${literata.variable} ${kalam.variable}`}>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
