import { ImageResponse } from "next/og";
import { MARK_SVG } from "@/lib/og-mark";

// The preview for aangan's home page (rendered once at build time).

export const alt = "Aangan: far from home, never far from them";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", background: "linear-gradient(135deg, #1c1712 0%, #2f2418 55%, #2f5684 140%)", padding: "0 96px", fontFamily: "sans-serif" }}>
        <div style={{ position: "absolute", left: 120, top: 120, width: 380, height: 380, borderRadius: 380, background: "rgba(255,190,96,.22)", display: "flex" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MARK_SVG} width={260} height={260} style={{ borderRadius: 60, boxShadow: "0 30px 60px rgba(0,0,0,.45)" }} alt="" />
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 72 }}>
          <div style={{ display: "flex", fontSize: 104, fontWeight: 700, color: "#fff6e6", lineHeight: 1 }}>Aangan</div>
          <div style={{ display: "flex", fontSize: 40, color: "rgba(255,246,230,.9)", marginTop: 22, maxWidth: 720, lineHeight: 1.2 }}>Far from home. Never far from them.</div>
          <div style={{ display: "flex", fontSize: 28, color: "rgba(255,214,144,.9)", marginTop: 28, maxWidth: 660 }}>Voices, recipes and stories, kept by the family.</div>
        </div>
      </div>
    ),
    size,
  );
}
