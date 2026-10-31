"use client";

import { m, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { callName, memberPhoto } from "@/lib/people";
import type { Card, Member, RitualRun, Wish } from "@/lib/schemas";
import { usePlayer } from "./player";
import { Avatar, Icon, Photo } from "./ui/kit";

// The day itself: the person (or the family, on a festival), a quiet
// sparkle, and everyone who has wished so far. Tap a face to hear them.

const SPARKS = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  top: (i * 53 + 7) % 70,
  size: 3 + ((i * 7) % 4),
  delay: (i * 0.35) % 2.8,
}));

function Sparkle() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {SPARKS.map((s, i) => (
        <m.span
          key={i}
          className="absolute rounded-full bg-white"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, boxShadow: "0 0 10px 2px rgba(255,255,255,.7)" }}
          initial={{ opacity: 0, y: 0, scale: 0.4 }}
          animate={{ opacity: [0, 1, 0], y: -40, scale: [0.4, 1, 0.6] }}
          transition={{ duration: 2.6, delay: s.delay, repeat: 3, repeatDelay: 0.8, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

export function OccasionCelebration({
  title,
  person,
  members,
  viewer,
  run,
  wishes,
  cards,
  onWish,
}: {
  title: string;
  person: Member | null;
  members: Member[];
  viewer: Member;
  run: RitualRun | null;
  wishes: Wish[];
  cards: Card[];
  onWish: () => void;
}) {
  const reduce = useReducedMotion();
  const { play } = usePlayer();
  const wished = Array.from(new Map(wishes.map((w) => [w.memberId, w] as const)).values());
  const wishers = wished.map((w) => ({ wish: w, member: members.find((x) => x.id === w.memberId) })).filter((x): x is { wish: Wish; member: Member } => Boolean(x.member));
  const expected = members.filter((x) => x.id !== person?.id);
  const everyone = expected.length > 0 && expected.every((x) => wishers.some((w) => w.member.id === x.id));
  const name = person ? callName(person) : "the family";
  const mine = person?.id === viewer.id;
  const iWished = wishers.some((w) => w.member.id === viewer.id);
  const line = wishers.length === 0 ? (mine ? "Wishes will arrive here today." : `Be the first to wish ${name}.`) : everyone ? `Everyone wished ${mine ? "you" : name}` : `${wishers.length} wished ${mine ? "you" : name}`;

  return (
    <m.article
      aria-label={`Today: ${title}`}
      className="relative h-[340px] overflow-hidden rounded-hero bg-[#111] text-white"
      style={{ boxShadow: "0 24px 50px -24px rgba(0,0,0,.6)" }}
      initial={reduce ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Photo src={memberPhoto(person) ?? "/demo/family-group.webp"} alt="" sizes="(max-width: 480px) 100vw, 440px" priority position="center 30%" />
      <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,0)_35%,rgba(0,0,0,.65))]" aria-hidden="true" />
      <Sparkle />
      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[12px] font-semibold text-black">
        <Icon name="sparkle" size={14} />
        Today
      </div>
      <div className="glass absolute inset-x-2.5 bottom-2.5 rounded-[22px] p-4">
        <p className="m-0 text-[22px] font-bold leading-tight">{mine ? "Happy birthday to you" : title}</p>
        <div className="mt-2 flex items-center gap-2">
          {wishers.length > 0 && (
            <div className="flex -space-x-2">
              {wishers.slice(0, 6).map(({ wish, member }) => {
                const card = wish.cardId ? cards.find((c) => c.id === wish.cardId) : undefined;
                return (
                  <button key={wish.id} type="button" disabled={!card} onClick={() => card && play(card)} aria-label={card ? `Play ${callName(member)}'s wish` : `${callName(member)} wished`} className="press rounded-full ring-2 ring-black/40">
                    <Avatar src={memberPhoto(member)} name={callName(member)} size={30} />
                  </button>
                );
              })}
              {wishers.length > 6 && <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-white/20 text-[11px] font-semibold ring-2 ring-black/40">+{wishers.length - 6}</span>}
            </div>
          )}
          <p className="m-0 min-w-0 flex-1 text-[14px] text-white/85">{line}</p>
        </div>
        <div className="mt-3 flex gap-2">
          {!mine && !iWished && (
            <button type="button" onClick={onWish} className="press flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white text-[15px] font-semibold text-black">
              <Icon name="mic" size={18} />
              {viewer.role === "elder" ? "Bless" : "Wish"} {person ? name : ""}
            </button>
          )}
          {run && (wishers.length > 0 || run.status === "delivered") && (
            <Link href={`/reel/${encodeURIComponent(run.id)}`} aria-label="Play everyone's wishes together" className={`press flex h-11 items-center justify-center gap-2 rounded-full bg-white/20 px-4 text-[15px] font-semibold text-white no-underline ${mine || iWished ? "flex-1" : ""}`}>
              <Icon name="play" size={16} />
              {mine || iWished ? "Play all wishes" : null}
            </Link>
          )}
        </div>
      </div>
    </m.article>
  );
}
