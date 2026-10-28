"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { strings } from "@/lib/i18n";
import type { Member, Relationship } from "@/lib/schemas";
import { PrimaryButton } from "@/components/ui/buttons";
import { useViewer } from "@/components/viewer";

const RELATION_WORDS = [
  "mother",
  "father",
  "sister",
  "brother",
  "daughter",
  "son",
  "wife",
  "husband",
  "parent",
  "child",
  "sibling",
  "spouse",
];

interface TreeNode {
  member: Member;
  generation: number;
  x: number;
  y: number;
}

// Layered generations: BFS depth from roots (members nobody calls parent).
// Roots sit at generation 0; spouses share a generation. Positions spread
// evenly per layer — a simple readable tree, not a graph layout.
function layoutTree(members: Member[], relationships: Relationship[]): { nodes: TreeNode[]; edges: { x1: number; y1: number; x2: number; y2: number; dashed: boolean }[] } {
  const parentOf = new Map<string, string>();
  const spouseOf = new Map<string, string>();
  for (const r of relationships) {
    if (r.canonicalKind === "parent") parentOf.set(r.memberId, r.relationMemberId);
    if (r.canonicalKind === "child") parentOf.set(r.relationMemberId, r.memberId);
    if (r.canonicalKind === "spouse") {
      spouseOf.set(r.memberId, r.relationMemberId);
      spouseOf.set(r.relationMemberId, r.memberId);
    }
  }
  const gen = new Map<string, number>();
  const roots = members.filter((m) => !parentOf.has(m.id));
  const queue: string[] = [];
  for (const r of roots.length > 0 ? roots : members.slice(0, 1)) {
    if (!gen.has(r.id)) {
      gen.set(r.id, 0);
      queue.push(r.id);
    }
  }
  // Spouses share a generation before children are layered.
  spouseOf.forEach((b, a) => {
    if (gen.has(a) && !gen.has(b)) {
      gen.set(b, gen.get(a) as number);
      queue.push(b);
    }
  });
  const childrenOf = new Map<string, string[]>();
  parentOf.forEach((parent, child) => {
    const list = childrenOf.get(parent) ?? [];
    list.push(child);
    childrenOf.set(parent, list);
  });
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    const g = gen.get(cur) as number;
    for (const child of childrenOf.get(cur) ?? []) {
      if (!gen.has(child)) {
        gen.set(child, g + 1);
        queue.push(child);
        const sp = spouseOf.get(child);
        if (sp && !gen.has(sp)) {
          gen.set(sp, g + 1);
          queue.push(sp);
        }
      }
    }
  }
  members.forEach((m) => {
    if (!gen.has(m.id)) gen.set(m.id, 0);
  });

  const byGen = new Map<number, Member[]>();
  for (const m of members) {
    const g = gen.get(m.id) as number;
    const list = byGen.get(g) ?? [];
    list.push(m);
    byGen.set(g, list);
  }
  const W = 440;
  const nodes: TreeNode[] = [];
  const pos = new Map<string, { x: number; y: number }>();
  const gens = Array.from(byGen.keys()).sort((a, b) => a - b);
  for (const g of gens) {
    const list = byGen.get(g) as Member[];
    list.forEach((m, i) => {
      const x = W * ((i + 1) / (list.length + 1));
      const y = 60 + g * 120;
      pos.set(m.id, { x, y });
      nodes.push({ member: m, generation: g, x, y });
    });
  }
  const edges: { x1: number; y1: number; x2: number; y2: number; dashed: boolean }[] = [];
  for (const r of relationships) {
    const a = pos.get(r.memberId);
    const b = pos.get(r.relationMemberId);
    if (!a || !b) continue;
    edges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, dashed: r.canonicalKind !== "parent" && r.canonicalKind !== "child" });
  }
  return { nodes, edges };
}

function GuidedAdd({ onAdded }: { onAdded: () => void }) {
  const { viewer, members, lang } = useViewer();
  const t = strings(lang);
  const [anchorId, setAnchorId] = useState(viewer.id);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("mother");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [welcomed, setWelcomed] = useState<string | null>(null);

  const submit = async () => {
    const clean = name.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/relationships", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: anchorId, newMemberName: clean, newMemberRole: "adult", relation }),
      });
      if (!res.ok) throw new Error(res.status === 409 ? "duplicate" : "add-failed");
      const data = (await res.json()) as { member: Member };
      // "Welcome to the family" bloom + Bond card (source agent feeds Lane).
      await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "photo",
          caption: `Welcome to the family, ${clean}!`,
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
      onAdded();
    } catch {
      setError(t.common.retry);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Add family" className="mb-6">
      <h2 className="mb-2 mt-0 text-xl">Add to the Bond</h2>
      {welcomed && (
        <div className="bond-bloom mb-3 rounded-card bg-surface px-4 py-3" role="status">
          <p className="serif m-0 text-lg">Welcome to the family, {welcomed}</p>
        </div>
      )}
      <div className="rounded-card border border-line bg-surface p-4">
        <label className="block text-sm font-medium">
          <span className="text-ink-soft">Known member</span>
          <select
            value={anchorId}
            onChange={(e) => setAnchorId(e.target.value)}
            className="tap mt-1 w-full rounded-card border border-line bg-paper px-3 text-[15px]"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm font-medium">
          <span className="text-ink-soft">New member name</span>
          <input
            type="text"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dadi"
            className="tap mt-1 w-full rounded-card border border-line bg-paper px-3 text-[15px]"
          />
        </label>
        <div className="mt-1 text-sm text-ink-soft">
          {(() => {
            const anchor = members.find((m) => m.id === anchorId);
            return anchor && name.trim() ? `Add ${name.trim()} as ${anchor.displayName}'s ${relation}` : " ";
          })()}
        </div>
        <label className="mt-3 block text-sm font-medium">
          <span className="text-ink-soft">Relation word</span>
          <select
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
            className="tap mt-1 w-full rounded-card border border-line bg-paper px-3 text-[15px]"
          >
            {RELATION_WORDS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p className="mt-2 text-sm text-accent" role="alert">
            {error}
          </p>
        )}
        <PrimaryButton className="mt-4 w-full" disabled={busy || !name.trim()} onClick={() => void submit()}>
          {busy ? "…" : "Add"}
        </PrimaryButton>
      </div>
      <style>{`.bond-bloom{animation:bond-grow .3s ease-out}@keyframes bond-grow{from{transform:scale(.96);opacity:.4}to{transform:scale(1);opacity:1}}`}</style>
    </section>
  );
}

function KinshipLookup({ members }: { members: Member[] }) {
  const { viewer, displayLang } = useViewer();
  const [targetId, setTargetId] = useState("dadi");
  const [terms, setTerms] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setTerms(null);
    fetch(`/api/kinship?from=${encodeURIComponent(viewer.id)}&to=${encodeURIComponent(targetId)}&lang=${encodeURIComponent(displayLang)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { terms?: string } | null) => {
        if (live) setTerms(data?.terms ?? "family");
      })
      .catch(() => {
        if (live) setTerms("family");
      });
    return () => {
      live = false;
    };
  }, [viewer.id, targetId, displayLang]);

  return (
    <section aria-label="Kinship" className="mb-6">
      <h2 className="mb-2 mt-0 text-xl">Who is who</h2>
      <div className="rounded-card border border-line bg-surface p-4">
        <label className="block text-sm font-medium">
          <span className="text-ink-soft">To {viewer.displayName}, this person is…</span>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="tap mt-1 w-full rounded-card border border-line bg-paper px-3 text-[15px]"
          >
            {members
              .filter((m) => m.id !== viewer.id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
          </select>
        </label>
        <p className="serif mb-0 mt-3 text-lg" aria-live="polite">
          {terms ?? "…"}
        </p>
      </div>
    </section>
  );
}

export default function BondPage() {
  const { lang } = useViewer();
  const t = strings(lang);
  void t;
  const [members, setMembers] = useState<Member[] | null>(null);
  const [relationships, setRelationships] = useState<Relationship[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [mRes, rRes] = await Promise.all([
        fetch("/api/members", { cache: "no-store" }),
        fetch("/api/relationships", { cache: "no-store" }),
      ]);
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

  const tree = useMemo(
    () => (members ? layoutTree(members, relationships ?? []) : null),
    [members, relationships],
  );

  return (
    <div className="pt-2">
      <h1 className="serif mb-3 mt-0 text-3xl">Family Bond</h1>
      {failed && (
        <div className="rounded-card border border-line bg-surface p-5" role="alert">
          <p className="m-0 text-[15px]">{t.common.retry}</p>
          <button type="button" onClick={() => void load()} className="tap mt-2 font-semibold text-accent">
            {t.common.retry}
          </button>
        </div>
      )}
      {tree === null && !failed && (
        <div aria-busy="true" aria-label="Loading">
          <div className="skeleton mb-2 h-40" />
          <div className="skeleton h-40" />
        </div>
      )}
      {tree && members && (
        <>
          <section aria-label="Family tree" className="mb-6">
            <div className="overflow-x-auto rounded-card border border-line bg-surface p-2">
              <svg viewBox="0 0 440 300" className="bond-tree min-w-[440px]" role="img" aria-label="Family tree">
                {tree.edges.map((e, i) => (
                  <line
                    key={i}
                    x1={e.x1}
                    y1={e.y1 - 14}
                    x2={e.x2}
                    y2={e.y2 - 14}
                    stroke="var(--line)"
                    strokeWidth={e.dashed ? 1.5 : 2}
                    strokeDasharray={e.dashed ? "5 4" : undefined}
                  />
                ))}
                {tree.nodes.map((n) => (
                  <g key={n.member.id} className="bond-node">
                    <circle cx={n.x} cy={n.y - 14} r={16} fill="var(--accent)" opacity={0.9} />
                    <text x={n.x} y={n.y - 9} textAnchor="middle" fontSize={13} fill="var(--accent-ink)">
                      {n.member.displayName.slice(0, 1)}
                    </text>
                    <text x={n.x} y={n.y + 16} textAnchor="middle" fontSize={11} fill="var(--ink)">
                      {n.member.displayName}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
            <style>{`.bond-tree .bond-node{transform-box:fill-box;transform-origin:top center;animation:bond-branch .3s ease-out}@keyframes bond-branch{from{transform:scaleY(.4);opacity:.3}to{transform:scaleY(1);opacity:1}}`}</style>
          </section>
          <GuidedAdd onAdded={() => void load()} />
          <KinshipLookup members={members} />
        </>
      )}
    </div>
  );
}
