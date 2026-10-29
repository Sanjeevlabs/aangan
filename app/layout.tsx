import type { Metadata, Viewport } from "next";
import { Literata, Onest } from "next/font/google";
import { Providers } from "@/components/providers";
import { Shell } from "@/components/shell";
import "./globals.css";

const onest = Onest({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const literata = Literata({ subsets: ["latin"], style: ["italic"], weight: ["400", "500"], variable: "--font-voice", display: "swap" });

export const metadata: Metadata = {
  title: "Aangan — the family courtyard",
  description: "Far apart, still together. A family courtyard for voices, memories, and rituals.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${onest.variable} ${literata.variable}`}>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
