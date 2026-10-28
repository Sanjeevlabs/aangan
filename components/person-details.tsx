"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Member } from "@/lib/schemas";
import { callName } from "@/lib/people";
import { cn } from "@/lib/utils";
import { ZONES, placeFromTz } from "@/lib/zones";
import { Button } from "./ui/kit";
import { useViewer } from "./viewer";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ROLES: { value: Member["role"]; label: string }[] = [
  { value: "elder", label: "Grandparent generation" },
  { value: "adult", label: "Parent generation" },
  { value: "child", label: "Child" },
];
const field = "h-[52px] w-full appearance-none rounded-full bg-surface px-5 text-[16px] outline-none focus:ring-2 focus:ring-marigold";

/**
 * About this person: edit their details or remove them from the tree.
 * Rules mirror the server: a person with their own account manages themselves.
 */
export function PersonDetails({ person, onChanged }: { person: Member; onChanged: () => void }) {
  const router = useRouter();
  const { viewer, refreshMembers } = useViewer();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [name, setName] = useState(person.displayName);
  const [role, setRole] = useState(person.role);
  const [tz, setTz] = useState(person.tz);
  const [month, setMonth] = useState(person.birthday.slice(0, 2));
  const [day, setDay] = useState(person.birthday.slice(3, 5));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSelf = person.id === viewer.id;
  const hasAccount = Boolean(person.email);
  const manageable = !hasAccount || isSelf;

  if (isSelf) return null; // You edit yourself in Settings.

  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/members/${encodeURIComponent(person.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: name.trim(), role, tz, birthday: month && day ? `${month}-${day}` : "" }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError("Couldn't save. Try again.");
    await refreshMembers();
    setEditing(false);
    onChanged();
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/members/${encodeURIComponent(person.id)}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError("Couldn't remove them. Try again.");
    await refreshMembers();
    router.replace("/bond");
  };

  return (
    <section aria-label={`About ${callName(person)}`} className="mt-10 rounded-card bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[20px]">About {callName(person)}</h2>
          <p className="m-0 mt-1 text-[14px] text-ink-soft">
            {placeFromTz(person.tz)}
            {person.birthday ? ` · born ${MONTHS[Number(person.birthday.slice(0, 2)) - 1]} ${Number(person.birthday.slice(3))}` : " · birthday not added"}
          </p>
        </div>
        {manageable && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="press h-10 rounded-full bg-white px-4 text-[14px] font-semibold">
            Edit
          </button>
        )}
      </div>

      {!manageable && <p className="m-0 mt-3 text-[14px] text-ink-soft">{callName(person)} has their own account, so only they can change these details.</p>}

      {editing && (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">What the family calls them</span>
            <input className={cn(field, "bg-white")} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">Generation</span>
            <select className={cn(field, "bg-white")} value={role} onChange={(e) => setRole(e.target.value as Member["role"])}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">Where they live</span>
            <select className={cn(field, "bg-white")} value={tz} onChange={(e) => setTz(e.target.value)}>
              {Array.from(new Set([tz, ...ZONES.map((z) => z.tz)])).map((z) => (
                <option key={z} value={z}>
                  {placeFromTz(z)}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Birthday month" className={cn(field, "bg-white")} value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">Birthday month</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={String(i + 1).padStart(2, "0")}>
                  {m}
                </option>
              ))}
            </select>
            <select aria-label="Birthday day" className={cn(field, "bg-white")} value={day} onChange={(e) => setDay(e.target.value)}>
              <option value="">Day</option>
              {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => (
                <option key={d} value={d}>
                  {Number(d)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <Button className="flex-1" disabled={busy || !name.trim()} onClick={() => void save()}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button variant="secondary" className="flex-1 !bg-white" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {manageable && !editing && (
        <div className="mt-5 border-t border-[var(--line)] pt-4">
          {!confirm ? (
            <button type="button" onClick={() => setConfirm(true)} className="h-11 text-[15px] font-medium text-[#b42318]">
              Remove from the family tree
            </button>
          ) : (
            <div role="alertdialog" aria-label="Confirm removal">
              <p className="m-0 text-[15px]">Remove {callName(person)}? Their place in the tree and anything saved about them goes too. Voice notes and photos others shared stay.</p>
              <div className="mt-3 flex gap-2">
                <Button className="flex-1 !bg-[#b42318]" disabled={busy} onClick={() => void remove()}>
                  {busy ? "Removing…" : "Remove"}
                </Button>
                <Button variant="secondary" className="flex-1 !bg-white" onClick={() => setConfirm(false)}>
                  Keep
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      {error && (
        <p className="m-0 mt-3 text-[14px] text-[#b42318]" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
