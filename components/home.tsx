"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { demoShelf } from "@/lib/demo";
import { dailyRoleFor, daysUntilBirthday } from "@/lib/family";
import { SUPPORTED_LANGS, displayLangLabel, greetingForHour, normalizeDisplayLang, strings } from "@/lib/i18n";
import type { Card } from "@/lib/schemas";
import { formatHeardTime } from "@/lib/voice";
import { MemoryCard } from "./memory-card";
import { HeardChip } from "./reactions";
import { usePlayer } from "./player";
import { useShell } from "./shell";
import { PrimaryButton } from "./ui/buttons";
import { useViewer } from "./viewer";

function dateEyebrow(lang: string, now: Date): string {
  const locale = lang === "en" ? "en-US" : lang === "hi-latn" ? "en-IN" : "hi-IN";
  try {
    return new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }).format(now);
  } catch {
    return now.toDateString();
  }
}

function HeroWave({ peaks }: { peaks: number[] }) {
  const bars = (peaks.length > 0 ? peaks : new Array(24).fill(0.4)).slice(0, 28);
  return (
    <div className="flex h-10 items-center gap-[3px]" aria-hidden="true">
      {bars.map((p, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-white/90"
          style={{ height: `${Math.max(5, Math.round(Number(p) * 36))}px` }}
        />
      ))}
    </div>
  );
}

// One hero memory: full-width image, dark caption band with a serif quote,
// 44px round play button, white waveform, duration. Heard line below.
function HeroMemory({ card }: { card: Card }) {
  const { lang } = useViewer();
  const { play, current, isPlaying, toggle } = usePlayer();
  const { text } = useHeroCaption(card);
  const t = strings(lang);
  const active = current?.id === card.id && isPlaying;
  const palette = card.palette.length >= 3 ? card.palette : ["#4a3a2e", "#6b5544", "#8a7a68"];
  const duration = Math.max(8, card.segments.reduce((m, s) => Math.max(m, s.end), 12));

  return (
    <section aria-label={t.shelves.voices}>
      <div className="overflow-hidden rounded-card bg-ink">
        <div
          className="flex h-56 w-full items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]} 55%, ${palette[2]})` }}
          aria-hidden="true"
        >
          <HeroWave peaks={card.peaks} />
        </div>
        <div className="bg-[var(--player-ground)] px-4 py-4 text-[var(--player-ink)]">
          <p className="serif m-0 text-xl leading-snug">{text ?? card.caption}</p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => (current?.id === card.id ? toggle() : play(card))}
              aria-label={active ? t.player.pause : t.player.play}
              className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-lg text-ink"
            >
              {active ? "❚❚" : "▶"}
            </button>
            <div className="min-w-0 flex-1">
              <HeroWave peaks={card.peaks} />
            </div>
            <span className="shrink-0 text-[12px] tabular-nums text-[var(--player-muted)]">
              {Math.round(duration)}s
            </span>
          </div>
        </div>
      </div>
      <div className="mt-2">
        <HeardChip cardId={card.id} />
      </div>
    </section>
  );
}

import { useDisplayText } from "@/lib/use-display-text";

function useHeroCaption(card: Card): { text: string | null } {
  const { displayLang } = useViewer();
  const { text } = useDisplayText(card.transcript || card.caption, card.transcript ? card.transcriptLang : card.lang, displayLang);
  return { text };
}

function ProfileMenu() {
  const { viewer, members, displayLang, setDisplayLang, setViewerId } = useViewer();
  const { lang } = useViewer();
  const t = strings(lang);
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t.viewingAs}
        className="tap flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-lg"
      >
        <span aria-hidden="true">{viewer.displayName.slice(0, 1)}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 rounded-card border border-line bg-surface p-4 shadow-glass">
          <p className="m-0 mb-2 text-[13px] font-semibold text-ink-soft">{t.viewingAs}</p>
          <div className="mb-3 flex flex-col gap-1">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setViewerId(m.id);
                  setOpen(false);
                }}
                aria-pressed={m.id === viewer.id}
                className="tap px-2 py-1 text-left text-[15px]"
                style={{ fontWeight: m.id === viewer.id ? 700 : 400 }}
              >
                {m.displayName}
              </button>
            ))}
          </div>
          <label className="block text-[13px] font-semibold text-ink-soft" htmlFor="aangan-lang">
            {t.language}
          </label>
          <select
            id="aangan-lang"
            value={displayLang}
            onChange={(e) => void setDisplayLang(normalizeDisplayLang(e.target.value))}
            className="tap mt-1 w-full rounded-card border border-line bg-paper px-3 text-sm"
            aria-label={t.language}
          >
            {SUPPORTED_LANGS.map((code) => (
              <option key={code} value={code}>
                {displayLangLabel(code)}
              </option>
            ))}
          </select>
          <div className="mt-3 flex flex-col gap-1 border-t border-line pt-3">
            <Link href="/bond" className="tap px-2 py-1 text-[15px] font-semibold text-accent" onClick={() => setOpen(false)}>
              Family Bond
            </Link>
            <Link href="/privacy" className="tap px-2 py-1 text-[15px] font-semibold text-accent" onClick={() => setOpen(false)}>
              Privacy
            </Link>
            <Link href="/trace" className="tap px-2 py-1 text-[15px] font-semibold text-accent" onClick={() => setOpen(false)}>
              Agent trace
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function Home() {
  const { viewer, members, lang, displayLang } = useViewer();
  const { openAdd, refreshKey } = useShell();
  const t = strings(lang);
  const [now] = useState(() => new Date());
  const [hour] = useState(() => new Date().getHours());
  const [todayCards, setTodayCards] = useState<Card[] | null>(null);
  const [voiceCards, setVoiceCards] = useState<Card[]>([]);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetch("/api/cards", { cache: "no-store" });
      if (!res.ok) throw new Error("cards-fetch-failed");
      const data = (await res.json()) as { cards: Card[] };
      setTodayCards(data.cards.filter((c) => c.source === "today"));
      setVoiceCards(data.cards.filter((c) => c.type === "audio"));
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const role = viewer.role === "elder" ? dailyRoleFor(displayLang) : undefined;
  const coming = members
    .map((member) => ({ member, days: daysUntilBirthday(member.birthday) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 3);

  const hero: Card | undefined =
    voiceCards[0] ?? todayCards?.[0] ?? demoShelf("from-dadi")[0] ?? demoShelf("voices")[0];

  return (
    <div className="pt-2">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 text-[13px] font-medium text-ink-soft">{dateEyebrow(displayLang, now)}</p>
          <h1 className="serif m-0 mt-1 text-[38px] leading-[1.05]">
            {t.greeting[greetingForHour(hour)]}, {viewer.firstName}
          </h1>
        </div>
        <ProfileMenu />
      </div>

      <PrimaryButton className="mb-5 mt-4 w-full" onClick={() => openAdd("voice")}>
        {t.shelves.record}
      </PrimaryButton>

      {role && (
        <section aria-label={t.shelves.role} className="mb-5">
          <p className="serif m-0 rounded-card bg-surface px-4 py-3 text-lg leading-snug">{role}</p>
        </section>
      )}

      {hero && (
        <div className="mb-2">
          <HeroMemory card={hero} />
        </div>
      )}

      <section aria-label={t.shelves.today} className="mb-6 mt-4">
        <h2 className="mb-2 mt-0 text-xl">{t.shelves.today}</h2>
        {failed ? (
          <div className="rounded-card border border-line bg-surface p-5">
            <p className="m-0 text-[15px]" role="alert">
              {t.common.retry}
            </p>
            <button type="button" onClick={() => void load()} className="tap mt-2 font-semibold text-accent">
              {t.common.retry}
            </button>
          </div>
        ) : todayCards === null ? (
          <div className="flex gap-2" aria-busy="true" aria-label={t.add.processing}>
            <div className="skeleton h-40 flex-1" />
            <div className="skeleton h-40 flex-1" />
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => openAdd("photos")}
              aria-label={t.tabs.add}
              className="tap mb-2 flex w-full items-center justify-center gap-1 rounded-card border border-dashed border-ink/25 py-3 text-sm text-ink-soft"
            >
              <span className="text-xl leading-none" aria-hidden="true">
                +
              </span>
              <span>{t.tabs.add}</span>
            </button>
            {todayCards.length === 0 && <p className="mt-2 text-sm text-ink-soft">{t.empty.noToday}</p>}
            <div className="flex gap-3 overflow-x-auto pb-1">
              {todayCards.map((card) => (
                <MemoryCard key={card.id} card={card} />
              ))}
            </div>
          </div>
        )}
      </section>

      <section aria-label={t.shelves.yearsAgo} className="mb-6">
        <h2 className="mb-2 mt-0 text-xl">{t.shelves.yearsAgo}</h2>
        <div className="grid grid-cols-2 gap-3">
          {demoShelf("years-ago").map((card) => (
            <MemoryCard key={card.id} card={card} wide />
          ))}
        </div>
      </section>

      <section aria-label={t.shelves.comingUp} className="mb-6">
        <h2 className="mb-2 mt-0 text-xl">{t.shelves.comingUp}</h2>
        <div>
          {coming.map(({ member, days }) => (
            <div key={member.id} className="hairline-row">
              <span className="text-[15px]">
                {t.coming.birthday(member.displayName)}{" "}
                <span className="text-ink-soft">· {days === 0 ? t.coming.today : t.coming.inDays(days)}</span>
                {member.birthday ? (
                  <span className="text-ink-soft"> · {heardMonthDay(member.birthday, displayLang)}</span>
                ) : null}
              </span>
              <button type="button" onClick={() => openAdd("voice")} className="tap shrink-0 text-[15px] font-semibold text-accent">
                {t.shelves.sendWish}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function heardMonthDay(mmdd: string, lang: string): string {
  const [m, d] = mmdd.split("-").map(Number);
  try {
    return new Intl.DateTimeFormat(lang === "hi-deva" ? "hi-IN" : "en-US", { month: "short", day: "numeric" }).format(
      new Date(Date.UTC(2026, (m || 1) - 1, d || 1)),
    );
  } catch {
    return mmdd;
  }
}
