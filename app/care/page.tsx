"use client";

import { useMemo, useState } from "react";
import { useShell } from "@/components/shell";
import { Translated } from "@/components/translated";
import { Avatar, Button, EmptyLine, Icon, MuseMark, RoomHeader, SectionTitle } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import { HELPER_ROLES, NEED_KINDS } from "@/lib/kind-values";
import type { CareSettings, Helper, Need, Presence, Rota } from "@/lib/kinds";
import { language } from "@/lib/languages";
import { callName, memberPhoto } from "@/lib/people";
import { MOMENT_LABEL, at, quietDay, todayFor, whoseWeek } from "@/lib/presence";
import type { Member } from "@/lib/schemas";
import { ago, postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import { householdName, householdOf, households } from "@/lib/households";
import { dayPartIn, placeFromTz, timeIn } from "@/lib/zones";

interface CareData {
  needs: Need[];
  helpers: Helper[];
  rotas: Rota[];
}
interface PresenceData {
  presence: Presence[];
  settings: CareSettings[];
}

const NEED_LABEL: Record<(typeof NEED_KINDS)[number], string> = {
  groceries: "Groceries",
  house: "House",
  ride: "A ride",
  repair: "Repair",
  gas: "Gas",
  errand: "Errand",
  visit: "A visit",
  other: "Other",
};

const field = "h-[52px] w-full rounded-full bg-white px-5 text-[16px] outline-none focus:ring-2 focus:ring-marigold";

// Care circle: caring for a parent from another continent, together.
// Their day (as they share it), whose week it is, what they need, and the
// trusted people in their Village who can actually go. Never surveillance,
// never medical advice: tasks, people and reassurance.
export default function CarePage() {
  const { viewer, members, relationships } = useViewer();
  const care = useJson<CareData>("/api/care");
  const pres = useJson<PresenceData>("/api/presence");
  // Care forms around a *home*: Maa and Papa together, not one of them.
  const homes = households(members, relationships).filter((h) => h.elders);
  const [chosen, setChosen] = useState<string | null>(null);
  const home = homes.find((h) => h.id === chosen) ?? (viewer.role === "elder" ? householdOf(viewer.id, homes) : undefined) ?? homes.find((h) => !h.members.some((m) => m.id === viewer.id)) ?? homes[0];
  const parent = home?.members.find((m) => m.id === viewer.id && m.role === "elder") ?? home?.members[0];
  const ids = home?.members.map((m) => m.id) ?? [];
  const homeName = home ? householdName(home, (m) => callName(m)) : "";
  const reload = () => Promise.all([care.reload(), pres.reload()]);

  if (!parent) {
    return (
      <div>
        <RoomHeader title="Care circle" />
        <div className="rounded-hero bg-surface px-6 py-10 text-center">
          <p className="m-0 text-[20px] font-semibold">Add a parent or grandparent first</p>
          <p className="mx-auto mt-2 max-w-[300px] text-[15px] text-ink-soft">The care circle forms around the elders in your family tree.</p>
        </div>
      </div>
    );
  }
  const isParent = ids.includes(viewer.id) && viewer.role === "elder";

  return (
    <div>
      <RoomHeader title={isParent ? "Your care circle" : `Caring for ${homeName}`} subtitle={isParent ? "Ask for anything. Your family and your Village will see it." : "Their day, what they need, and who can go"} />

      {!isParent && homes.length > 1 && (
        <div className="no-scrollbar -mx-5 mb-5 flex gap-2 overflow-x-auto px-5">
          {homes.map((h) => (
            <button key={h.id} type="button" onClick={() => setChosen(h.id)} aria-pressed={h.id === home?.id} className={cn("press flex h-11 shrink-0 items-center gap-2 rounded-full pl-1 pr-4 text-[15px] font-medium", h.id === home?.id ? "bg-black text-white" : "bg-surface")}>
              <span className="flex -space-x-2">
                {h.members.slice(0, 2).map((m) => (
                  <Avatar key={m.id} src={memberPhoto(m)} name={callName(m)} size={30} />
                ))}
              </span>
              {householdName(h, (m) => callName(m))}
            </button>
          ))}
        </div>
      )}

      {care.data === null || pres.data === null ? (
        <div className="skeleton h-[260px] rounded-hero" aria-busy="true" aria-label="Loading care circle" />
      ) : (
        <>
          {!isParent && (
            <div className="space-y-3">
              {home!.members.filter((m) => m.role === "elder").map((m) => (
                <TheirDay key={m.id} parent={m} presence={pres.data!.presence} settings={pres.data!.settings} viewerId={viewer.id} />
              ))}
            </div>
          )}
          {isParent && <AskForHelp parent={parent} onAsked={reload} />}
          <WhoseWeek parent={parent} homeName={homeName} rota={care.data.rotas.find((r) => ids.includes(r.forMemberId))} members={members} viewerId={viewer.id} onChange={reload} isParent={isParent} />
          <Needs parent={parent} homeName={homeName} home={home!.members} needs={care.data.needs.filter((n) => ids.includes(n.forMemberId))} helpers={care.data.helpers.filter((h) => ids.includes(h.forMemberId))} members={members} viewerId={viewer.id} isParent={isParent} onChange={reload} />
          <Village parent={parent} homeName={homeName} helpers={care.data.helpers.filter((h) => ids.includes(h.forMemberId))} onChange={reload} />
          {isParent && <MySharing settings={pres.data.settings.find((s) => s.memberId === viewer.id)} members={members} viewerId={viewer.id} onChange={reload} />}
        </>
      )}
    </div>
  );
}

function TheirDay({ parent, presence, settings, viewerId }: { parent: Member; presence: Presence[]; settings: CareSettings[]; viewerId: string }) {
  const today = todayFor(parent.id, presence, parent.tz);
  const quiet = quietDay(settings.find((s) => s.memberId === parent.id), viewerId, presence, parent.tz);
  return (
    <section aria-label={`${callName(parent)}'s day`} className="rounded-card bg-surface p-5">
      <div className="flex items-center gap-3">
        <Avatar src={memberPhoto(parent)} name={callName(parent)} size={52} ring />
        <div>
          <p className="m-0 text-[17px] font-semibold">{callName(parent)}&rsquo;s {dayPartIn(parent.tz)}</p>
          <p className="m-0 text-[14px] text-ink-soft">
            {timeIn(parent.tz)} in {placeFromTz(parent.tz)}
          </p>
        </div>
      </div>
      {quiet.quiet && (
        <div className="mt-4 rounded-[18px] bg-[#fff6e6] px-4 py-3" role="status">
          <p className="m-0 text-[15px] font-semibold text-[#8a4b00]">A quiet day so far</p>
          <p className="m-0 mt-0.5 text-[14px] text-[#8a4b00]">{callName(parent)} usually shares something by {Math.floor(quiet.usualHour) % 12 || 12} {quiet.usualHour < 12 ? "AM" : "PM"}. You&rsquo;re the one they asked us to tell. A call might be nice.</p>
        </div>
      )}
      {today.length === 0 ? (
        <p className="m-0 mt-4 text-[15px] text-ink-soft">Nothing shared yet today.</p>
      ) : (
        <ol className="m-0 mt-4 list-none space-y-2.5 border-l-2 border-[var(--line)] p-0 pl-4">
          {today.map((p) => (
            <li key={p.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-marigold" aria-hidden="true" />
              <span className="tnum text-[13px] text-ink-faint">{at(p.at, parent.tz)}</span>
              <span className="ml-2 text-[15px] font-medium">{MOMENT_LABEL[p.moment].label}</span>
              {p.note && <span className="voice block text-[16px] text-ink-soft">{p.note}</span>}
            </li>
          ))}
        </ol>
      )}
      <p className="m-0 mt-4 text-[12px] text-ink-faint">Only what {callName(parent)} chooses to share. Nothing is tracked.</p>
    </section>
  );
}

function AskForHelp({ parent, onAsked }: { parent: Member; onAsked: () => void }) {
  const { openAdd } = useShell();
  const [typing, setTyping] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<(typeof NEED_KINDS)[number]>("other");
  const [busy, setBusy] = useState(false);
  return (
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
        <div className="mt-3 space-y-2">
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="The geyser isn't heating" />
          <KindChips value={kind} onChange={setKind} />
          <Button
            className="w-full"
            disabled={busy || title.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              await postJson("/api/care", { action: "need", forMemberId: parent.id, title: title.trim(), kind });
              setBusy(false);
              setTitle("");
              setTyping(false);
              onAsked();
            }}
          >
            Ask the family
          </Button>
        </div>
      )}
    </section>
  );
}

function KindChips({ value, onChange }: { value: (typeof NEED_KINDS)[number]; onChange: (k: (typeof NEED_KINDS)[number]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kind of help">
      {NEED_KINDS.map((k) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => onChange(k)} className={cn("press h-9 rounded-full px-3.5 text-[14px] font-medium", value === k ? "bg-black text-white" : "bg-white")}>
          {NEED_LABEL[k]}
        </button>
      ))}
    </div>
  );
}

function WhoseWeek({ parent, homeName, rota, members, viewerId, onChange, isParent }: { parent: Member; homeName: string; rota: Rota | undefined; members: Member[]; viewerId: string; onChange: () => void; isParent: boolean }) {
  const name = (id: string) => (id === viewerId ? "You" : callName(members.find((m) => m.id === id)));
  if (!rota) {
    if (isParent) return null;
    return (
      <section aria-label="Whose week" className="mt-4 flex items-center justify-between gap-3 rounded-card bg-surface p-4">
        <p className="m-0 text-[15px]">Nobody is the check-in person yet.</p>
        <Button className="h-11 shrink-0 px-4 text-[14px]" onClick={async () => { await postJson("/api/care", { action: "take-week", forMemberId: parent.id }); onChange(); }}>
          Take this week
        </Button>
      </section>
    );
  }
  const { current, next } = whoseWeek(rota.order, rota.startWeek);
  return (
    <section aria-label="Whose week" className="mt-4 flex items-center gap-3 rounded-card bg-surface p-4">
      <Avatar src={memberPhoto(members.find((m) => m.id === current))} name={name(current)} size={44} />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[16px] font-semibold">{isParent ? `${name(current)} ${current === viewerId ? "are" : "is"} checking in on you this week` : `${name(current)} ${current === viewerId ? "check" : "checks"} in on ${homeName} this week`}</p>
        {next && next !== current && <p className="m-0 text-[13px] text-ink-soft">Next week: {name(next)}</p>}
      </div>
      {!isParent && current !== viewerId && (
        <button type="button" className="press h-10 shrink-0 rounded-full bg-white px-3.5 text-[14px] font-semibold" onClick={async () => { await postJson("/api/care", { action: "take-week", forMemberId: rota.forMemberId }); onChange(); }}>
          I&rsquo;ll take it
        </button>
      )}
    </section>
  );
}

function Needs({ parent, homeName, home, needs, helpers, members, viewerId, isParent, onChange }: { parent: Member; homeName: string; home: Member[]; needs: Need[]; helpers: Helper[]; members: Member[]; viewerId: string; isParent: boolean; onChange: () => void }) {
  const [forId, setForId] = useState(parent.id);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<(typeof NEED_KINDS)[number]>("other");
  const [when, setWhen] = useState("");
  const [showDone, setShowDone] = useState(false);
  const open = needs.filter((n) => n.status !== "done");
  const done = needs.filter((n) => n.status === "done");
  const name = (id: string | null) => (id === viewerId ? "You" : callName(members.find((m) => m.id === id)));
  const act = async (body: Record<string, unknown>) => {
    await postJson("/api/care", body);
    onChange();
  };

  return (
    <section aria-label="Needs">
      <SectionTitle>{isParent ? "What you asked for" : `What ${homeName} need`}</SectionTitle>
      {open.length === 0 && <p className="m-0 text-[15px] text-ink-soft">{isParent ? "Nothing pending." : "Nothing pending. Good."}</p>}
      <ul className="m-0 list-none space-y-3 p-0">
        {open.map((n) => {
          const helper = helpers.find((h) => h.id === n.helperId);
          return (
            <li key={n.id} className="rounded-card bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="m-0 text-[17px] font-semibold leading-snug">{isParent ? <Translated text={n.title} /> : n.title}</p>
                  <p className="m-0 mt-0.5 text-[13px] text-ink-soft">
                    {NEED_LABEL[n.kind]}
                    {n.when ? ` · ${n.when}` : ""} · asked {ago(n.createdAt)}
                    {home.length > 1 ? ` · for ${name(n.forMemberId)}` : ""}
                    {n.askedBy !== n.forMemberId ? ` · by ${name(n.askedBy)}` : ""}
                  </p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold", n.status === "open" ? "bg-[#fff0d6] text-[#8a4b00]" : "bg-[#e6f4ea] text-[#1e6b3a]")}>{n.status === "open" ? "Open" : "On it"}</span>
              </div>
              {n.status === "claimed" && (
                <p className="m-0 mt-2 text-[14px]">
                  {name(n.claimedBy)} {n.claimedBy === viewerId ? "are" : "is"} on it{helper ? ` · ${helper.name} (${helper.role}) will go` : ""}
                </p>
              )}
              {n.noteForParent && (
                <div className="mt-3 rounded-[16px] bg-white px-3.5 py-2.5">
                  <p className="voice m-0 text-[17px] leading-snug">{n.noteForParent}</p>
                  {!isParent && <MuseMark>note for {name(n.forMemberId)} in {language(members.find((m) => m.id === n.forMemberId)?.displayLang ?? "en").native}</MuseMark>}
                </div>
              )}
              {!isParent && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {n.status === "open" && (
                    <button type="button" className="press h-10 rounded-full bg-black px-4 text-[14px] font-semibold text-white" onClick={() => void act({ action: "claim", needId: n.id })}>
                      I&rsquo;ll take care of it
                    </button>
                  )}
                  {helpers.length > 0 && (
                    <select
                      aria-label="Send someone from the Village"
                      className="h-10 rounded-full bg-white px-3 text-[14px] font-semibold"
                      value={n.helperId ?? ""}
                      onChange={(e) => e.target.value && void act({ action: "assign", needId: n.id, helperId: e.target.value })}
                    >
                      <option value="">Send someone…</option>
                      {helpers.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} · {h.role}
                        </option>
                      ))}
                    </select>
                  )}
                  {n.status === "claimed" && (
                    <button type="button" className="press h-10 rounded-full bg-white px-4 text-[14px] font-semibold" onClick={() => void act({ action: "done", needId: n.id })}>
                      Done
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!isParent && (
        <div className="mt-3">
          {!adding ? (
            <button type="button" onClick={() => setAdding(true)} className="press flex h-11 items-center gap-1.5 text-[15px] font-semibold">
              <Icon name="plus" size={18} />
              Add something {homeName} need
            </button>
          ) : (
            <div className="space-y-2 rounded-card bg-surface p-4">
              {home.filter((m) => m.role === "elder").length > 1 && (
                <div className="flex gap-1.5" role="radiogroup" aria-label="For whom">
                  {home.filter((m) => m.role === "elder").map((m) => (
                    <button key={m.id} type="button" role="radio" aria-checked={forId === m.id} onClick={() => setForId(m.id)} className={cn("press h-9 rounded-full px-3.5 text-[14px] font-medium", forId === m.id ? "bg-black text-white" : "bg-white")}>
                      For {callName(m)}
                    </button>
                  ))}
                </div>
              )}
              <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Book the gas cylinder" />
              <KindChips value={kind} onChange={setKind} />
              <input className={field} value={when} onChange={(e) => setWhen(e.target.value)} maxLength={60} placeholder="When (optional)" />
              <div className="flex gap-2">
                <Button
                  className="flex-[1.4]"
                  disabled={title.trim().length < 3}
                  onClick={async () => {
                    await act({ action: "need", forMemberId: forId, title: title.trim(), kind, when: when.trim() });
                    setTitle("");
                    setWhen("");
                    setAdding(false);
                  }}
                >
                  Add
                </Button>
                <Button variant="secondary" className="flex-1 !bg-white" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-4">
          <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} className="flex h-11 items-center gap-1.5 text-[14px] font-medium text-ink-soft">
            {done.length} done recently
            <Icon name="down" size={16} className={cn("transition-transform", showDone && "rotate-180")} />
          </button>
          {showDone && (
            <ul className="m-0 list-none space-y-1.5 p-0">
              {done.map((n) => (
                <li key={n.id} className="flex items-center gap-2 text-[15px] text-ink-soft">
                  <Icon name="check" size={16} />
                  <span className="line-through decoration-black/20">{n.title}</span>
                  <span className="text-[13px] text-ink-faint">· {n.doneAt ? ago(n.doneAt) : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function Village({ parent, homeName, helpers, onChange }: { parent: Member; homeName: string; helpers: Helper[]; onChange: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<(typeof HELPER_ROLES)[number]>("groceries");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const sorted = useMemo(() => [...helpers].sort((a, b) => a.role.localeCompare(b.role)), [helpers]);
  return (
    <section aria-label={`${homeName}'s Village`}>
      <SectionTitle>{homeName}&rsquo;s Village</SectionTitle>
      <p className="m-0 -mt-1 mb-3 text-[14px] text-ink-soft">The trusted people near {homeName}: the ones who can actually go when the family is far away.</p>
      {sorted.length === 0 && <EmptyLine>No one added yet. Start with the person who delivers groceries.</EmptyLine>}
      <ul className="m-0 list-none divide-y divide-[var(--line)] p-0">
        {sorted.map((h) => (
          <li key={h.id} className="flex items-center gap-3 py-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface">
              <Icon name="village" size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold">{h.name}</span>
              <span className="block text-[13px] text-ink-soft">
                {h.role}
                {h.note ? ` · ${h.note}` : ""}
              </span>
            </span>
            {h.phone && (
              <a href={`tel:${h.phone.replace(/\s/g, "")}`} aria-label={`Call ${h.name}`} className="press grid h-10 w-10 place-items-center rounded-full bg-surface text-ink">
                <Icon name="phone" size={18} />
              </a>
            )}
            <button
              type="button"
              aria-label={`Remove ${h.name}`}
              className="press grid h-10 w-10 place-items-center rounded-full text-ink-faint"
              onClick={async () => {
                await postJson("/api/care", { action: "helper-remove", helperId: h.id });
                onChange();
              }}
            >
              <Icon name="close" size={16} />
            </button>
          </li>
        ))}
      </ul>
      {!adding ? (
        <button type="button" onClick={() => setAdding(true)} className="press mt-2 flex h-11 items-center gap-1.5 text-[15px] font-semibold">
          <Icon name="plus" size={18} />
          Add someone to the Village
        </button>
      ) : (
        <div className="mt-2 space-y-2 rounded-card bg-surface p-4">
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Name (Ramesh, Sunita didi…)" />
          <select className={field} value={role} onChange={(e) => setRole(e.target.value as (typeof HELPER_ROLES)[number])} aria-label="What they help with">
            {HELPER_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input className={field} value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^+\d\s()-]/g, ""))} inputMode="tel" maxLength={30} placeholder="Phone (optional)" />
          <input className={field} value={note} onChange={(e) => setNote(e.target.value)} maxLength={160} placeholder="A note (Delivers before 11)" />
          <div className="flex gap-2">
            <Button
              className="flex-[1.4]"
              disabled={!name.trim()}
              onClick={async () => {
                await postJson("/api/care", { action: "helper", forMemberId: parent.id, name: name.trim(), role, phone: phone.trim(), note: note.trim() });
                setName("");
                setPhone("");
                setNote("");
                setAdding(false);
                onChange();
              }}
            >
              Add
            </Button>
            <Button variant="secondary" className="flex-1 !bg-white" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Owned by the parent: what their family can feel of their day. */
function MySharing({ settings, members, viewerId, onChange }: { settings: CareSettings | undefined; members: Member[]; viewerId: string; onChange: () => void }) {
  const others = members.filter((m) => m.id !== viewerId && m.role !== "child");
  const [quiet, setQuiet] = useState(settings?.quietAlert ?? false);
  const [tell, setTell] = useState(settings?.tellMemberId ?? others[0]?.id ?? "");
  const [visits, setVisits] = useState(settings?.shareVisits ?? true);
  const save = async (next: { quietAlert?: boolean; tellMemberId?: string; shareVisits?: boolean }) => {
    const body = { quietAlert: next.quietAlert ?? quiet, tellMemberId: (next.tellMemberId ?? tell) || null, graceHours: settings?.graceHours ?? 3, shareVisits: next.shareVisits ?? visits };
    await postJson("/api/presence", body, "PUT");
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
        <select className={cn(field, "mt-3")} value={tell} onChange={(e) => { setTell(e.target.value); void save({ tellMemberId: e.target.value }); }} aria-label="Who to tell">
          {others.map((m) => (
            <option key={m.id} value={m.id}>
              Tell {callName(m)}
            </option>
          ))}
        </select>
      )}
      <p className="m-0 mt-3 text-[13px] text-ink-faint">Nothing is tracked. &ldquo;Quiet&rdquo; means you haven&rsquo;t shared anything hours after your usual time. Only the person you choose is told, and you can turn it off anytime.</p>
    </section>
  );
}
