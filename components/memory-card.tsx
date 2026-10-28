"use client";

import { callName, cardCover, cardDuration, formatDuration, relativeDay, tintShadow } from "@/lib/people";
import type { Card } from "@/lib/schemas";
import { useDisplayText } from "@/lib/use-display-text";
import { cn } from "@/lib/utils";
import { usePlayer } from "./player";
import { Icon, LiveDot, Photo, PlayButton } from "./ui/kit";
import { useViewer } from "./viewer";

/** A voice note as a track: album art, who, their words, play. */
export function VoiceRow({ card, showAuthor = true }: { card: Card; showAuthor?: boolean }) {
  const { members, displayLang } = useViewer();
  const { play, current, isPlaying, toggle } = usePlayer();
  const { text } = useDisplayText(card.transcript || card.caption, card.transcript ? card.transcriptLang : card.lang, displayLang);
  const author = members.find((m) => m.id === card.authorId);
  const active = current?.id === card.id;
  return (
    <div className="flex items-center gap-3.5 py-2.5">
      <button
        type="button"
        onClick={() => (active ? toggle() : play(card))}
        aria-label={`Play ${callName(author)}'s voice note`}
        className="press relative h-16 w-16 shrink-0 overflow-hidden rounded-[16px] bg-surface"
        style={{ boxShadow: tintShadow(card, 0.35) }}
      >
        <Photo src={cardCover(card, members)} alt="" sizes="128px" position="center 30%" />
        <span className="glass absolute bottom-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full">
          <Icon name={active && isPlaying ? "pause" : "play"} size={12} />
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="m-0 flex items-center gap-1.5 text-[13px] text-ink-soft">
          {active && isPlaying && <LiveDot />}
          {showAuthor ? `${callName(author)} · ` : ""}
          {relativeDay(card.takenAt)}
        </p>
        <p className="voice m-0 line-clamp-2 text-[17px] leading-snug text-ink">{text ?? "…"}</p>
      </div>
      <span className="tnum shrink-0 text-[13px] text-ink-faint">{formatDuration(cardDuration(card))}</span>
    </div>
  );
}

/** A photo or video as a full-width card with a glass caption. */
export function PhotoCard({ card, tall = false }: { card: Card; tall?: boolean }) {
  const { members, displayLang } = useViewer();
  const { text, translated } = useDisplayText(card.caption, card.lang, displayLang);
  const author = members.find((m) => m.id === card.authorId);
  return (
    <figure className={cn("relative m-0 overflow-hidden rounded-card bg-surface", tall ? "h-[420px]" : "h-[300px]")} style={{ boxShadow: tintShadow(card, 0.45) }}>
      <Photo src={cardCover(card, members)} alt={text ?? "Family photo"} sizes="(max-width: 480px) 100vw, 440px" />
      {card.type === "video" && (
        <span className="glass absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-full">
          <Icon name="play" size={16} />
        </span>
      )}
      {card.source === "glasses" && <span className="glass absolute right-3 top-3 rounded-full px-3 py-1.5 text-[12px] font-medium">Captured hands-free</span>}
      <figcaption className="glass absolute inset-x-2.5 bottom-2.5 rounded-[18px] px-4 py-3">
        <p className="m-0 text-[13px] text-white/80">
          {callName(author)} · {relativeDay(card.takenAt)}
          {translated ? " · translated" : ""}
        </p>
        <p className="m-0 text-[17px] font-semibold leading-snug">{text || "Untitled moment"}</p>
      </figcaption>
    </figure>
  );
}

/** Legacy export kept for any remaining callers. */
export function MemoryCard({ card }: { card: Card; wide?: boolean }) {
  return card.type === "audio" ? <VoiceRow card={card} /> : <PhotoCard card={card} />;
}

export { PlayButton };
