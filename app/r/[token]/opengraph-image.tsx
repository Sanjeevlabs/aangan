import { ImageResponse } from "next/og";
import { COURSE_LOOK } from "@/components/recipe-art";
import { MARK_SVG } from "@/lib/og-mark";
import { getShare } from "@/lib/shares";

// The preview a chat app shows for a shared recipe link: the dish's name,
// whose kitchen it's from, and the first few ingredients. Only what the
// public page already shows; nothing about the family.

export const alt = "A family recipe, shared on Aangan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await getShare(token);
  const r = share?.snapshot;
  const look = r ? (COURSE_LOOK[r.course] ?? COURSE_LOOK.other) : COURSE_LOOK.other;
  const items = r ? r.ingredients.slice(0, 4).map((i) => i.item) : [];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: look.bg, padding: "64px 72px", fontFamily: "sans-serif" }}>
        <div style={{ position: "absolute", right: -80, top: -80, width: 420, height: 420, borderRadius: 420, background: look.accent, opacity: 0.18, display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 2, color: look.ink, textTransform: "uppercase", display: "flex" }}>{r ? `${look.label} · a family recipe` : "Aangan"}</div>
          <div style={{ fontSize: r && r.title.length > 28 ? 64 : 84, fontWeight: 700, color: "#111", lineHeight: 1.05, marginTop: 18, display: "flex", maxWidth: 1000 }}>{r ? r.title : "This recipe is no longer shared"}</div>
          {r && <div style={{ fontSize: 38, color: "#4a413a", marginTop: 18, display: "flex" }}>{`From ${r.from}’s kitchen`}</div>}
          {items.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", marginTop: 34 }}>
              {items.map((it, i) => (
                <div key={i} style={{ display: "flex", fontSize: 28, color: "#222", background: "rgba(255,255,255,.75)", borderRadius: 40, padding: "10px 24px", marginRight: 14, marginBottom: 12 }}>
                  {it}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MARK_SVG} width={64} height={64} style={{ borderRadius: 16 }} alt="" />
            <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: "#111", marginLeft: 18 }}>Aangan</div>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#fff", background: "#111", borderRadius: 40, padding: "14px 30px" }}>Start your family on Aangan</div>
        </div>
      </div>
    ),
    size,
  );
}
