"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { strings } from "@/lib/i18n";
import { Icon } from "./ui/kit";
import type { Member, Play, Reaction } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { useShell } from "./shell";
import { useViewer } from "./viewer";
import { heardLine, reactionLine } from "@/lib/voice";

// What the family calls this person (Dadi, Dad, Maa). Same word in every UI language.
function kinshipName(member: Member | undefined, _displayLang: string): string {
  if (!member) return "Family";
  return member.displayName || member.firstName;
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

// Heard loop: the latest play by someone other than the viewer,
// e.g. "Dadi heard this · 09:14". Plain text, never a count.
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
  return <p className="m-0 text-[12px] text-ink-soft">{line}</p>;
}

const KINDS = ["love", "laugh", "bless"] as const;

// Exactly three reactions as text buttons, never counts. One per member per
// card — tapping replaces the member's prior kind. Long-press on Bless
// replies by voice.
export function ReactionBar({ cardId, tone = "light", onReply }: { cardId: string; compact?: boolean; tone?: "light" | "glass"; onReply?: () => void }) {
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

  const mine = reactions?.find((r) => r.memberId === viewer.id)?.kind;
  const others = (reactions ?? []).filter((r) => r.memberId !== viewer.id);
  const glass = tone === "glass";
  const icon = { love: "heart", laugh: "laugh", bless: "bless" } as const;

  return (
    <div>
      <div
        className={cn("flex items-stretch gap-1 rounded-full p-1", glass ? "glass" : "bg-surface")}
        role="group"
        aria-label="React"
      >
        {KINDS.map((kind) => {
          const on = mine === kind;
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={on}
              onClick={() => void react(kind)}
              onPointerDown={kind === "bless" ? beginPress : undefined}
              onPointerUp={kind === "bless" ? endPress : undefined}
              onPointerLeave={kind === "bless" ? endPress : undefined}
              title={kind === "bless" ? `${labelFor(kind)} · hold to bless by voice` : labelFor(kind)}
              className={cn(
                "press flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full text-[15px] font-medium",
                on ? (glass ? "bg-white text-black" : "bg-black text-white") : glass ? "text-white" : "text-ink",
              )}
            >
              <Icon name={icon[kind]} size={18} />
              {labelFor(kind)}
            </button>
          );
        })}
        {onReply && (
          <button
            type="button"
            onClick={onReply}
            className={cn("press flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full text-[15px] font-medium", glass ? "text-white" : "text-ink")}
          >
            <Icon name="reply" size={18} />
            Reply
          </button>
        )}
      </div>
      {others.length > 0 && (
        <p className={cn("m-0 mt-3 text-center text-[13px]", glass ? "text-white/70" : "text-ink-soft")}>
          {others
            .map((r) => reactionLine(kinshipName(members.find((m) => m.id === r.memberId), displayLang), r.kind, displayLang))
            .join(" · ")}
        </p>
      )}
    </div>
  );
}
