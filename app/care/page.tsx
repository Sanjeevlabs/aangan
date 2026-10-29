"use client";

import { AnimatePresence, m } from "framer-motion";
import { Fragment, useMemo, useState } from "react";
import { useShell } from "@/components/shell";
import { Translated } from "@/components/translated";
import { ActionMenu, Avatar, Button, EmptyLine, Icon, MuseMark, RoomHeader, SectionTitle } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import { householdName, householdOf, households, type Household } from "@/lib/households";
import { HELPER_ROLES, NEED_KINDS, PRIORITIES, RECURRENCE } from "@/lib/kind-values";
import type { CareSettings, Duty, Helper, Need, Pet, Presence, Rota } from "@/lib/kinds";
import { language } from "@/lib/languages";
import { can } from "@/lib/permissions";
import { callName, memberPhoto } from "@/lib/people";
import { MOMENT_LABEL, latestFor, quietDay, whoseWeek } from "@/lib/presence";
import type { Member } from "@/lib/schemas";
import { ago, postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import { placeFromTz, timeIn } from "@/lib/zones";

// Care board: caring for a home far away, run like a good ticket tracker but
// family-warm. Board = what needs doing and who's on it. Setup = the Village,
// who handles what, whose week. Tasks only; no medical, legal or money advice.

interface CareData {
  needs: Need[];
  helpers: Helper[];
  rotas: Rota[];
  duties: Duty[];
}
interface PresenceData {
  presence: Presence[];
  settings: CareSettings[];
}
type Kind = (typeof NEED_KINDS)[number];

const CATEGORY: Record<Kind, { label: string; tone: string; ink: string }> = {
  groceries: { label: "Groceries", tone: "#e8f3e1", ink: "#3d6b2a" },
  house: { label: "House", tone: "#efe7dc", ink: "#7a5a40" },
  ride: { label: "Ride", tone: "#e3ecf5", ink: "#345f88" },
  repair: { label: "Repair", tone: "#f3e6da", ink: "#8a4b1f" },
  gas: { label: "Gas & utilities", tone: "#fbe9d4", ink: "#9a5b0b" },
  bills: { label: "Bills", tone: "#ece6f5", ink: "#5b4a86" },
  health: { label: "Health visit", tone: "#f8e1e3", ink: "#9b3b45" },
  errand: { label: "Errand", tone: "#e6eef0", ink: "#3f6670" },
  visit: { label: "A visit", tone: "#fdebd8", ink: "#8a4b00" },
  pets: { label: "Pets", tone: "#eaf0da", ink: "#5a6b23" },
  other: { label: "Other", tone: "#eeeeee", ink: "#555555" },
};
const PRIORITY_LABEL: Record<(typeof PRIORITIES)[number], string> = { normal: "Normal", soon: "Soon", urgent: "Urgent" };
const REPEAT_LABEL: Record<(typeof RECURRENCE)[number], string> = { none: "Once", weekly: "Weekly", monthly: "Monthly" };
const STATUS_LABEL: Record<Need["status"], string> = { open: "To do", claimed: "Assigned", progress: "In progress", done: "Done", cancelled: "Cancelled" };
const field = "h-[48px] w-full rounded-[14px] bg-white px-4 text-[16px] outline-none focus:ring-2 focus:ring-marigold";

type Filter = "all" | "mine" | "unassigned" | "urgent";

export default function CarePage() {
  const { viewer, members, relationships } = useViewer();
  const care = useJson<CareData>("/api/care");
  const pres = useJson<PresenceData>("/api/presence");
  const petsQ = useJson<{ pets: Pet[] }>("/api/pets");
  const homes = households(members, relationships).filter((h) => h.elders);
  const [chosen, setChosen] = useState<string | null>(null);
  const [tab, setTab] = useState<"board" | "setup">("board");
  const home = homes.find((h) => h.id === chosen) ?? (viewer.role === "elder" ? householdOf(viewer.id, homes) : undefined) ?? homes.find((h) => !h.members.some((x) => x.id === viewer.id)) ?? homes[0];
  const reload = () => Promise.all([care.reload(), pres.reload()]);

  if (!home) {
    return (
      <div>
        <RoomHeader title="Care" />
        <div className="rounded-hero bg-surface px-6 py-10 text-center">
          <p className="m-0 text-[20px] font-semibold">Add a parent or grandparent first</p>
          <p className="mx-auto mt-2 max-w-[300px] text-[15px] text-ink-soft">Care forms around the homes of the elders in your family tree.</p>
        </div>
      </div>
    );
  }
  const ids = home.members.map((x) => x.id);
  const homeName = householdName(home, (x) => callName(x));
  const isParent = ids.includes(viewer.id) && viewer.role === "elder";
  const parent = home.members.find((x) => x.id === viewer.id && x.role === "elder") ?? home.members.find((x) => x.role === "elder") ?? home.members[0];
  const data = care.data;
  const needs = (data?.needs ?? []).filter((n) => ids.includes(n.forMemberId));
  const helpers = (data?.helpers ?? []).filter((h) => ids.includes(h.forMemberId));
  const pets = (petsQ.data?.pets ?? []).filter((p) => ids.includes(p.livesWith));
  const openCount = needs.filter((n) => n.status !== "done" && n.status !== "cancelled").length;

  return (
    <div>
      <RoomHeader title={isParent ? "Your care" : `Care for ${homeName}`} subtitle={`${timeIn(home.tz)} in ${placeFromTz(home.tz)}`} />

      {!isParent && homes.length > 1 && (
        <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5">
          {homes.map((h) => (
            <button key={h.id} type="button" onClick={() => setChosen(h.id)} aria-pressed={h.id === home.id} className={cn("press flex h-11 shrink-0 items-center gap-2 rounded-full pl-1 pr-4 text-[15px] font-medium", h.id === home.id ? "bg-black text-white" : "bg-surface")}>
              <span className="flex -space-x-2">
                {h.members.slice(0, 2).map((x) => (
                  <Avatar key={x.id} src={memberPhoto(x)} name={callName(x)} size={30} />
                ))}
              </span>
              {householdName(h, (x) => callName(x))}
            </button>
          ))}
        </div>
      )}

      {!data || !pres.data ? (
        <div className="skeleton h-[320px] rounded-card" aria-busy="true" aria-label="Loading care" />
      ) : isParent ? (
        <ParentView parent={parent} needs={needs} onChange={reload} settings={pres.data.settings} />
      ) : (
        <>
          <HomePulse home={home} presence={pres.data.presence} settings={pres.data.settings} viewerId={viewer.id} />
          <div className="mt-5 flex rounded-full bg-surface p-1" role="tablist" aria-label="Care views">
            {(["board", "setup"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("press h-10 flex-1 rounded-full text-[15px] font-semibold", tab === t ? "bg-white shadow-sm" : "text-ink-soft")}>
                {t === "board" ? `Board${openCount ? ` · ${openCount}` : ""}` : "Setup"}
              </button>
            ))}
          </div>
          {tab === "board" ? <Board home={home} homeName={homeName} needs={needs} helpers={helpers} pets={pets} onChange={reload} /> : <Setup home={home} homeName={homeName} parent={parent} data={data} helpers={helpers} onChange={reload} />}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- the home's pulse */
function HomePulse({ home, presence, settings, viewerId }: { home: Household; presence: Presence[]; settings: CareSettings[]; viewerId: string }) {
  return (
    <ul className="m-0 list-none space-y-1.5 rounded-card bg-surface p-3.5" aria-label="Their day">
      {home.members
        .filter((x) => x.role === "elder")
        .map((p) => {
          const last = latestFor(p.id, presence.filter((x) => x.moment !== "here"));
          const quiet = quietDay(settings.find((s) => s.memberId === p.id), viewerId, presence, p.tz).quiet;
          return (
            <li key={p.id} className="flex items-center gap-2.5 text-[14px]">
              <Avatar src={memberPhoto(p)} name={callName(p)} size={28} />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold">{callName(p)}</span>{" "}
                {quiet ? (
                  <span className="font-medium text-[#8a4b00]">quiet day so far</span>
                ) : last ? (
                  <span className="text-ink-soft">
                    {MOMENT_LABEL[last.moment].line} · {ago(last.at)}
                  </span>
                ) : (
                  <span className="text-ink-soft">nothing shared yet today</span>
                )}
              </span>
            </li>
          );
        })}
    </ul>
  );
}

/* ------------------------------------------------------------------- board */
function Board({ home, homeName, needs, helpers, pets, onChange }: { home: Household; homeName: string; needs: Need[]; helpers: Helper[]; pets: Pet[]; onChange: () => void }) {
  const { viewer, members } = useViewer();
  const manage = can(viewer, "care.manage");
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState<Kind | "all">("all");
  const [person, setPerson] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const family = members.filter((x) => !home.members.some((h) => h.id === x.id) && x.access !== "child");

  const live = needs.filter((n) => n.status !== "done" && n.status !== "cancelled");
  const weekAgo = Date.now() - 7 * 86_400_000;
  const passes = (n: Need) =>
    (filter === "all" || (filter === "mine" && n.claimedBy === viewer.id) || (filter === "unassigned" && !n.claimedBy) || (filter === "urgent" && n.priority === "urgent")) &&
    (category === "all" || n.kind === category) &&
    (!person || n.claimedBy === person);
  const order = (a: Need, b: Need) => rank(b.priority) - rank(a.priority) || (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9") || b.createdAt.localeCompare(a.createdAt);
  const todo = live.filter((n) => n.status !== "progress").filter(passes).sort(order);
  const doing = live.filter((n) => n.status === "progress").filter(passes).sort(order);
  const done = needs.filter((n) => n.status === "done" && Date.parse(n.doneAt ?? n.createdAt) > weekAgo).filter(passes);
  const usedKinds = Array.from(new Set(needs.map((n) => n.kind)));
  const selected = needs.find((n) => n.id === openId);

  return (
    <section aria-label="Care board" className="mt-4">
      {/* Who carries what: a fair split at a glance. Tap to filter. */}
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1" aria-label="Filter by person">
        {family.map((x) => {
          const count = live.filter((n) => n.claimedBy === x.id).length;
          const on = person === x.id;
          return (
            <button key={x.id} type="button" aria-pressed={on} onClick={() => setPerson(on ? null : x.id)} className={cn("press flex h-12 shrink-0 items-center gap-2 rounded-[16px] pl-1.5 pr-3.5", on ? "bg-black text-white" : "bg-surface")}>
              <Avatar src={memberPhoto(x)} name={callName(x)} size={34} />
              <span className="text-left leading-tight">
                <span className="block text-[14px] font-semibold">{x.id === viewer.id ? "You" : callName(x)}</span>
                <span className={cn("block text-[12px]", on ? "text-white/70" : "text-ink-soft")}>{count ? `${count} open` : "free"}</span>
              </span>
            </button>
          );
        })}
        <div className="flex h-12 shrink-0 items-center rounded-[16px] bg-[#fff0d6] px-3.5 text-[13px] font-semibold text-[#8a4b00]">{live.filter((n) => !n.claimedBy).length} unassigned</div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto" role="radiogroup" aria-label="Filter">
          {(["all", "mine", "unassigned", "urgent"] as const).map((f) => (
            <button key={f} type="button" role="radio" aria-checked={filter === f} onClick={() => setFilter(f)} className={cn("press h-9 shrink-0 rounded-full px-3.5 text-[14px] font-medium", filter === f ? "bg-black text-white" : "bg-surface")}>
              {f === "all" ? "All" : f === "mine" ? "Mine" : f === "unassigned" ? "Unassigned" : "Urgent"}
            </button>
          ))}
        </div>
        <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value as Kind | "all")} className="h-9 max-w-[130px] shrink-0 rounded-full bg-surface px-3 text-[14px] font-medium">
          <option value="all">All kinds</option>
          {usedKinds.map((k) => (
            <option key={k} value={k}>
              {CATEGORY[k].label}
            </option>
          ))}
        </select>
      </div>

      <Lane title="To do" items={todo} onOpen={setOpenId} empty={live.length === 0 ? `Nothing pending for ${homeName}.` : "Nothing here with these filters."} />
      {doing.length > 0 && <Lane title="In progress" items={doing} onOpen={setOpenId} />}
      {done.length > 0 && (
        <div className="mt-5">
          <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} className="flex h-10 items-center gap-1.5 text-[14px] font-semibold text-ink-soft">
            Done this week · {done.length}
            <Icon name="down" size={16} className={cn("transition-transform", showDone && "rotate-180")} />
          </button>
          {showDone && <Lane items={done} onOpen={setOpenId} muted />}
        </div>
      )}

      {manage && (
        <Button className="mt-6 w-full" onClick={() => setCreating(true)}>
          <Icon name="plus" size={18} />
          New task for {homeName}
        </Button>
      )}

      <AnimatePresence>
        {(selected || creating) && (
          <TicketSheet
            key={selected?.id ?? "new"}
            need={selected}
            home={home}
            helpers={helpers}
            pets={pets}
            onClose={() => {
              setOpenId(null);
              setCreating(false);
            }}
            onChange={onChange}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function rank(p: Need["priority"]): number {
  return p === "urgent" ? 2 : p === "soon" ? 1 : 0;
}

function Lane({ title, items, onOpen, empty, muted }: { title?: string; items: Need[]; onOpen: (id: string) => void; empty?: string; muted?: boolean }) {
  return (
    <div className={title ? "mt-5" : "mt-1"}>
      {title && (
        <p className="m-0 mb-1.5 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
          {title} · {items.length}
        </p>
      )}
      {items.length === 0 && empty ? <p className="m-0 rounded-card bg-surface px-4 py-5 text-center text-[15px] text-ink-soft">{empty}</p> : null}
      {items.length > 0 && (
        <ul className="m-0 list-none divide-y divide-[var(--line)] overflow-hidden rounded-card bg-surface p-0">
          {items.map((n) => (
            <TicketRow key={n.id} need={n} onOpen={() => onOpen(n.id)} muted={muted} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TicketRow({ need, onOpen, muted }: { need: Need; onOpen: () => void; muted?: boolean }) {
  const { viewer, members } = useViewer();
  const who = members.find((x) => x.id === need.claimedBy);
  const forWhom = members.find((x) => x.id === need.forMemberId);
  const cat = CATEGORY[need.kind];
  const due = need.dueAt ? dueLabel(need.dueAt) : need.when;
  return (
    <li>
      <button type="button" onClick={onOpen} className="press flex w-full items-center gap-3 px-3.5 py-3 text-left">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-[13px] font-bold" style={{ background: cat.tone, color: cat.ink }} aria-hidden="true">
          {cat.label.slice(0, 2)}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("flex items-center gap-1.5 text-[15px] font-semibold", muted && "text-ink-soft line-through decoration-black/20")}>
            {need.priority !== "normal" && <span className={cn("h-2 w-2 shrink-0 rounded-full", need.priority === "urgent" ? "bg-[#d92d20]" : "bg-marigold")} aria-label={PRIORITY_LABEL[need.priority]} />}
            <span className="truncate">{need.title}</span>
          </span>
          <span className="block truncate text-[12.5px] text-ink-soft">{[cat.label, due, forWhom ? `for ${callName(forWhom)}` : "", need.recurring !== "none" ? REPEAT_LABEL[need.recurring].toLowerCase() : ""].filter(Boolean).join(" · ")}</span>
        </span>
        {who ? <Avatar src={memberPhoto(who)} name={who.id === viewer.id ? "You" : callName(who)} size={30} /> : <span className="shrink-0 rounded-full bg-[#fff0d6] px-2.5 py-1 text-[11.5px] font-semibold text-[#8a4b00]">Unassigned</span>}
      </button>
    </li>
  );
}

function dueLabel(iso: string): string {
  const d = new Date(iso);
  const days = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  const day = days === 0 ? "today" : days === 1 ? "tomorrow" : days === -1 ? "yesterday" : days < 0 ? `${-days} days late` : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return `due ${day}`;
}

/* ------------------------------------------------------------ ticket sheet */
function TicketSheet({ need, home, helpers, pets, onClose, onChange }: { need?: Need; home: Household; helpers: Helper[]; pets: Pet[]; onClose: () => void; onChange: () => void }) {
  const { viewer, members } = useViewer();
  const manage = can(viewer, "care.manage");
  const elders = home.members.filter((x) => x.role === "elder");
  const family = members.filter((x) => !home.members.some((h) => h.id === x.id) && x.access !== "child");
  const [title, setTitle] = useState(need?.title ?? "");
  const [kind, setKind] = useState<Kind>(need?.kind ?? "groceries");
  const [priority, setPriority] = useState<Need["priority"]>(need?.priority ?? "normal");
  const [recurring, setRecurring] = useState<Need["recurring"]>(need?.recurring ?? "none");
  const [due, setDue] = useState(need?.dueAt ? toLocalInput(need.dueAt) : "");
  const [forId, setForId] = useState(need?.forMemberId ?? elders[0]?.id ?? home.members[0].id);
  const [assignee, setAssignee] = useState<string | null>(need?.claimedBy ?? null);
  const [petId, setPetId] = useState<string | null>(need?.petId ?? null);
  const [busy, setBusy] = useState(false);
  const name = (id: string | null) => (id === viewer.id ? "You" : callName(members.find((x) => x.id === id)));
  const dirty = Boolean(need) && (title !== need?.title || kind !== need?.kind || priority !== need?.priority || recurring !== need?.recurring || due !== (need?.dueAt ? toLocalInput(need.dueAt) : ""));
  const parent = members.find((x) => x.id === forId);
  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    await postJson("/api/care", body);
    setBusy(false);
    onChange();
  };
  const create = async () => {
    setBusy(true);
    await postJson("/api/care", { action: "need", forMemberId: forId, title: title.trim(), kind, priority, recurring, dueAt: due ? new Date(due).toISOString() : null, assignee, petId });
    setBusy(false);
    onChange();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={need ? need.title : "New task"}>
      <m.button type="button" aria-label="Close" className="absolute inset-0 bg-black/25" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <m.div
        className="relative max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-t-[32px] bg-white px-5 pt-3 shadow-frost"
        style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 36 }}
      >
        <span className="mx-auto mb-2 block h-1.5 w-10 rounded-full bg-black/15" aria-hidden="true" />
        <div className="mb-2 flex items-center justify-between">
          <p className="m-0 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-faint">{need ? STATUS_LABEL[need.status] : "New task"}</p>
          <div className="flex items-center">
            {need && (need.askedBy === viewer.id || manage) && (
              <ActionMenu
                label="Task options"
                actions={[
                  {
                    label: "Delete task",
                    danger: true,
                    confirm: "Delete this task and its history?",
                    onSelect: async () => {
                      await act({ action: "need-delete", needId: need.id });
                      onClose();
                    },
                  },
                ]}
              />
            )}
            <button type="button" onClick={onClose} aria-label="Close" className="press grid h-10 w-10 place-items-center rounded-full text-ink-soft">
              <Icon name="close" />
            </button>
          </div>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="What needs doing?"
          aria-label="Task"
          disabled={Boolean(need) && !manage && need?.askedBy !== viewer.id}
          className="w-full border-0 bg-transparent text-[22px] font-semibold outline-none placeholder:text-ink-faint"
        />

        <div className="mt-3 space-y-3">
          <Row label="Kind">
            <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className="h-10 rounded-full bg-surface px-3 text-[14px] font-semibold" aria-label="Kind">
              {NEED_KINDS.map((k) => (
                <option key={k} value={k}>
                  {CATEGORY[k].label}
                </option>
              ))}
            </select>
          </Row>
          {elders.length > 1 && (
            <Row label="For">
              <div className="flex gap-1.5">
                {elders.map((x) => (
                  <button key={x.id} type="button" aria-pressed={forId === x.id} onClick={() => setForId(x.id)} disabled={Boolean(need)} className={cn("press h-10 rounded-full px-3.5 text-[14px] font-semibold", forId === x.id ? "bg-black text-white" : "bg-surface", need && "opacity-60")}>
                    {callName(x)}
                  </button>
                ))}
              </div>
            </Row>
          )}
          {kind === "pets" && pets.length > 0 && (
            <Row label="Pet">
              <select value={petId ?? ""} onChange={(e) => setPetId(e.target.value || null)} className="h-10 rounded-full bg-surface px-3 text-[14px] font-semibold" aria-label="Pet">
                <option value="">Choose</option>
                {pets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Row>
          )}
          <Row label="Priority">
            <Segmented value={priority} options={PRIORITIES} labels={PRIORITY_LABEL} onChange={setPriority} />
          </Row>
          <Row label="Due">
            <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="h-10 rounded-full bg-surface px-3 text-[14px]" aria-label="Due" />
          </Row>
          <Row label="Repeats">
            <Segmented value={recurring} options={RECURRENCE} labels={REPEAT_LABEL} onChange={setRecurring} />
          </Row>
        </div>

        {need && dirty && (
          <Button className="mt-4 w-full" disabled={busy || title.trim().length < 3} onClick={() => act({ action: "need-edit", needId: need.id, title: title.trim(), kind, priority, recurring, dueAt: due ? new Date(due).toISOString() : null, when: need.when })}>
            Save changes
          </Button>
        )}

        <SectionTitle>Who&rsquo;s on it</SectionTitle>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {family.map((x) => {
            const on = (need ? need.claimedBy : assignee) === x.id;
            return (
              <button
                key={x.id}
                type="button"
                aria-pressed={on}
                disabled={!manage || busy}
                onClick={() => (need ? void act({ action: "assign-to", needId: need.id, memberId: x.id }) : setAssignee(on ? null : x.id))}
                className={cn("press flex h-11 shrink-0 items-center gap-2 rounded-full pl-1 pr-4 text-[14px] font-semibold", on ? "bg-black text-white" : "bg-surface")}
              >
                <Avatar src={memberPhoto(x)} name={callName(x)} size={32} />
                {x.id === viewer.id ? "Me" : callName(x)}
              </button>
            );
          })}
        </div>
        {helpers.length > 0 && need && (
          <select
            aria-label="Who will go (Village)"
            disabled={!manage || busy}
            value={need.helperId ?? ""}
            onChange={(e) => e.target.value && void act({ action: "assign", needId: need.id, helperId: e.target.value })}
            className="mt-3 h-11 w-full rounded-full bg-surface px-4 text-[14px] font-semibold"
          >
            <option value="">Who will go? (from the Village)</option>
            {helpers.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} · {h.role}
              </option>
            ))}
          </select>
        )}

        {need ? (
          <>
            {manage && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {need.status === "done" || need.status === "cancelled" ? (
                  <button type="button" disabled={busy} onClick={() => act({ action: "status", needId: need.id, status: "open" })} className="press col-span-3 h-11 rounded-full bg-surface text-[14px] font-semibold">
                    Re-open
                  </button>
                ) : (
                  <>
                    <button type="button" disabled={busy || need.status === "progress"} onClick={() => act({ action: "status", needId: need.id, status: "progress" })} className="press h-11 rounded-full bg-surface text-[14px] font-semibold disabled:opacity-40">
                      Start
                    </button>
                    <button type="button" disabled={busy} onClick={() => act({ action: "status", needId: need.id, status: "done" })} className="press h-11 rounded-full bg-black text-[14px] font-semibold text-white">
                      Done
                    </button>
                    <button type="button" disabled={busy} onClick={() => act({ action: "status", needId: need.id, status: "cancelled" })} className="press h-11 rounded-full bg-surface text-[14px] font-semibold text-ink-soft">
                      Cancel
                    </button>
                  </>
                )}
              </div>
            )}
            {need.noteForParent && (
              <div className="mt-4 rounded-[18px] bg-surface px-4 py-3">
                <p className="voice m-0 text-[17px] leading-snug">{need.noteForParent}</p>
                <MuseMark>
                  what {callName(parent)} sees, in {language(parent?.displayLang ?? "en").native}
                </MuseMark>
              </div>
            )}
            <SectionTitle>Timeline</SectionTitle>
            <ol className="m-0 list-none space-y-2.5 border-l-2 border-[var(--line)] p-0 pl-4">
              {[...need.history].reverse().map((h, i) => (
                <li key={i} className="relative text-[14px]">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-black/20" aria-hidden="true" />
                  <span className="font-medium">{h.what}</span>
                  <span className="block text-[12px] text-ink-faint">
                    {name(h.by)} · {ago(h.at)}
                  </span>
                </li>
              ))}
              {need.history.length === 0 && (
                <li className="text-[14px] text-ink-soft">
                  Asked {ago(need.createdAt)} by {name(need.askedBy)}
                </li>
              )}
            </ol>
          </>
        ) : (
          <Button className="mt-6 w-full" disabled={busy || title.trim().length < 3} onClick={() => void create()}>
            {busy ? "Adding…" : assignee ? `Add and give to ${name(assignee)}` : "Add task"}
          </Button>
        )}
      </m.div>
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[14px] text-ink-soft">{label}</span>
      {children}
    </div>
  );
}

function Segmented<T extends string>({ value, options, labels, onChange }: { value: T; options: readonly T[]; labels: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-full bg-surface p-0.5" role="radiogroup">
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={cn("press h-9 rounded-full px-3 text-[13px] font-semibold", value === o ? "bg-white shadow-sm" : "text-ink-soft")}>
          {labels[o]}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- setup */
function Setup({ home, homeName, parent, data, helpers, onChange }: { home: Household; homeName: string; parent: Member; data: CareData; helpers: Helper[]; onChange: () => void }) {
  const { viewer, members } = useViewer();
  const ids = home.members.map((x) => x.id);
  const manage = can(viewer, "care.manage");
  return (
    <div className="mt-2">
      <WhoseWeek parent={parent} homeName={homeName} rota={data.rotas.find((r) => ids.includes(r.forMemberId))} members={members} viewerId={viewer.id} onChange={onChange} />
      <Duties parent={parent} homeIds={ids} homeName={homeName} duties={data.duties ?? []} members={members} canManage={manage} onChange={onChange} />
      <Village homeName={homeName} parent={parent} helpers={helpers} canManage={manage} onChange={onChange} />
    </div>
  );
}

function WhoseWeek({ parent, homeName, rota, members, viewerId, onChange }: { parent: Member; homeName: string; rota: Rota | undefined; members: Member[]; viewerId: string; onChange: () => void }) {
  const name = (id: string) => (id === viewerId ? "You" : callName(members.find((x) => x.id === id)));
  const take = async () => {
    await postJson("/api/care", { action: "take-week", forMemberId: rota?.forMemberId ?? parent.id });
    onChange();
  };
  if (!rota) {
    return (
      <section aria-label="Whose week">
        <SectionTitle>Whose week</SectionTitle>
        <div className="flex items-center justify-between gap-3 rounded-card bg-surface p-4">
          <p className="m-0 text-[15px]">Nobody checks in on {homeName} by turn yet.</p>
          <Button className="h-11 shrink-0 px-4 text-[14px]" onClick={() => void take()}>
            Take this week
          </Button>
        </div>
      </section>
    );
  }
  const { current, next } = whoseWeek(rota.order, rota.startWeek);
  return (
    <section aria-label="Whose week">
      <SectionTitle>Whose week</SectionTitle>
      <div className="flex items-center gap-3 rounded-card bg-surface p-4">
        <Avatar src={memberPhoto(members.find((x) => x.id === current))} name={name(current)} size={44} />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[16px] font-semibold">
            {name(current)} {current === viewerId ? "check" : "checks"} in this week
          </p>
          <p className="m-0 truncate text-[13px] text-ink-soft">
            Turns: {rota.order.map(name).join(" → ")}
            {next && next !== current ? ` · next: ${name(next)}` : ""}
          </p>
        </div>
        <ActionMenu
          label="Rota options"
          actions={[
            ...(current !== viewerId ? [{ label: "I'll take this week", onSelect: () => take() }] : []),
            ...(rota.order.includes(viewerId)
              ? [{ label: "Take me off the rota", danger: true, confirm: "Stop taking turns?", onSelect: async () => { await postJson("/api/care", { action: "leave-rota", forMemberId: rota.forMemberId }); onChange(); } }]
              : [{ label: "Join the rota", onSelect: () => take() }]),
          ]}
        />
      </div>
    </section>
  );
}

/** Who handles what for this home. A new task of that kind goes straight to them. */
function Duties({ parent, homeIds, homeName, duties, members, canManage, onChange }: { parent: Member; homeIds: string[]; homeName: string; duties: Duty[]; members: Member[]; canManage: boolean; onChange: () => void }) {
  const helpers = members.filter((x) => !homeIds.includes(x.id) && x.access !== "child");
  const dutyFor = (kind: Kind) => duties.find((d) => homeIds.includes(d.forMemberId) && d.kind === kind);
  return (
    <section aria-label="Who handles what">
      <SectionTitle>Who handles what</SectionTitle>
      <p className="m-0 -mt-1 mb-3 text-[14px] text-ink-soft">Split the work for {homeName}. New tasks go straight to whoever handles them.</p>
      <ul className="m-0 list-none divide-y divide-[var(--line)] rounded-card bg-surface p-0 px-4">
        {NEED_KINDS.filter((k) => k !== "other").map((k) => {
          const d = dutyFor(k);
          return (
            <li key={k} className="flex items-center justify-between gap-3 py-2">
              <span className="flex items-center gap-2.5 text-[15px] font-medium">
                <span className="grid h-7 w-7 place-items-center rounded-[9px] text-[11px] font-bold" style={{ background: CATEGORY[k].tone, color: CATEGORY[k].ink }} aria-hidden="true">
                  {CATEGORY[k].label.slice(0, 2)}
                </span>
                {CATEGORY[k].label}
              </span>
              {canManage ? (
                <select
                  aria-label={`Who handles ${CATEGORY[k].label}`}
                  value={d?.memberId ?? ""}
                  onChange={async (e) => {
                    await postJson("/api/care", e.target.value ? { action: "duty-set", forMemberId: d?.forMemberId ?? parent.id, kind: k, memberId: e.target.value } : { action: "duty-clear", forMemberId: d?.forMemberId ?? parent.id, kind: k });
                    onChange();
                  }}
                  className="h-9 max-w-[160px] rounded-full bg-white px-3 text-[14px] font-semibold"
                >
                  <option value="">Anyone</option>
                  {helpers.map((x) => (
                    <option key={x.id} value={x.id}>
                      {callName(x)}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[14px] text-ink-soft">{d ? callName(members.find((x) => x.id === d.memberId)) : "Anyone"}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Village({ homeName, parent, helpers, canManage, onChange }: { homeName: string; parent: Member; helpers: Helper[]; canManage: boolean; onChange: () => void }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const sorted = useMemo(() => [...helpers].sort((a, b) => a.role.localeCompare(b.role)), [helpers]);
  return (
    <section aria-label={`${homeName}'s Village`}>
      <SectionTitle>{homeName}&rsquo;s Village</SectionTitle>
      <p className="m-0 -mt-1 mb-3 text-[14px] text-ink-soft">Trusted people nearby who can actually go: the grocer, a driver, house help, a neighbour.</p>
      {sorted.length === 0 && <EmptyLine>No one yet. Start with whoever delivers groceries.</EmptyLine>}
      {sorted.length > 0 && (
        <ul className="m-0 list-none divide-y divide-[var(--line)] rounded-card bg-surface p-0 px-4">
          {sorted.map((h) => (
            <Fragment key={h.id}>
              <li className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{h.name}</span>
                  <span className="block truncate text-[13px] text-ink-soft">
                    {h.role}
                    {h.note ? ` · ${h.note}` : ""}
                  </span>
                </span>
                {h.phone && (
                  <a href={`tel:${h.phone.replace(/\s/g, "")}`} aria-label={`Call ${h.name}`} className="press grid h-10 w-10 place-items-center rounded-full bg-white text-ink">
                    <Icon name="phone" size={17} />
                  </a>
                )}
                {canManage && (
                  <ActionMenu
                    label={`${h.name} options`}
                    actions={[
                      { label: "Edit", onSelect: () => setEditing(h.id) },
                      { label: "Remove from the Village", danger: true, confirm: `Remove ${h.name}?`, onSelect: async () => { await postJson("/api/care", { action: "helper-remove", helperId: h.id }); onChange(); } },
                    ]}
                  />
                )}
              </li>
              {editing === h.id && (
                <li className="py-3">
                  <HelperForm helper={h} forMemberId={h.forMemberId} onDone={() => { setEditing(null); onChange(); }} />
                </li>
              )}
            </Fragment>
          ))}
        </ul>
      )}
      {canManage &&
        (adding ? (
          <div className="mt-2">
            <HelperForm forMemberId={parent.id} onDone={() => { setAdding(false); onChange(); }} />
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="press mt-2 flex h-11 items-center gap-1.5 text-[15px] font-semibold">
            <Icon name="plus" size={18} />
            Add someone to the Village
          </button>
        ))}
    </section>
  );
}

function HelperForm({ helper, forMemberId, onDone }: { helper?: Helper; forMemberId: string; onDone: () => void }) {
  const [name, setName] = useState(helper?.name ?? "");
  const [role, setRole] = useState<Helper["role"]>(helper?.role ?? "groceries");
  const [phone, setPhone] = useState(helper?.phone ?? "");
  const [note, setNote] = useState(helper?.note ?? "");
  return (
    <div className="space-y-2 rounded-[18px] bg-surface p-3">
      <input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Name (Ramesh, Sunita didi…)" aria-label="Name" />
      <select className={field} value={role} onChange={(e) => setRole(e.target.value as Helper["role"])} aria-label="What they help with">
        {HELPER_ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <input className={field} value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^+\d\s()-]/g, ""))} inputMode="tel" maxLength={30} placeholder="Phone (optional)" aria-label="Phone" />
      <input className={field} value={note} onChange={(e) => setNote(e.target.value)} maxLength={160} placeholder="A note (Delivers before 11)" aria-label="Note" />
      <div className="flex gap-2">
        <Button
          className="h-11 flex-1 text-[15px]"
          disabled={!name.trim()}
          onClick={async () => {
            await postJson("/api/care", helper ? { action: "helper-edit", helperId: helper.id, name: name.trim(), role, phone: phone.trim(), note: note.trim() } : { action: "helper", forMemberId, name: name.trim(), role, phone: phone.trim(), note: note.trim() });
            onDone();
          }}
        >
          {helper ? "Save" : "Add"}
        </Button>
        <Button variant="secondary" className="h-11 flex-1 !bg-white text-[15px]" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------------------------- the parent's own view */
function ParentView({ parent, needs, settings, onChange }: { parent: Member; needs: Need[]; settings: CareSettings[]; onChange: () => void }) {
  const { openAdd } = useShell();
  const { viewer, members } = useViewer();
  const [typing, setTyping] = useState(false);
  const [title, setTitle] = useState("");
  const mine = needs.filter((n) => n.forMemberId === viewer.id && n.status !== "cancelled" && (n.status !== "done" || Date.parse(n.doneAt ?? n.createdAt) > Date.now() - 3 * 86_400_000));
  return (
    <>
      <section aria-label="Ask for help" className="rounded-card bg-surface p-5">
        <p className="m-0 text-[20px] font-semibold">What do you need?</p>
        <p className="m-0 mt-1 text-[15px] text-ink-soft">Say it the way you&rsquo;d say it to your children. Big or small.</p>
        <Button className="mt-4 w-full" onClick={() => openAdd("voice", { kind: "need", forMemberId: parent.id })}>
          <Icon name="mic" size={18} />
          Ask by voice
        </Button>
        {!typing ? (
          <button type="button" onClick={() => setTyping(true)} className="mt-2 h-11 w-full text-[15px] font-medium text-ink-soft">
            or type it
          </button>
        ) : (
          <div className="mt-3 flex gap-2">
            <input className={cn(field, "flex-1")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="The geyser isn't heating" aria-label="What you need" />
            <Button
              className="h-[48px] px-5"
              disabled={title.trim().length < 3}
              onClick={async () => {
                await postJson("/api/care", { action: "need", forMemberId: parent.id, title: title.trim() });
                setTitle("");
                setTyping(false);
                onChange();
              }}
            >
              Ask
            </Button>
          </div>
        )}
      </section>

      <SectionTitle>What you asked for</SectionTitle>
      {mine.length === 0 && <p className="m-0 text-[15px] text-ink-soft">Nothing pending.</p>}
      <ul className="m-0 list-none space-y-2 p-0">
        {mine.map((n) => {
          const who = members.find((x) => x.id === n.claimedBy);
          return (
            <li key={n.id} className="rounded-card bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="m-0 text-[17px] font-semibold leading-snug">
                  <Translated text={n.title} />
                </p>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold", n.status === "done" ? "bg-[#e6f4ea] text-[#1e6b3a]" : who ? "bg-[#e6f0fa] text-[#345f88]" : "bg-[#fff0d6] text-[#8a4b00]")}>{n.status === "done" ? "Done" : who ? callName(who) : "Waiting"}</span>
              </div>
              {n.noteForParent && <p className="voice m-0 mt-2 text-[17px] leading-snug">{n.noteForParent}</p>}
              <div className="mt-1 flex justify-end">
                <ActionMenu label="Request options" actions={[{ label: "I don't need this anymore", danger: true, confirm: "Remove this request?", onSelect: async () => { await postJson("/api/care", { action: "need-delete", needId: n.id }); onChange(); } }]} />
              </div>
            </li>
          );
        })}
      </ul>
      <MySharing settings={settings.find((s) => s.memberId === viewer.id)} members={members} viewerId={viewer.id} onChange={onChange} />
    </>
  );
}

/** Owned by the parent: what their family can feel of their day. */
function MySharing({ settings, members, viewerId, onChange }: { settings: CareSettings | undefined; members: Member[]; viewerId: string; onChange: () => void }) {
  const others = members.filter((x) => x.id !== viewerId && x.role !== "child");
  const [quiet, setQuiet] = useState(settings?.quietAlert ?? false);
  const [tell, setTell] = useState(settings?.tellMemberId ?? others[0]?.id ?? "");
  const [visits, setVisits] = useState(settings?.shareVisits ?? true);
  const save = async (next: { quietAlert?: boolean; tellMemberId?: string; shareVisits?: boolean }) => {
    await postJson("/api/presence", { quietAlert: next.quietAlert ?? quiet, tellMemberId: (next.tellMemberId ?? tell) || null, graceHours: settings?.graceHours ?? 3, shareVisits: next.shareVisits ?? visits }, "PUT");
    onChange();
  };
  return (
    <section aria-label="What your family can feel" className="mt-8 rounded-card bg-surface p-5">
      <p className="m-0 text-[17px] font-semibold">What your family can feel of your day</p>
      <label className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[15px]">Show when I open Aangan</span>
        <input type="checkbox" className="h-6 w-6 accent-black" checked={visits} onChange={(e) => { setVisits(e.target.checked); void save({ shareVisits: e.target.checked }); }} />
      </label>
      <label className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[15px]">If my day is unusually quiet, gently tell one person</span>
        <input type="checkbox" className="h-6 w-6 accent-black" checked={quiet} onChange={(e) => { setQuiet(e.target.checked); void save({ quietAlert: e.target.checked }); }} />
      </label>
      {quiet && (
        <select className={cn(field, "mt-3 bg-white")} value={tell} onChange={(e) => { setTell(e.target.value); void save({ tellMemberId: e.target.value }); }} aria-label="Who to tell">
          {others.map((x) => (
            <option key={x.id} value={x.id}>
              Tell {callName(x)}
            </option>
          ))}
        </select>
      )}
      <p className="m-0 mt-3 text-[13px] text-ink-faint">Nothing is tracked. &ldquo;Quiet&rdquo; means you haven&rsquo;t shared anything hours after your usual time. Only the person you choose is told.</p>
    </section>
  );
}
