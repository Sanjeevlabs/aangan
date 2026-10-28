"use client";

import { useEffect, useState } from "react";
import { usePlayer } from "@/components/player";
import { useShell } from "@/components/shell";
import { useViewer } from "@/components/viewer";
import { strings } from "@/lib/i18n";
import type { Card, Member, RitualRun, Wish } from "@/lib/schemas";
import { buildReelSegments, reelTitle, type ReelSegment } from "@/lib/reel";

// Petals: small falling dots over the reel. Pure CSS, still under
// prefers-reduced-motion (global rule kills the animation).
function Petals() {
  const petals = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {petals.map((i) => (
        <span
          key={i}
          className="reel-petal absolute top-0 inline-block h-2 w-2 rounded-full"
          style={{
            left: `${(i * 83) % 100}%`,
            background: i % 2 === 0 ? "#FDBA74" : "#E2D9CE",
            animationDelay: `${(i * 0.7) % 4}s`,
            animationDuration: `${4 + ((i * 37) % 30) / 10}s`,
          }}
        />
      ))}
      <style>{`.reel-petal{animation:reel-fall 5s linear infinite}@keyframes reel-fall{from{transform:translateY(-12px) rotate(0)}to{transform:translateY(420px) rotate(220deg)}}`}</style>
    </div>
  );
}

export function ReelPlayer({ runId }: { runId: string }) {
  const { lang, viewer, displayLang } = useViewer();
  const { play } = usePlayer();
  const { openAdd } = useShell();
  const t = strings(lang);
  const [run, setRun] = useState<RitualRun | null>(null);
  const [segments, setSegments] = useState<ReelSegment[] | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [kinship, setKinship] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([
      fetch("/api/ritual-runs", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/wishes?runId=${encodeURIComponent(runId)}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/cards", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/members", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([runsData, wishesData, cardsData, membersData]: [
        { runs?: RitualRun[] } | null,
        { wishes?: Wish[] } | null,
        { cards?: Card[] } | null,
        { members?: Member[] } | null,
      ]) => {
        if (!live) return;
        const found = runsData?.runs?.find((r) => r.id === runId) ?? null;
        setRun(found);
        const ws: Wish[] = wishesData?.wishes ?? [];
        const cs: Card[] = cardsData?.cards ?? [];
        const ms: Member[] = membersData?.members ?? [];
        setCards(cs);
        setMembers(ms);
        if (found) {
          setSegments(buildReelSegments(found, ws, cs, ms));
          const celebrant = celebrantOf(found, ms);
          if (celebrant && celebrant.id !== viewer.id) {
            fetch(`/api/kinship?from=${viewer.id}&to=${celebrant.id}&lang=${displayLang}`, { cache: "no-store" })
              .then((r) => (r.ok ? r.json() : null))
              .then((data: { terms?: string } | null) => {
                if (live) setKinship(data?.terms ?? null);
              })
              .catch(() => undefined);
          }
        } else {
          setSegments([]);
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [runId, viewer.id, displayLang]);

  if (failed) {
    return (
      <div className="rounded-card border border-line bg-surface p-5" role="alert">
        <p className="m-0 text-[15px]">{t.common.retry}</p>
      </div>
    );
  }
  if (segments === null || !run) {
    return (
      <div aria-busy="true" aria-label="Loading">
        <div className="skeleton mb-2 h-8 w-2/3" />
        <div className="skeleton h-64" />
      </div>
    );
  }
  if (segments.length === 0) {
    return <p className="text-[15px] text-ink-soft">Wishes are still arriving — check back soon.</p>;
  }

  const current = segments[Math.min(index, segments.length - 1)];
  const celebrantName = celebrantOf(run, members)?.displayName ?? "birthday star";

  return (
    <div className="relative overflow-hidden rounded-card bg-[var(--player-ground)] p-5 text-[var(--player-ink)]">
      <Petals />
      <h2 className="serif relative m-0 text-2xl leading-tight">{reelTitle(celebrantName, kinship)}</h2>
      {/* Segmented progress */}
      <div className="relative mt-3 flex gap-1" aria-hidden="true">
        {segments.map((s, i) => (
          <span
            key={s.wish.id}
            className="h-1 flex-1 rounded-full"
            style={{ background: i <= index ? "#FDBA74" : "rgba(253,186,116,0.35)" }}
          />
        ))}
      </div>
      <div className="relative mt-4">
        <p className="m-0 text-[13px] font-semibold text-[var(--player-muted)]">
          {current.wish.kind === "blessing" ? t.reactions.bless : t.reactions.love} · {current.member?.displayName ?? "Family"}
        </p>
        {current.card ? (
          <div className="mt-2">
            <p className="serif m-0 text-lg leading-snug">{current.card.caption || current.card.transcript}</p>
            <button
              type="button"
              onClick={() => play({ ...current.card as Card, peaks: current.card?.peaks ?? [] })}
              className="tap mt-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-lg text-ink"
              aria-label={t.player.play}
            >
              ▶
            </button>
          </div>
        ) : (
          <p className="serif mt-2 text-lg text-[var(--player-muted)]">A {current.wish.kind} from {current.member?.displayName ?? "family"} is on its way.</p>
        )}
      </div>
      <div className="relative mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="tap text-[15px] font-semibold text-[var(--player-wave)] disabled:opacity-40"
        >
          ← Prev
        </button>
        <button
          type="button"
          onClick={() => openAdd("voice", { runId, kind: viewer.role === "elder" ? "blessing" : "wish" })}
          className="tap text-[15px] font-semibold text-[var(--player-wave)]"
        >
          Reply with voice
        </button>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(segments.length - 1, i + 1))}
          disabled={index >= segments.length - 1}
          className="tap text-[15px] font-semibold text-[var(--player-wave)] disabled:opacity-40"
        >
          Next →
        </button>
      </div>
      <span className="sr-only">{cards.length} memories available</span>
    </div>
  );
}

// runId is "<slug>:<YYYY-MM-DD>". Birthday runs resolve the celebrant by
// matching the occasion month-day against member birthdays.
function celebrantOf(run: RitualRun, members: Member[]): Member | undefined {
  if (run.ritualSlug !== "birthday") return undefined;
  const mmdd = run.occasionDate.slice(5);
  return members.find((m) => m.birthday === mmdd);
}
