"use client";

import { useEffect, useMemo, useState } from "react";
import { demoShelf } from "@/lib/demo";
import { strings } from "@/lib/i18n";
import type { Card } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { useDisplayText } from "@/lib/use-display-text";
import { MemoryCard } from "@/components/memory-card";
import { useViewer } from "@/components/viewer";

type Chip = "all" | "voices" | "rituals" | "bonds";

const CHIP_KEYS: Chip[] = ["all", "voices", "rituals", "bonds"];
const CHIP_LABEL: Record<Chip, string> = {
  all: "All",
  voices: "Voices",
  rituals: "Rituals",
  bonds: "Bonds",
};

function seasonOf(month: number): string {
  if (month <= 1 || month === 11) return "Winter";
  if (month <= 4) return "Spring";
  if (month <= 7) return "Summer";
  return "Autumn";
}

function chapterOf(takenAt: string): string {
  const d = new Date(takenAt);
  if (Number.isNaN(d.getTime())) return "Undated";
  return `${seasonOf(d.getUTCMonth())} ${d.getUTCFullYear()}`;
}

//Lane keepsake: photo caption panels sit on a flat surface card; audio keeps
// the waveform tile. Widths vary: every third keepsake spans the row.
function Keepsake({ card, span }: { card: Card; span: boolean }) {
  const { lang } = useViewer();
  const { text } = useDisplayText(card.caption, card.lang, lang);
  if (card.type !== "photo") {
    return (
      <div className={cn(span && "col-span-2")}>
        <MemoryCard card={card} wide={span} />
      </div>
    );
  }
  return (
    <div className={cn(span && "col-span-2")}>
      <MemoryCard card={card} wide />
      <div className="mt-1 rounded-card bg-surface px-3 py-2">
        <p className="serif m-0 text-[15px] leading-snug">{text ?? card.caption}</p>
      </div>
    </div>
  );
}

export default function LanePage() {
  const { lang, displayLang } = useViewer();
  const t = strings(lang);
  void displayLang;
  const [cards, setCards] = useState<Card[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [chip, setChip] = useState<Chip>("all");

  useEffect(() => {
    let live = true;
    setFailed(false);
    fetch("/api/cards", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("cards-fetch-failed");
        return r.json();
      })
      .then((data: { cards: Card[] }) => {
        if (!live) return;
        const seen = new Set(data.cards.map((c) => c.id));
        const demo = [...demoShelf("from-dadi"), ...demoShelf("voices"), ...demoShelf("years-ago")].filter(
          (c) => !seen.has(c.id),
        );
        setCards([...data.cards, ...demo].sort((a, b) => b.takenAt.localeCompare(a.takenAt)));
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!cards) return null;
    if (chip === "voices") return cards.filter((c) => c.type === "audio");
    if (chip === "rituals") return cards.filter((c) => c.ritualSlug);
    if (chip === "bonds") return cards.filter((c) => c.source === "agent");
    return cards;
  }, [cards, chip]);

  const chapters = useMemo(() => {
    if (!filtered) return null;
    const groups = new Map<string, Card[]>();
    for (const card of filtered) {
      const key = chapterOf(card.takenAt);
      const list = groups.get(key) ?? [];
      list.push(card);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  return (
    <div className="pt-2">
      <h1 className="serif mb-3 mt-0 text-3xl">{t.tabs.lane}</h1>
      <div className="mb-4 flex gap-2" role="tablist" aria-label={t.tabs.lane}>
        {CHIP_KEYS.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={chip === c}
            onClick={() => setChip(c)}
            className={cn(
              "tap rounded-card border px-4 text-sm font-semibold",
              chip === c ? "border-espresso bg-espresso text-espresso-ink" : "border-ink/25",
            )}
          >
            {CHIP_LABEL[c]}
          </button>
        ))}
      </div>

      {failed && (
        <div className="rounded-card border border-line bg-surface p-5" role="alert">
          <p className="m-0 text-[15px]">{t.common.retry}</p>
          <button type="button" onClick={() => window.location.reload()} className="tap mt-2 font-semibold text-accent">
            {t.common.retry}
          </button>
        </div>
      )}

      {chapters === null && !failed && (
        <div aria-busy="true" aria-label={t.add.processing}>
          <div className="skeleton mb-2 h-8 w-40" />
          <div className="skeleton mb-2 h-40" />
          <div className="skeleton h-40 w-2/3" />
        </div>
      )}

      {chapters !== null && chapters.length === 0 && (
        <p className="text-[15px] text-ink-soft">{t.empty.laneSoon}</p>
      )}

      {chapters?.map(([chapter, list]) => (
        <section key={chapter} aria-label={chapter} className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            <h2 className="serif m-0 text-xl">{chapter}</h2>
          </div>
          <div className="border-l border-line pl-4">
            <div className="grid grid-cols-2 gap-3">
              {list.map((card, i) => (
                <Keepsake key={card.id} card={card} span={i % 3 === 2} />
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
