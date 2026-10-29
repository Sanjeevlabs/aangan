"use client";

import { useMemo, useState } from "react";
import { AlbumCover, EVENT_LABEL } from "@/components/albums";
import { PhotoCard, VoiceRow } from "@/components/memory-card";
import { VideoPlaque } from "@/components/plaque";
import { useShell } from "@/components/shell";
import { Avatar, EmptyLine, MuseMark, RoomHeader } from "@/components/ui/kit";
import type { Album } from "@/lib/kinds";
import { postJson, useJson } from "@/lib/use-json";
import { useViewer } from "@/components/viewer";
import { callName, memberPhoto } from "@/lib/people";
import type { Card } from "@/lib/schemas";
import { useFamilyCards } from "@/lib/use-family";
import { cn } from "@/lib/utils";

function seasonOf(month: number): string {
  if (month <= 1 || month === 11) return "Winter";
  if (month <= 4) return "Spring";
  if (month <= 7) return "Summer";
  return "Autumn";
}

function chapterOf(takenAt: string): string {
  const d = new Date(takenAt);
  if (Number.isNaN(d.getTime())) return "Undated";
  return `${seasonOf(d.getMonth())} ${d.getFullYear()}`;
}

// Memory Lane: chapters by season, filtered by person (families remember by
// who, not by media type). One column so every photo gets the full width.
export default function LanePage() {
  const { members } = useViewer();
  const { refreshKey } = useShell();
  const { cards } = useFamilyCards(refreshKey);
  const [who, setWho] = useState<string | null>(null);
  const albumsQ = useJson<{ albums: Album[] }>(`/api/albums?k=${refreshKey}`);
  const [kind, setKind] = useState<Album["event"] | "all">("all");
  const [sorting, setSorting] = useState<string | null>(null);
  const albums = (albumsQ.data?.albums ?? []).filter((a) => a.cardIds.length >= 2);
  const kinds = Array.from(new Set(albums.map((a) => a.event)));
  const shownAlbums = albums.filter((a) => kind === "all" || a.event === kind);

  const chapters = useMemo(() => {
    if (!cards) return null;
    const list = who ? cards.filter((c) => c.authorId === who) : cards;
    const groups = new Map<string, Card[]>();
    for (const c of list) {
      const key = chapterOf(c.takenAt);
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    return Array.from(groups.entries());
  }, [cards, who]);

  return (
    <div>
      <RoomHeader title="Memory Lane" subtitle="Every voice and moment, by season" />

      {/* Albums Muse made from what's in the photos: weddings, pujas, festivals… */}
      {albums.length > 0 && cards && (
        <section aria-label="Albums" className="mb-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="m-0 text-[20px]">Albums</h2>
            <MuseMark>sorted by Muse</MuseMark>
          </div>
          {kinds.length > 1 && (
            <div className="no-scrollbar -mx-5 mb-3 flex gap-1.5 overflow-x-auto px-5" role="radiogroup" aria-label="Kind of album">
              {(["all", ...kinds] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={cn("press h-9 shrink-0 rounded-full px-3.5 text-[14px] font-medium", kind === k ? "bg-black text-white" : "bg-surface")}>
                  {k === "all" ? "All" : EVENT_LABEL[k]}
                </button>
              ))}
            </div>
          )}
          <div className="no-scrollbar -mx-5 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-1">
            {shownAlbums.map((a) => (
              <AlbumCover key={a.id} album={a} cards={cards} />
            ))}
          </div>
        </section>
      )}
      <button
        type="button"
        disabled={sorting === "busy"}
        onClick={async () => {
          setSorting("busy");
          const out = await postJson<{ filed: number }>("/api/albums", { action: "resort" });
          await albumsQ.reload();
          setSorting(out ? (out.filed ? `Muse sorted ${out.filed} older photo${out.filed > 1 ? "s" : ""}.` : "Everything is already sorted.") : "Couldn't sort right now.");
        }}
        className="mb-4 text-[13px] font-medium text-ink-soft underline underline-offset-2"
      >
        {sorting === "busy" ? "Sorting…" : sorting ?? "Sort my older photos into albums"}
      </button>
      <div className="no-scrollbar -mx-5 mb-2 flex gap-2 overflow-x-auto px-5" role="radiogroup" aria-label="Show memories from">
        <button
          type="button"
          role="radio"
          aria-checked={who === null}
          onClick={() => setWho(null)}
          className={cn("press h-11 shrink-0 rounded-full px-4 text-[15px] font-medium", who === null ? "bg-black text-white" : "bg-surface")}
        >
          Everyone
        </button>
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={who === m.id}
            onClick={() => setWho(m.id)}
            className={cn("press flex h-11 shrink-0 items-center gap-2 rounded-full pl-1 pr-4 text-[15px] font-medium", who === m.id ? "bg-black text-white" : "bg-surface")}
          >
            <Avatar src={memberPhoto(m)} name={callName(m)} size={34} />
            {callName(m)}
          </button>
        ))}
      </div>

      {chapters === null ? (
        <div className="mt-6 space-y-4" aria-busy="true" aria-label="Loading memories">
          <div className="skeleton h-[300px]" />
          <div className="skeleton h-16" />
        </div>
      ) : chapters.length === 0 ? (
        <EmptyLine>Nothing here yet. Memories appear as the family shares them.</EmptyLine>
      ) : (
        chapters.map(([chapter, list]) => (
          <section key={chapter} aria-label={chapter} className="mt-8">
            <h2 className="sticky top-0 z-10 -mx-5 m-0 mb-3 bg-white/85 px-5 py-2 text-[20px] backdrop-blur-md">{chapter}</h2>
            <div className="space-y-4">
              {list.map((c) => (c.type === "audio" ? <VoiceRow key={c.id} card={c} /> : c.type === "video" ? <VideoPlaque key={c.id} card={c} /> : <PhotoCard key={c.id} card={c} />))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
