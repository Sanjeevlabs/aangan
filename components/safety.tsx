"use client";

import Link from "next/link";
import type { SafetyCheckin, SafetySettings } from "@/lib/kinds";
import { callName, memberPhoto } from "@/lib/people";
import { emergencyFor, mapsLink, stateOf, type SafetyState } from "@/lib/safety";
import type { Member } from "@/lib/schemas";
import { ago, postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import { timeIn } from "@/lib/zones";
import { Avatar, Icon } from "./ui/kit";
import { useViewer } from "./viewer";

export interface SafetyData {
  mine: SafetySettings | null;
  sharing: string[];
  checkins: SafetyCheckin[];
}

export const TONE: Record<SafetyState["tone"], { bg: string; ink: string }> = {
  calm: { bg: "bg-surface", ink: "text-ink-soft" },
  pending: { bg: "bg-[#eef4fb]", ink: "text-[#345f88]" },
  overdue: { bg: "bg-[#fff1e0]", ink: "text-[#9a4a00]" },
  help: { bg: "bg-[#fde8e6]", ink: "text-[#a32418]" },
};

function clock(iso: string, tz: string): string {
  return timeIn(tz, new Date(iso));
}

/** One person's status, as the people they chose see it. */
export function SafetyRow({ member, state, viewerTz, compact = false }: { member: Member; state: SafetyState; viewerTz: string; compact?: boolean }) {
  const t = TONE[state.tone];
  const loc = state.tone === "help" ? state.checkin.location : null;
  const sos = emergencyFor(member.tz);
  const detail =
    state.tone === "pending"
      ? `expected by ${clock(state.etaAt, viewerTz)} your time${state.checkin.note ? ` · ${state.checkin.note}` : ""}`
      : state.tone === "overdue"
        ? `was due by ${clock(state.etaAt, viewerTz)} your time. Maybe give a call.`
        : state.tone === "help"
          ? state.checkin.note || "Pressed I need help."
          : ago(state.at);
  return (
    <div className={cn("rounded-card p-3.5", t.bg)} role={state.tone === "help" || state.tone === "overdue" ? "alert" : undefined}>
      <div className="flex items-center gap-3">
        <Avatar src={memberPhoto(member)} name={callName(member)} size={compact ? 40 : 44} ring />
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-[15px] font-semibold">
            {callName(member)} · {state.label}
          </p>
          <p className={cn("m-0 truncate text-[13px]", t.ink)}>{detail}</p>
        </div>
        {state.tone === "calm" ? <Icon name="check" size={18} className="text-[#3d6b2a]" /> : <Icon name="shield" size={18} className={t.ink} />}
      </div>
      {(state.tone === "help" || state.tone === "overdue") && (
        <div className="mt-3 flex flex-wrap gap-2">
          {loc && (
            <a href={mapsLink(loc)} target="_blank" rel="noreferrer" className="press flex h-10 items-center rounded-full bg-black px-4 text-[14px] font-semibold text-white no-underline">
              See location · sent {ago(loc.at)}
            </a>
          )}
          <a href={`tel:${sos.number}`} className="press flex h-10 items-center rounded-full bg-white px-4 text-[14px] font-semibold text-ink no-underline">
            Emergency in {sos.country}: {sos.number}
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * Courtyard block. Shows the people who chose you, calm unless a promise was
 * missed; and, if you're on your way, one tap to say you're home.
 */
export function SafetyWatch() {
  const { viewer, members } = useViewer();
  const { data, reload } = useJson<SafetyData>("/api/safety");
  if (!data) return null;
  const rows = data.sharing
    .map((id) => ({ member: members.find((m) => m.id === id), state: stateOf(data.checkins, id) }))
    .filter((r): r is { member: Member; state: SafetyState } => Boolean(r.member && r.state));
  const mine = data.mine?.enabled ? stateOf(data.checkins, viewer.id) : null;
  const open = mine && (mine.tone === "pending" || mine.tone === "overdue" || mine.tone === "help") ? mine : null;
  if (!rows.length && !open) return null;
  // Alerts first; calm rows only as a single quiet line.
  const loud = rows.filter((r) => r.state.tone !== "calm");
  const calm = rows.filter((r) => r.state.tone === "calm");
  return (
    <div className="space-y-2">
      {open && (
        <div className="flex items-center gap-3 rounded-card bg-[#eef4fb] p-3.5">
          <Icon name="shield" size={20} className="text-[#345f88]" />
          <p className="m-0 min-w-0 flex-1 truncate text-[15px] font-semibold">{open.tone === "help" ? "Your family can see you asked for help" : "On your way. Tell them when you're in."}</p>
          <button
            type="button"
            onClick={async () => {
              await postJson("/api/safety", { action: "close", checkinId: open.checkin.id });
              await reload();
            }}
            className="press h-10 shrink-0 rounded-full bg-black px-4 text-[14px] font-semibold text-white"
          >
            {open.checkin.kind === "journey" ? "Landed" : open.tone === "help" ? "I'm okay" : "Home safe"}
          </button>
        </div>
      )}
      {loud.map((r) => (
        <SafetyRow key={r.member.id} member={r.member} state={r.state} viewerTz={viewer.tz} />
      ))}
      {calm.length > 0 && (
        <Link href="/safe" className="flex items-center gap-3 rounded-card bg-surface px-4 py-3 text-ink no-underline">
          <Icon name="shield" size={18} className="text-[#3d6b2a]" />
          <span className="min-w-0 flex-1 truncate text-[14px]">
            {calm.map((r) => `${callName(r.member)}: ${r.state.label.toLowerCase()} ${ago(r.state.at)}`).join(" · ")}
          </span>
          <Icon name="chevron" size={16} className="text-ink-faint" />
        </Link>
      )}
    </div>
  );
}
