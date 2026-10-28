"use client";

import { useEffect, useMemo, useState } from "react";
import { daysUntilBirthday } from "@/lib/family";
import { strings } from "@/lib/i18n";
import type { Member } from "@/lib/schemas";
import { Suggestions } from "@/components/suggestions";
import { useShell } from "@/components/shell";
import { useViewer } from "@/components/viewer";

interface RitualConfig {
  slug: string;
  title: string;
  cultureNotes: string;
  steps: { key: string; kind: string; prompt: string; cardTemplate: string }[];
}

interface Run {
  id: string;
  ritualSlug: string;
  occasionDate: string;
  status: string;
}

function monthLabel(iso: string, lang: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  try {
    return new Intl.DateTimeFormat(lang === "hi-deva" ? "hi-IN" : "en-US", { month: "long", year: "numeric" }).format(d);
  } catch {
    return iso.slice(0, 7);
  }
}

export default function RitualsPage() {
  const { lang, displayLang } = useViewer();
  const { openAdd } = useShell();
  const t = strings(lang);
  const [configs, setConfigs] = useState<RitualConfig[] | null>(null);
  const [movable, setMovable] = useState<Record<string, string>>({});
  const [fixture, setFixture] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/rituals", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("rituals-fetch-failed");
        return r.json();
      })
      .then((data: { configs: RitualConfig[]; movable: Record<string, string>; movableFixture: boolean; members: Member[]; runs: Run[] }) => {
        if (!live) return;
        setConfigs(data.configs);
        setMovable(data.movable);
        setFixture(data.movableFixture);
        setMembers(data.members);
        setRuns(data.runs);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const occasions = useMemo(() => {
    const list: { id: string; date: string; title: string; detail: string; runStatus: string | null; days: number }[] = [];
    const now = new Date();
    for (const m of members) {
      if (!m.birthday) continue;
      const days = daysUntilBirthday(m.birthday);
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
      const iso = d.toISOString().slice(0, 10);
      const run = runs.find((r) => r.id === `birthday:${iso}`);
      list.push({
        id: `birthday:${m.id}:${iso}`,
        date: iso,
        title: t.coming.birthday(m.displayName),
        detail: days === 0 ? t.coming.today : t.coming.inDays(days),
        runStatus: run?.status ?? null,
        days,
      });
    }
    for (const c of configs ?? []) {
      if (c.slug === "birthday") continue;
      const iso = movable[c.slug];
      if (!iso) continue;
      const run = runs.find((r) => r.id === `${c.slug}:${iso}`);
      const days = Math.round((new Date(`${iso}T00:00:00Z`).getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86400000);
      list.push({ id: `${c.slug}:${iso}`, date: iso, title: c.title, detail: c.cultureNotes, runStatus: run?.status ?? null, days });
    }
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [members, configs, movable, runs, t]);

  const months = useMemo(() => {
    const groups = new Map<string, typeof occasions>();
    for (const o of occasions) {
      const key = o.date.slice(0, 7);
      const list = groups.get(key) ?? [];
      list.push(o);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  }, [occasions]);

  return (
    <div className="pt-2">
      <h1 className="serif mb-3 mt-0 text-3xl">{t.tabs.rituals}</h1>
      <Suggestions compact />
      {fixture && (
        <p className="mb-3 rounded-card bg-surface px-3 py-2 text-[12px] text-ink-soft">
          Movable dates are a labelled fixture until live search-grounding lands in M6.
        </p>
      )}
      {failed && (
        <div className="rounded-card border border-line bg-surface p-5" role="alert">
          <p className="m-0 text-[15px]">{t.common.retry}</p>
          <button type="button" onClick={() => window.location.reload()} className="tap mt-2 font-semibold text-accent">
            {t.common.retry}
          </button>
        </div>
      )}
      {occasions.length === 0 && !failed && (
        <div aria-busy="true" aria-label="Loading">
          <div className="skeleton mb-2 h-8 w-40" />
          <div className="skeleton h-24" />
        </div>
      )}
      {months.map(([month, list]) => (
        <section key={month} aria-label={monthLabel(`${month}-01`, displayLang)} className="mb-6">
          <h2 className="serif mb-1 mt-0 text-xl">{monthLabel(`${month}-01`, displayLang)}</h2>
          <div>
            {list.map((o) => (
              <div key={o.id} className="hairline-row">
                <span className="text-[15px]">
                  {o.title} <span className="text-ink-soft">· {o.date.slice(8, 10)} {o.detail}</span>
                  {o.runStatus && <span className="text-ink-soft"> · {o.runStatus}</span>}
                </span>
                <button type="button" onClick={() => openAdd("voice")} className="tap shrink-0 text-[15px] font-semibold text-accent">
                  {t.shelves.sendWish}
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
      {(configs ?? []).map((c) => (
        <section key={c.slug} aria-label={c.title} className="mb-6">
          <h2 className="mb-1 mt-0 text-lg">{c.title}</h2>
          <div className="rounded-card border border-line bg-surface px-4 py-3">
            <ol className="m-0 list-none p-0">
              {c.steps.map((s) => (
                <li key={s.key} className="serif py-1 text-[15px] leading-snug">
                  {s.prompt}
                </li>
              ))}
            </ol>
          </div>
        </section>
      ))}
    </div>
  );
}
