"use client";

import type { CSSProperties } from "react";
import { strings } from "@/lib/i18n";
import { resolveMediaUrl } from "@/lib/media-session";
import type { Card } from "@/lib/schemas";
import { useViewer } from "./viewer";

const FALLBACK_PALETTE = ["#c96f4a", "#e8a87c", "#f4d8b4"];

function Art({ card }: { card: Card }) {
  const url = resolveMediaUrl(card.mediaRef);
  const palette = card.palette.length >= 3 ? card.palette : FALLBACK_PALETTE;
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-full w-full object-cover" />;
  }
  const style = {
    background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]} 55%, ${palette[2]})`,
  } as CSSProperties;
  return (
    <div className="flex h-full w-full items-center justify-center" style={style} aria-hidden="true">
      {card.type === "audio" && card.peaks.length > 0 ? (
        <div className="flex h-12 items-center gap-[3px]">
          {card.peaks
            .filter((_, i) => i % 2 === 0)
            .slice(0, 18)
            .map((p, i) => (
              <span
                key={i}
                className="w-[3px] rounded-full bg-white/85"
                style={{ height: `${Math.max(6, Math.round(p * 44))}px` }}
              />
            ))}
        </div>
      ) : card.type === "video" ? (
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" opacity="0.9">
          <circle cx="12" cy="12" r="9" />
          <path d="M10 8.5v7l5.5-3.5z" fill="white" stroke="none" />
        </svg>
      ) : (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" opacity="0.9">
          <path d="M5 20v-8a7 7 0 0 1 14 0v8" />
          <rect x="3" y="20" width="18" height="2" rx="1" />
        </svg>
      )}
    </div>
  );
}

// Spotify-inspired square artwork card, artwork-tinted. Grounded model
// captions arrive in M2; M1 shows user/seed captions as-is.
export function MemoryCard({ card }: { card: Card }) {
  const { lang } = useViewer();
  const t = strings(lang);
  return (
    <article className="w-40">
      <div className="art-square bg-skeleton">
        <Art card={card} />
        {card.source === "glasses" && (
          <span className="glass glass-pill absolute left-2 top-2 px-3 py-1 text-[11px] font-semibold">
            {t.card.glassesBadge}
          </span>
        )}
      </div>
      <p className="serif mb-0 mt-2 line-clamp-2 text-[15px] leading-snug">{card.caption || t.card.untitled}</p>
    </article>
  );
}
