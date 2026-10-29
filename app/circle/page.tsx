"use client";

import { useState } from "react";
import { Avatar, Button, EmptyLine, Icon, RoomHeader } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import { householdName, households, type Household } from "@/lib/households";
import { HELPER_ROLES, type Helper } from "@/lib/kinds";
import { callName, memberPhoto } from "@/lib/people";
import { postJson, useJson } from "@/lib/use-json";
import { placeFromTz } from "@/lib/zones";
import { emergencyNumber } from "@/lib/circle";

// The local circle (SPEC §29.9): for every home, the few people nearby to call
// first if something is wrong. Both ways: a father in Amritsar sees who is
// near his son in Bengaluru, and the son sees who is near his parents. Not an
// emergency service: the local emergency number is always one tap away.

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

export default function CirclePage() {
  const { viewer, members, relationships } = useViewer();
  const { data, reload } = useJson<{ helpers: Helper[] }>("/api/care");
  const homes = households(members, relationships)
    .filter((h) => h.members.some((m) => m.role !== "child"))
    // Your home first, then the parents', then everyone else.
    .sort((a, b) => Number(b.members.some((m) => m.id === viewer.id)) - Number(a.members.some((m) => m.id === viewer.id)) || Number(b.elders) - Number(a.elders));
  return (
    <div>
      <RoomHeader title="Local circle" subtitle="For every home, the people nearby to call first" />
      {data === null && <div className="skeleton h-[300px] rounded-card" aria-busy="true" aria-label="Loading" />}
      {data && homes.map((h) => <HomeCircle key={h.id} home={h} helpers={(data.helpers ?? []).filter((x) => x.emergency && h.members.some((m) => m.id === x.forMemberId))} onChange={reload} />)}
    </div>
  );
}

function HomeCircle({ home, helpers, onChange }: { home: Household; helpers: Helper[]; onChange: () => void }) {
  const { viewer } = useViewer();
  const mine = home.members.some((m) => m.id === viewer.id);
  const [adding, setAdding] = useState(false);
  const city = home.members.find((m) => m.city)?.city || placeFromTz(home.tz);
  const sos = emergencyNumber(home.tz);
  return (
    <section aria-label={`Around ${householdName(home, callName)}`} className="mb-8">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex -space-x-2">
          {home.members.filter((m) => m.role !== "child").slice(0, 3).map((m) => (
            <span key={m.id} className="rounded-full ring-2 ring-white">
              <Avatar src={memberPhoto(m)} name={callName(m)} size={34} />
            </span>
          ))}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 truncate text-[18px]">{mine ? "Around you" : `Around ${householdName(home, callName)}`}</h2>
          <p className="m-0 text-[13px] text-ink-soft">{city}</p>
        </div>
        <a href={`tel:${sos}`} className="press flex h-10 items-center gap-1.5 rounded-full bg-[#fde3df] px-3.5 text-[14px] font-semibold text-[#a3271b] no-underline" aria-label={`Emergency services in ${city}: ${sos}`}>
          <Icon name="phone" size={15} /> {sos}
        </a>
      </div>
      {helpers.length === 0 ? (
        <EmptyLine>{mine ? "Add one or two people near you, so your family knows who to call." : "No one yet. Ask them who lives close and would come."}</EmptyLine>
      ) : (
        <ul className="m-0 list-none overflow-hidden rounded-[22px] bg-surface p-0">
          {helpers.map((h, i) => (
            <li key={h.id} className={i ? "border-t border-[var(--line)]" : ""}>
              <div className="flex items-center gap-3 px-3.5 py-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#2f7a4c]">
                  <Icon name="shield" size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold leading-tight">{h.name}</span>
                  <span className="block truncate text-[13px] text-ink-soft">
                    {h.role}
                    {h.note ? ` · ${h.note}` : ""}
                  </span>
                </span>
                {h.phone && (
                  <a href={tel(h.phone)} className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#2f9e5b] text-white" aria-label={`Call ${h.name}`}>
                    <Icon name="phone" size={18} />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {(mine || viewer.access !== "child") &&
        (adding ? (
          <AddToCircle forMemberId={mine ? viewer.id : home.members[0].id} onDone={() => { setAdding(false); onChange(); }} />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="press mt-2 flex h-11 items-center gap-2 px-1 text-[15px] font-semibold text-accent">
            <Icon name="plus" size={17} /> Add someone nearby
          </button>
        ))}
    </section>
  );
}

function AddToCircle({ forMemberId, onDone }: { forMemberId: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<Helper["role"]>("friend");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = "h-12 w-full rounded-[14px] bg-white px-4 text-[15px] outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-marigold";
  return (
    <div className="mt-2 space-y-2 rounded-[22px] bg-surface p-3">
      <input className={input} placeholder="Name" value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} aria-label="Name" />
      <div className="flex gap-2">
        <select className={input} value={role} onChange={(e) => setRole(e.target.value as Helper["role"])} aria-label="Who they are">
          {HELPER_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input className={input} placeholder="Phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.slice(0, 30))} aria-label="Phone" />
      </div>
      <input className={input} placeholder="Where, and anything useful (has a spare key…)" value={note} onChange={(e) => setNote(e.target.value.slice(0, 160))} aria-label="Note" />
      <label className="flex items-start gap-2.5 px-1 py-1 text-[14px] text-ink-soft">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-[#b76a00]" />
        They know they&rsquo;re in our circle and are happy for the family to call them.
      </label>
      {error && <p className="m-0 px-1 text-[13px] text-[#a3271b]">{error}</p>}
      <div className="flex gap-2">
        <Button
          disabled={!name.trim() || !consent}
          onClick={async () => {
            const out = await postJson("/api/care", { action: "helper", forMemberId, name: name.trim(), role, phone, note, emergency: true, consent });
            if (!out) return setError("Couldn't add. Check the phone number.");
            onDone();
          }}
        >
          Add to circle
        </Button>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
