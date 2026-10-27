"use client";

import { useCallback, useEffect, useState } from "react";
import { demoShelf } from "@/lib/demo";
import { dailyRoleFor, daysUntilBirthday } from "@/lib/family";
import { SUPPORTED_LANGS, displayLangLabel, normalizeDisplayLang, strings } from "@/lib/i18n";
import type { Card } from "@/lib/schemas";
import { MemoryCard } from "./memory-card";
import { useShell } from "./shell";
import { GlassPanel } from "./ui/glass";
import { PrimaryButton } from "./ui/buttons";
import { useViewer } from "./viewer";

function ShelfTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-0 text-xl font-normal">{children}</h2>;
}

export function Home() {
  const { viewer, members, lang, displayLang, setDisplayLang, setViewerId } = useViewer();
  const { openAdd, refreshKey } = useShell();
  const t = strings(lang);
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

  const cycleViewer = () => {
    const idx = members.findIndex((m) => m.id === viewer.id);
    setViewerId(members[(idx + 1) % members.length].id);
  };

  const elder = members.find((m) => m.role === "elder");
  const role = viewer.role === "elder" ? dailyRoleFor(displayLang) : undefined;
  const coming = members
    .map((m) => ({ member: m, days: daysUntilBirthday(m.birthday) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 3);

  return (
    <div className="pt-2">
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="serif m-0 text-2xl">Aangan</p>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="aangan-lang">
            {t.language}
          </label>
          <select
            id="aangan-lang"
            value={displayLang}
            onChange={(e) => void setDisplayLang(normalizeDisplayLang(e.target.value))}
            className="tap rounded-pill border border-line bg-surface/70 px-3 text-sm"
            aria-label={t.language}
          >
            {SUPPORTED_LANGS.map((code) => (
              <option key={code} value={code}>
                {displayLangLabel(code)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={cycleViewer}
            className="tap rounded-pill border border-line bg-surface/70 px-4 text-sm"
            aria-label={`${t.viewingAs}: ${viewer.displayName}`}
          >
            {t.viewingAs}: {viewer.displayName}
          </button>
        </div>
      </div>

      <PrimaryButton className="mb-6 w-full" onClick={() => openAdd("voice")}>
        {t.shelves.record}
      </PrimaryButton>

      {viewer.role === "elder" && role && (
        <section aria-label={t.shelves.role} className="mb-6">
          <ShelfTitle>{t.shelves.role}</ShelfTitle>
          <GlassPanel className="p-5">
            <p className="serif m-0 text-lg leading-snug">{role}</p>
            <button
              type="button"
              onClick={() => openAdd("voice")}
              className="tap mt-3 rounded-pill bg-espresso px-5 text-sm font-semibold text-espresso-ink"
            >
              {t.shelves.record}
            </button>
          </GlassPanel>
        </section>
      )}

      {viewer.role !== "elder" && (
        <section aria-label={t.shelves.fromElder(elder?.displayName ?? "Dadi")} className="mb-6">
          <ShelfTitle>{t.shelves.fromElder(elder?.displayName ?? "Dadi")}</ShelfTitle>
          <div className="shelf">
            {demoShelf("from-dadi").map((card) => (
              <MemoryCard key={card.id} card={card} />
            ))}
          </div>
        </section>
      )}

      <section aria-label={t.shelves.voices} className="mb-6">
        <ShelfTitle>{t.shelves.voices}</ShelfTitle>
        <div className="shelf">
          {demoShelf("voices").map((card) => (
            <MemoryCard key={card.id} card={card} />
          ))}
          {voiceCards.map((card) => (
            <MemoryCard key={card.id} card={card} />
          ))}
        </div>
      </section>

      <section aria-label={t.shelves.today} className="mb-6">
        <ShelfTitle>{t.shelves.today}</ShelfTitle>
        {failed ? (
          <GlassPanel className="p-5">
            <p className="m-0 text-[15px]" role="alert">
              {t.common.retry}
            </p>
            <button type="button" onClick={() => void load()} className="tap mt-2 font-semibold text-accent">
              {t.common.retry}
            </button>
          </GlassPanel>
        ) : todayCards === null ? (
          <div className="shelf" aria-busy="true" aria-label={t.add.processing}>
            <div className="skeleton h-40 w-40" />
            <div className="skeleton h-40 w-40" />
          </div>
        ) : (
          <div className="shelf">
            <button
              type="button"
              onClick={() => openAdd("photos")}
              aria-label={t.tabs.add}
              className="tap flex h-40 w-40 flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed border-ink/20 text-ink-soft"
            >
              <span className="text-3xl leading-none" aria-hidden="true">
                +
              </span>
              <span className="text-sm">{t.tabs.add}</span>
            </button>
            {todayCards.map((card) => (
              <MemoryCard key={card.id} card={card} />
            ))}
          </div>
        )}
        {todayCards !== null && todayCards.length === 0 && !failed && (
          <p className="mt-2 text-sm text-ink-soft">{t.empty.noToday}</p>
        )}
      </section>

      <section aria-label={t.shelves.yearsAgo} className="mb-6">
        <ShelfTitle>{t.shelves.yearsAgo}</ShelfTitle>
        <div className="shelf">
          {demoShelf("years-ago").map((card) => (
            <MemoryCard key={card.id} card={card} />
          ))}
        </div>
      </section>

      <section aria-label={t.shelves.comingUp} className="mb-6">
        <ShelfTitle>{t.shelves.comingUp}</ShelfTitle>
        <div className="flex flex-col gap-2">
          {coming.map(({ member, days }) => (
            <GlassPanel key={member.id} className="flex items-center justify-between px-5 py-3">
              <span className="text-[15px]">{t.coming.birthday(member.displayName)}</span>
              <span className="text-sm font-semibold text-accent">
                {days === 0 ? t.coming.today : t.coming.inDays(days)}
              </span>
            </GlassPanel>
          ))}
        </div>
      </section>
    </div>
  );
}
