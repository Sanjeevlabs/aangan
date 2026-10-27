"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { grandmaName, strings } from "@/lib/i18n";
import type { Member, Play, Reaction } from "@/lib/schemas";
import { useShell } from "./shell";
import { useViewer } from "./viewer";
import { heardLine, reactionLine } from "@/lib/voice";

function kinshipName(member: Member | undefined, displayLang: string): string {
  if (!member) return "Family";
  if (member.id === "dadi" || member.role === "elder") return grandmaName(displayLang);
  return member.displayName;
}

async function fetchMembers(): Promise<Member[]> {
  try {
    const res = await fetch("/api/members", { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { members: Member[] };
    return data.members;
  } catch {
    return [];
  }
}

// Glass chip for the Heard loop: the latest play by someone other than the
// viewer, e.g. "Dadi heard this · 09:14". Renders nothing until loaded.
export function HeardChip({ cardId }: { cardId: string }) {
  const { viewer, displayLang } = useViewer();
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([
      fetch(`/api/plays?cardId=${encodeURIComponent(cardId)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetchMembers(),
    ]).then(([playsData, members]: [{ plays?: Play[] } | null, Member[]]) => {
      if (!live) return;
      const plays = playsData?.plays ?? [];
      const other = plays.find((p) => p.memberId !== viewer.id) ?? plays[0];
      if (!other) {
        setLine(null);
        return;
      }
      const member = members.find((m) => m.id === other.memberId);
      setLine(heardLine(kinshipName(member, displayLang), other.playedAt, displayLang));
    });
    return () => {
      live = false;
    };
  }, [cardId, viewer.id, displayLang]);

  if (!line) return null;
  return (
    <span className="glass glass-pill inline-block px-3 py-1 text-[12px] font-semibold">{line}</span>
  );
}

const KINDS = ["love", "laugh", "bless"] as const;

// Exactly three reactions, shown as text, never counts. One per member per
// card — tapping replaces the member's prior kind. Long-press replies by
// voice (Bless carries the voice-reply label).
export function ReactionBar({ cardId }: { cardId: string }) {
  const { viewer, displayLang } = useViewer();
  const { openAdd } = useShell();
  const t = strings(displayLang);
  const [reactions, setReactions] = useState<Reaction[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const pressTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/reactions?cardId=${encodeURIComponent(cardId)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { reactions: Reaction[] };
        setReactions(data.reactions);
      }
    } catch {
      // Offline: keep prior state.
    }
  }, [cardId]);

  useEffect(() => {
    setReactions(null);
    void load();
    void fetchMembers().then(setMembers);
  }, [load]);

  const react = async (kind: (typeof KINDS)[number]) => {
    try {
      const res = await fetch("/api/reactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId, memberId: viewer.id, kind }),
      });
      if (res.ok) await load();
    } catch {
      // Offline: keep prior state.
    }
  };

  const beginPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => openAdd("voice"), 550);
  };
  const endPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const labelFor = (kind: (typeof KINDS)[number]): string =>
    kind === "love" ? t.reactions.love : kind === "laugh" ? t.reactions.laugh : t.reactions.bless;

  return (
    <div>
      {reactions !== null && reactions.length > 0 && (
        <ul className="m-0 mb-2 list-none p-0">
          {reactions.map((r) => {
            const member = members.find((m) => m.id === r.memberId);
            const name = r.memberId === viewer.id ? viewer.displayName : kinshipName(member, displayLang);
            return (
              <li key={`${r.cardId}-${r.memberId}`} className="text-[13px] text-ink-soft">
                {reactionLine(name, r.kind, displayLang)}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex gap-2" role="group" aria-label={t.reactions.replyVoice}>
        {KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => void react(kind)}
            onPointerDown={kind === "bless" ? beginPress : undefined}
            onPointerUp={kind === "bless" ? endPress : undefined}
            onPointerLeave={kind === "bless" ? endPress : undefined}
            title={kind === "bless" ? `${t.reactions.bless} · ${t.reactions.replyVoice}` : labelFor(kind)}
            aria-label={kind === "bless" ? `${t.reactions.bless} · ${t.reactions.replyVoice}` : labelFor(kind)}
            className="tap rounded-pill border border-line bg-surface/70 px-4 text-sm font-semibold"
          >
            {labelFor(kind)}
          </button>
        ))}
      </div>
    </div>
  );
}
