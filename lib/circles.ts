import { constellation } from "./constellation";
import { householdOf, households } from "./households";
import type { Member, Relationship } from "./schemas";

// Three circles around you, so the wider family is never an afterthought:
// home (under your roof), close (one step: parents, siblings, children),
// wider (everyone else: in-laws, cousins, aunts and uncles, their children).

export interface CirclePerson {
  member: Member;
  /** "Sister-in-law", "Cousin", "Aunt" — from the family's own tree. */
  label: string;
}
export interface Circles {
  home: CirclePerson[];
  close: CirclePerson[];
  wider: CirclePerson[];
}

export function circles(members: Member[], rels: Relationship[], viewerId: string): Circles {
  const out: Circles = { home: [], close: [], wider: [] };
  if (!members.some((m) => m.id === viewerId)) return out;
  const homes = households(members, rels);
  const mine = new Set(householdOf(viewerId, homes)?.members.map((m) => m.id) ?? [viewerId]);
  const c = constellation(members, rels, viewerId);
  const byId = new Map(members.map((m) => [m.id, m]));
  for (const n of c.nodes) {
    const member = byId.get(n.id);
    if (!member || n.id === viewerId) continue;
    const person = { member, label: n.label };
    if (mine.has(n.id)) out.home.push(person);
    else if (n.depth === 1) out.close.push(person);
    else out.wider.push(person);
  }
  for (const id of c.loose) {
    const member = byId.get(id);
    if (member && id !== viewerId) out.wider.push({ member, label: "" });
  }
  return out;
}
