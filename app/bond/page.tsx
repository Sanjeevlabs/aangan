"use client";

import { useCallback, useEffect, useState } from "react";
import type { Member, Relationship } from "@/lib/schemas";
import { Avatar, Button, EmptyLine, RoomHeader } from "@/components/ui/kit";
import { callName, memberPhoto } from "@/lib/people";
import { cn } from "@/lib/utils";
import { useViewer } from "@/components/viewer";
import { LivingTree, TreeLegend } from "@/components/family-tree";
import { can } from "@/lib/permissions";
import { ZONES, placeFromTz } from "@/lib/zones";

const RELATION_WORDS = ["mother", "father", "wife", "husband", "daughter", "son", "sister", "brother"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function GuidedAdd({ onAdded }: { onAdded: () => void }) {
  const { viewer, members } = useViewer();
  const [anchorId, setAnchorId] = useState(viewer.id);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("mother");
  const [tz, setTz] = useState<string>("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [welcomed, setWelcomed] = useState<string | null>(null);
  const anchor = members.find((m) => m.id === anchorId);

  const submit = async () => {
    const clean = name.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/relationships", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memberId: anchorId,
          newMemberName: clean,
          relation,
          tz: tz || anchor?.tz || undefined,
          birthday: month && day ? `${month}-${day}` : undefined,
        }),
      });
      if (!res.ok) throw new Error(res.status === 409 ? "duplicate" : res.status === 401 ? "signed-out" : "add-failed");
      const data = (await res.json()) as { member: Member };
      // "Welcome to the family" moment: a Bond card lands in Memory Lane.
      await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "photo",
          caption: `Welcome to the family, ${clean}`,
          lang: "en",
          takenAt: new Date().toISOString(),
          source: "agent",
          mediaRef: null,
          peaks: [],
          palette: [],
        }),
      }).catch(() => undefined);
      setWelcomed(data.member.displayName);
      setName("");
      setMonth("");
      setDay("");
      onAdded();
    } catch (e) {
      const key = e instanceof Error ? e.message : "";
      setError(key === "duplicate" ? `${clean} is already in the family.` : key === "signed-out" ? "Your session ended. Sign in again to add family." : "Couldn't add them. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Add someone" className="mt-10">
      <h2 className="m-0 mb-1 text-[20px]">Add someone</h2>
      <p className="m-0 mb-4 text-[15px] text-ink-soft">Tell Aangan how they&rsquo;re related to someone already here.</p>
      {welcomed && (
        <div className="bond-bloom mb-4 rounded-[22px] bg-[#fff6e6] px-4 py-3" role="status">
          <p className="m-0 text-[17px] font-semibold">Welcome to the family, {welcomed}</p>
          <p className="m-0 text-[14px] text-ink-soft">A welcome card is waiting in Memory Lane.</p>
        </div>
      )}
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">Their name</span>
        <input
          type="text"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          placeholder="Meera"
          className="h-[52px] w-full rounded-full bg-surface px-5 text-[16px] outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-marigold"
        />
      </label>
      <p className="m-0 mb-1.5 mt-4 text-[13px] font-medium text-ink-soft">They are the</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Relation">
        {RELATION_WORDS.map((w) => (
          <button
            key={w}
            type="button"
            role="radio"
            aria-checked={relation === w}
            onClick={() => setRelation(w)}
            className={cn("press h-10 rounded-full px-4 text-[15px] font-medium", relation === w ? "bg-black text-white" : "bg-surface")}
          >
            {w}
          </button>
        ))}
      </div>
      <p className="m-0 mb-1.5 mt-4 text-[13px] font-medium text-ink-soft">of</p>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="radiogroup" aria-label="Related to">
        {members.map((mm) => (
          <button
            key={mm.id}
            type="button"
            role="radio"
            aria-checked={anchorId === mm.id}
            onClick={() => setAnchorId(mm.id)}
            className={cn("press flex h-11 shrink-0 items-center gap-2 rounded-full pl-1 pr-4 text-[15px] font-medium", anchorId === mm.id ? "bg-black text-white" : "bg-surface")}
          >
            <Avatar src={memberPhoto(mm)} name={callName(mm)} size={34} />
            {mm.id === viewer.id ? "You" : callName(mm)}
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="col-span-2 block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">Where they live</span>
          <select value={tz || anchor?.tz || ""} onChange={(e) => setTz(e.target.value)} className="h-[52px] w-full appearance-none rounded-full bg-surface px-5 text-[16px] outline-none focus:ring-2 focus:ring-marigold">
            {Array.from(new Set([anchor?.tz, ...ZONES.map((z) => z.tz)].filter((z): z is string => Boolean(z) && z !== "UTC"))).map((z) => (
              <option key={z} value={z}>
                {placeFromTz(z)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">Birthday (optional)</span>
          <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Birthday month" className="h-[52px] w-full appearance-none rounded-full bg-surface px-5 text-[16px] outline-none">
            <option value="">Month</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, "0")}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-transparent">Day</span>
          <select value={day} onChange={(e) => setDay(e.target.value)} aria-label="Birthday day" className="h-[52px] w-full appearance-none rounded-full bg-surface px-5 text-[16px] outline-none">
            <option value="">Day</option>
            {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => (
              <option key={d} value={d}>
                {Number(d)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p className="m-0 mt-3 text-[14px] text-[#b42318]" role="alert">
          {error}
        </p>
      )}
      <Button className="mt-5 w-full" disabled={busy || !name.trim()} onClick={() => void submit()}>
        {busy ? "Adding…" : name.trim() && anchor ? `Add ${name.trim()} as ${anchor.id === viewer.id ? "your" : `${callName(anchor)}'s`} ${relation}` : "Add to the family"}
      </Button>
      <style>{`.bond-bloom{animation:bond-grow .32s cubic-bezier(.32,.72,0,1)}@keyframes bond-grow{from{transform:scale(.96);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
    </section>
  );
}

// Plain English for the common paths; anything else falls through to the
// model-resolved term. Gender-neutral where the path doesn't say.
const PLAIN_KIN: Record<string, string> = {
  mother: "your mother",
  father: "your father",
  "father's mother": "your grandmother",
  "mother's mother": "your grandmother",
  "father's father": "your grandfather",
  "mother's father": "your grandfather",
  "father's child": "your sibling",
  "mother's child": "your sibling",
  "parent's child": "your sibling",
  child: "your child",
  wife: "your wife",
  husband: "your husband",
};
function plainKin(term: string): string {
  const t = term.trim().toLowerCase();
  if (!t) return "";
  return PLAIN_KIN[t] ?? (t.startsWith("your ") ? t : `your ${t}`);
}

/** "Your grandmother": kinship from the viewer, resolved deterministically server-side. */
function useKinship(targetIds: string[]): Record<string, string> {
  const { viewer, displayLang } = useViewer();
  const [terms, setTerms] = useState<Record<string, string>>({});
  const key = targetIds.join(",");
  useEffect(() => {
    let live = true;
    Promise.all(
      targetIds
        .filter((id) => id !== viewer.id)
        .map((id) =>
          fetch(`/api/kinship?from=${encodeURIComponent(viewer.id)}&to=${encodeURIComponent(id)}&lang=${encodeURIComponent(displayLang)}`, { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .then((d: { terms?: string } | null) => [id, d?.terms ?? ""] as const)
            .catch(() => [id, ""] as const),
        ),
    ).then((pairs) => live && setTerms(Object.fromEntries(pairs)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, viewer.id, displayLang]);
  return terms;
}

export default function BondPage() {
  const { viewer, refreshMembers } = useViewer();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [relationships, setRelationships] = useState<Relationship[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [mRes, rRes] = await Promise.all([fetch("/api/members", { cache: "no-store" }), fetch("/api/relationships", { cache: "no-store" })]);
      if (!mRes.ok || !rRes.ok) throw new Error("bond-fetch-failed");
      setMembers(((await mRes.json()) as { members: Member[] }).members);
      setRelationships(((await rRes.json()) as { relationships: Relationship[] }).relationships);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kin = useKinship((members ?? []).map((m) => m.id));

  return (
    <div>
      <RoomHeader title="Family tree" subtitle={members ? `${members.length} people · tap anyone to see or edit them` : undefined} />
      {failed && <EmptyLine>Couldn&rsquo;t load the family. Try again in a moment.</EmptyLine>}
      {members === null && !failed && <div className="skeleton h-[420px] rounded-card" aria-busy="true" aria-label="Loading family" />}
      {members && (
        <>
          <section aria-label="Family tree">
            <LivingTree members={members} relationships={relationships ?? []} viewerId={viewer.id} kin={Object.fromEntries(members.map((m) => [m.id, plainKin(kin[m.id] ?? "")]))} />
            <TreeLegend />
          </section>
          {can(viewer, "tree.add") ? (
          <GuidedAdd
            onAdded={() => {
              void load();
              void refreshMembers();
            }}
          />
          ) : (
            <p className="m-0 mt-8 text-center text-[14px] text-ink-soft">Ask a grown-up in the family to add people.</p>
          )}
        </>
      )}
    </div>
  );
}
