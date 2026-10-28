"use client";

import { useCallback, useEffect, useState } from "react";
import { strings } from "@/lib/i18n";
import type { Card, GatherSession, Member } from "@/lib/schemas";
import { PrimaryButton } from "@/components/ui/buttons";
import { usePlayer } from "@/components/player";
import { useViewer } from "@/components/viewer";

function localTime(iso: string, tz: string, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang === "hi-deva" ? "hi-IN" : "en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function GatherPage() {
  const { lang, displayLang } = useViewer();
  const { play } = usePlayer();
  const t = strings(lang);
  const [sessions, setSessions] = useState<GatherSession[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [failed, setFailed] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [busy, setBusy] = useState(false);
  const [liveId, setLiveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [gRes, cRes] = await Promise.all([
        fetch("/api/gather", { cache: "no-store" }),
        fetch("/api/cards", { cache: "no-store" }),
      ]);
      if (!gRes.ok || !cRes.ok) throw new Error("gather-fetch-failed");
      const g = (await gRes.json()) as { sessions: GatherSession[]; members: Member[] };
      setSessions(g.sessions);
      setMembers(g.members);
      setCards(((await cRes.json()) as { cards: Card[] }).cards);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const plan = async () => {
    if (!date || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/gather", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Family evening",
          startsAt: new Date(`${date}T${time}:00.000Z`).toISOString(),
          invites: members.map((m) => m.id),
        }),
      });
      if (res.ok) await load();
    } finally {
      setBusy(false);
    }
  };

  const startTogether = (session: GatherSession) => {
    setLiveId(session.id);
    const first = session.playlist.map((id) => cards.find((c) => c.id === id)).find((c) => c !== undefined);
    if (first) play(first);
  };

  return (
    <div className="pt-2">
      <h1 className="serif mb-3 mt-0 text-3xl">{t.tabs.gather}</h1>

      <section aria-label="Plan" className="mb-6">
        <div className="rounded-card border border-line bg-surface p-4">
          <div className="flex gap-2">
            <label className="block flex-1 text-sm font-medium">
              <span className="text-ink-soft">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="tap mt-1 w-full rounded-card border border-line bg-paper px-3 text-[15px]"
              />
            </label>
            <label className="block w-28 text-sm font-medium">
              <span className="text-ink-soft">Time (UTC)</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="tap mt-1 w-full rounded-card border border-line bg-paper px-3 text-[15px]"
              />
            </label>
          </div>
          <PrimaryButton className="mt-3 w-full" disabled={!date || busy} onClick={() => void plan()}>
            Plan evening
          </PrimaryButton>
        </div>
      </section>

      {failed && (
        <div className="rounded-card border border-line bg-surface p-5" role="alert">
          <p className="m-0 text-[15px]">{t.common.retry}</p>
          <button type="button" onClick={() => void load()} className="tap mt-2 font-semibold text-accent">
            {t.common.retry}
          </button>
        </div>
      )}
      {sessions === null && !failed && (
        <div aria-busy="true" aria-label="Loading">
          <div className="skeleton mb-2 h-20" />
          <div className="skeleton h-20" />
        </div>
      )}
      {sessions !== null && sessions.length === 0 && <p className="text-[15px] text-ink-soft">{t.empty.gatherSoon}</p>}
      {(sessions ?? []).map((s) => (
        <section key={s.id} aria-label={s.title} className="mb-6">
          <div className="rounded-card border border-line bg-surface p-4">
            <h2 className="serif m-0 text-xl">{s.title}</h2>
            <ul className="m-0 mt-2 list-none p-0">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-1 text-[14px]">
                  <span>{m.displayName}</span>
                  <span className="text-ink-soft">{localTime(s.startsAt, m.tz || "UTC", displayLang)}</span>
                </li>
              ))}
            </ul>
            {s.playlist.length > 0 && (
              <div className="mt-2 border-t border-line pt-2">
                <p className="m-0 mb-1 text-[13px] font-semibold text-ink-soft">Playlist from the Lane</p>
                <ol className="m-0 list-none p-0">
                  {s.playlist.map((id) => {
                    const c = cards.find((x) => x.id === id);
                    return (
                      <li key={id} className="serif py-1 text-[15px] leading-snug">
                        {c ? c.caption || c.transcript || id : id}
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
            <PrimaryButton className="mt-3 w-full" onClick={() => startTogether(s)}>
              {liveId === s.id ? "Gather live — playing together" : "Start together"}
            </PrimaryButton>
          </div>
        </section>
      ))}
    </div>
  );
}
