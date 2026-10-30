// The family tree as people expect it (SPEC §29.6): generations in rows,
// couples side by side, an elbow line from each couple down to their
// children. Pure layout (client + server); the component only draws it.
import { partnersOf } from "./households";
import type { Member, Relationship } from "./schemas";

export const NODE = 64; // avatar size
export const COL = 92; // horizontal space one person takes
export const ROW = 150; // vertical space per generation

export interface TreeNode {
  id: string;
  x: number; // centre
  y: number; // centre
  gen: number;
}
export interface TreeLink {
  /** Couple (or single parent) centre, bottom of avatar. */
  from: { x: number; y: number };
  /** Children's centres, top of avatar. */
  to: { x: number; y: number }[];
}
export interface TreeLayout {
  nodes: TreeNode[];
  couples: { a: string; b: string; y: number; x1: number; x2: number }[];
  links: TreeLink[];
  width: number;
  height: number;
  /** People not yet connected to anyone in the tree. */
  loose: string[];
}

interface Unit {
  ids: string[]; // 1 or 2
  gen: number;
  kids: Unit[];
  width: number;
  x: number;
}

export function parentsMap(relationships: Relationship[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  const add = (child: string, parent: string) => m.set(child, (m.get(child) ?? new Set()).add(parent));
  for (const r of relationships) {
    if (r.canonicalKind === "parent") add(r.memberId, r.relationMemberId);
    if (r.canonicalKind === "child") add(r.relationMemberId, r.memberId);
  }
  // Siblings share parents: "Kavya is Arjun's sister" puts her under Maa & Papa.
  for (let pass = 0; pass < 2; pass++)
    for (const r of relationships) {
      if (r.canonicalKind !== "sibling") continue;
      const [a, b] = [r.memberId, r.relationMemberId];
      const pa = m.get(a);
      const pb = m.get(b);
      if (pa && !pb) m.set(b, new Set(pa));
      if (pb && !pa) m.set(a, new Set(pb));
    }
  return m;
}

/** Generation of everyone reachable from `from` (0 = their row, −1 = parents). */
export function generations(members: Member[], relationships: Relationship[], from: string): Map<string, number> {
  const parents = parentsMap(relationships);
  const edges = new Map<string, { to: string; d: number }[]>();
  const link = (a: string, b: string, d: number) => {
    edges.set(a, [...(edges.get(a) ?? []), { to: b, d }]);
    edges.set(b, [...(edges.get(b) ?? []), { to: a, d: -d }]);
  };
  parents.forEach((ps, child) => ps.forEach((p) => link(child, p, -1)));
  for (const r of relationships) if (r.canonicalKind === "spouse" || r.canonicalKind === "sibling") link(r.memberId, r.relationMemberId, 0);
  const ids = new Set(members.map((m) => m.id));
  const gen = new Map<string, number>([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of edges.get(cur) ?? []) {
      if (!ids.has(e.to) || gen.has(e.to)) continue;
      gen.set(e.to, gen.get(cur)! + e.d);
      queue.push(e.to);
    }
  }
  return gen;
}

export function treeLayout(members: Member[], relationships: Relationship[], focusId: string): TreeLayout {
  const gen = generations(members, relationships, focusId);
  const parents = parentsMap(relationships);
  const partner = partnersOf(relationships);
  const inTree = members.filter((m) => gen.has(m.id));
  const loose = members.filter((m) => !gen.has(m.id)).map((m) => m.id);

  // Units: a couple in the same generation, or one person.
  const unitOf = new Map<string, Unit>();
  const units: Unit[] = [];
  // Blood relatives first, so a spouse joins *their* partner's unit (on the right).
  const order = [...inTree].sort((a, b) => Number(parents.has(b.id)) - Number(parents.has(a.id)) || a.id.localeCompare(b.id));
  for (const m of order) {
    if (unitOf.has(m.id)) continue;
    const p = partner.get(m.id);
    const ids = p && gen.get(p) === gen.get(m.id) && !unitOf.has(p) && gen.has(p) ? [m.id, p] : [m.id];
    const u: Unit = { ids, gen: gen.get(m.id)!, kids: [], width: 0, x: 0 };
    ids.forEach((id) => unitOf.set(id, u));
    units.push(u);
  }
  // A unit's parent unit: the unit holding any parent of any member.
  const parentUnit = new Map<Unit, Unit>();
  for (const u of units) {
    for (const id of u.ids) {
      const ps = Array.from(parents.get(id) ?? []).filter((p) => unitOf.has(p));
      if (ps.length && !parentUnit.has(u)) {
        const pu = unitOf.get(ps[0])!;
        if (pu !== u && pu.gen < u.gen) {
          parentUnit.set(u, pu);
          pu.kids.push(u);
          // The blood child sits on the inside edge of the couple.
          if (u.ids.length === 2 && u.ids[1] === id) u.ids.reverse();
        }
      }
    }
  }
  const widthOf = (u: Unit): number => {
    const own = u.ids.length * COL;
    const kids = u.kids.reduce((s, k) => s + widthOf(k), 0);
    u.width = Math.max(own, kids);
    return u.width;
  };
  const place = (u: Unit, left: number) => {
    u.x = left + u.width / 2;
    let cursor = left + (u.width - u.kids.reduce((s, k) => s + k.width, 0)) / 2;
    for (const k of u.kids) {
      place(k, cursor);
      cursor += k.width;
    }
  };
  // Roots: no parent unit. Older generations first, then left to right.
  const roots = units.filter((u) => !parentUnit.has(u)).sort((a, b) => a.gen - b.gen);
  let left = 0;
  for (const r of roots) {
    widthOf(r);
    place(r, left);
    left += r.width;
  }
  const minGen = Math.min(0, ...units.map((u) => u.gen));
  const maxGen = Math.max(0, ...units.map((u) => u.gen));
  const yOf = (g: number) => (g - minGen) * ROW + NODE / 2 + 8;

  const nodes: TreeNode[] = [];
  const couples: TreeLayout["couples"] = [];
  for (const u of units) {
    const y = yOf(u.gen);
    const xs = u.ids.length === 2 ? [u.x - COL / 2, u.x + COL / 2] : [u.x];
    u.ids.forEach((id, i) => nodes.push({ id, x: xs[i], y, gen: u.gen }));
    if (u.ids.length === 2) couples.push({ a: u.ids[0], b: u.ids[1], y, x1: xs[0], x2: xs[1] });
  }
  const pos = new Map(nodes.map((n) => [n.id, n]));
  const links: TreeLink[] = units
    .filter((u) => u.kids.length)
    .map((u) => {
      // From the couple's midpoint; to each blood child (not the in-law partner).
      const to = u.kids.map((k) => {
        const child = k.ids.find((id) => Array.from(parents.get(id) ?? []).some((p) => u.ids.includes(p))) ?? k.ids[0];
        const n = pos.get(child)!;
        return { x: n.x, y: n.y - NODE / 2 };
      });
      return { from: { x: u.x, y: yOf(u.gen) + (u.ids.length === 2 ? 0 : NODE / 2) }, to };
    });
  return { nodes, couples, links, width: Math.max(left, COL), height: yOf(maxGen) + NODE / 2 + 44, loose };
}
