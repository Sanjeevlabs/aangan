"use client";

import { useState } from "react";
import { callName, memberPhoto } from "@/lib/people";
import type { Member, Relationship } from "@/lib/schemas";
import { resetFamilyCards } from "@/lib/use-family";
import { postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import { Avatar, Button, Icon } from "./ui/kit";
import { useViewer } from "./viewer";

// Two courtyards, one door. A couple and their children belong to both
// families' Aangans; each side stays its own (nothing crosses unless shared).

export interface Side {
  familyId: string;
  memberId: string;
  name: string;
  people: number;
}

export function useSides() {
  const { data, reload } = useJson<{ current: string; sides: Side[] }>("/api/sides");
  return { sides: data?.sides ?? [], current: data?.current ?? null, reload };
}

async function openSide(familyId: string): Promise<void> {
  const out = await postJson("/api/sides", { action: "switch", familyId });
  if (!out) return;
  resetFamilyCards();
  // A clean load: every room re-reads the other side's data.
  window.location.assign("/");
}

/** "Sharma · Iyer" under the courtyard title, only when you have two sides. */
export function SideSwitch() {
  const { sides, current } = useSides();
  const [busy, setBusy] = useState<string | null>(null);
  if (sides.length < 2) return null;
  return (
    <div className="mt-3 inline-flex rounded-full bg-surface p-1" role="tablist" aria-label="Family side">
      {sides.map((s) => (
        <button
          key={s.familyId}
          type="button"
          role="tab"
          aria-selected={s.familyId === current}
          disabled={busy !== null}
          onClick={() => {
            if (s.familyId === current) return;
            setBusy(s.familyId);
            void openSide(s.familyId);
          }}
          className={cn("press h-9 rounded-full px-4 text-[14px] font-semibold", s.familyId === current ? "bg-white text-ink shadow-sm" : "text-ink-soft")}
        >
          {busy === s.familyId ? "Opening…" : `${s.name} side`}
        </button>
      ))}
    </div>
  );
}

/** My spouse and children in this family: the "door" that comes with me. */
function myHome(viewerId: string, members: Member[], rels: Relationship[]): Member[] {
  const ids = new Set<string>();
  for (const r of rels) {
    if (r.memberId === viewerId && (r.canonicalKind === "spouse" || r.canonicalKind === "child")) ids.add(r.relationMemberId);
    if (r.relationMemberId === viewerId && (r.canonicalKind === "spouse" || r.canonicalKind === "parent")) ids.add(r.memberId);
  }
  return members.filter((m) => ids.has(m.id));
}

export function BothSides() {
  const { viewer, members, relationships } = useViewer();
  const { sides, current } = useSides();
  const [adding, setAdding] = useState(false);
  const grownUp = viewer.access !== "child" && viewer.role !== "child";
  if (sides.length === 0) return null;
  return (
    <section aria-label="Both sides of the family" className="mt-10">
      <h2 className="m-0 text-[20px]">Both sides</h2>
      <p className="m-0 mb-3 mt-1 text-[14px] text-ink-soft">Each side of the family keeps its own Aangan. Your home belongs to both.</p>
      <ul className="m-0 list-none space-y-2 p-0">
        {sides.map((s) => (
          <li key={s.familyId}>
            <button
              type="button"
              onClick={() => s.familyId !== current && void openSide(s.familyId)}
              className={cn("press flex w-full items-center gap-3 rounded-card px-4 py-3.5 text-left", s.familyId === current ? "bg-[#fff2d6]" : "bg-surface")}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[17px] font-bold">{s.name.slice(0, 1)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold">{s.name} Aangan</span>
                <span className="block text-[13px] text-ink-soft">
                  {s.people} people{s.familyId === current ? " · you're here" : ""}
                </span>
              </span>
              {s.familyId !== current && <Icon name="chevron" size={18} className="text-ink-faint" />}
            </button>
          </li>
        ))}
      </ul>
      {grownUp && viewer.familyId.startsWith("demo-") && <p className="m-0 mt-3 text-[13px] text-ink-faint">In your own family, you can add your side here.</p>}
      {grownUp && !viewer.familyId.startsWith("demo-") && sides.length < 4 && (
        <button type="button" onClick={() => setAdding(true)} className="press mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-dashed border-black/15 text-[15px] font-semibold">
          <Icon name="plus" size={18} />
          {sides.length === 1 ? "Add your family's side" : "Add another side"}
        </button>
      )}
      {adding && <AddSideSheet home={myHome(viewer.id, members, relationships)} onClose={() => setAdding(false)} />}
    </section>
  );
}

function AddSideSheet({ home, onClose }: { home: Member[]; onClose: () => void }) {
  const [name, setName] = useState("");
  const [bring, setBring] = useState<string[]>(home.map((m) => m.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ familyId: string; invite: { code: string } } | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Add your family's side">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="relative w-full max-w-[480px] rounded-t-[32px] bg-white px-5 pt-5 shadow-frost" style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}>
        {made ? (
          <>
            <p className="m-0 text-[21px] font-semibold">The {name.trim()} Aangan is ready</p>
            <p className="m-0 mt-1 text-[15px] text-ink-soft">Send this code to your parents, brothers and sisters. It works for 7 days.</p>
            <p className="tnum m-0 mt-4 rounded-[22px] bg-surface py-4 text-center text-[28px] font-bold tracking-[0.12em]">{made.invite.code}</p>
            <Button
              className="mt-4 w-full"
              onClick={async () => {
                const text = `Join our family on Aangan. Your code: ${made.invite.code}`;
                try {
                  if (navigator.share) await navigator.share({ title: "Aangan", text, url: window.location.origin });
                  else await navigator.clipboard.writeText(`${text}\n${window.location.origin}`);
                } catch {
                  /* dismissed */
                }
              }}
            >
              Share the code
            </Button>
            <Button variant="secondary" className="mt-2 w-full" onClick={() => window.location.assign("/")}>
              Open the {name.trim()} Aangan
            </Button>
          </>
        ) : (
          <>
            <p className="m-0 text-[21px] font-semibold">Add your family&rsquo;s side</p>
            <p className="m-0 mt-1 text-[15px] text-ink-soft">A separate Aangan for your parents&rsquo; family. Nothing from this side shows there unless you share it.</p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">Family name</span>
              <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="Your parents' family name" className="h-[52px] w-full rounded-full bg-surface px-5 text-[16px] outline-none focus:ring-2 focus:ring-marigold" />
            </label>
            {home.length > 0 && (
              <>
                <p className="m-0 mb-2 mt-4 text-[13px] font-medium text-ink-soft">Your home comes with you</p>
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                  {home.map((m) => {
                    const on = bring.includes(m.id);
                    return (
                      <li key={m.id}>
                        <button type="button" aria-pressed={on} onClick={() => setBring((b) => (on ? b.filter((x) => x !== m.id) : [...b, m.id]))} className={cn("press flex h-11 items-center gap-2 rounded-full pl-1 pr-4 text-[15px] font-medium", on ? "bg-ink text-white" : "bg-surface")}>
                          <Avatar src={memberPhoto(m)} name={callName(m)} size={34} />
                          {callName(m)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {error && (
              <p className="m-0 mt-3 text-[14px] text-[#b42318]" role="alert">
                {error}
              </p>
            )}
            <Button
              className="mt-5 w-full"
              disabled={busy || !name.trim()}
              onClick={async () => {
                setBusy(true);
                setError(null);
                const out = await postJson<{ familyId: string; invite: { code: string } }>("/api/sides", { action: "create", familyName: name.trim(), bring });
                setBusy(false);
                if (out) {
                  resetFamilyCards();
                  setMade(out);
                } else setError("Couldn't create it. Try again in a moment.");
              }}
            >
              {busy ? "Creating…" : "Create the Aangan"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
