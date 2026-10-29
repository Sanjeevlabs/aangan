// Households: who lives under one roof. Families abroad don't miss "Dadi"
// or "Papa" alone; they miss the home. Maa and Papa in Kanpur are one
// household; a grandchild in Chicago is their own.
//
// A household is a spouse pair (or a single adult) plus their children who
// live in the same time zone. Pure functions (client + server).
import type { Card, Member, Relationship } from "./schemas";

export interface Household {
  id: string;
  members: Member[];
  tz: string;
  /** True if this household includes the grandparent generation. */
  elders: boolean;
}

/**
 * Partners: explicit spouses, plus co-parents. Families add "mother" and
 * "father" separately and rarely add "Maa's husband"; a child's two parents
 * are treated as a couple unless either is already married to someone else.
 */
export function partnersOf(relationships: Relationship[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of relationships) {
    if (r.canonicalKind !== "spouse") continue;
    m.set(r.memberId, r.relationMemberId);
    m.set(r.relationMemberId, r.memberId);
  }
  const parents = parentsOf(relationships);
  parents.forEach((ps) => {
    const [a, b, ...rest] = Array.from(ps);
    if (!a || !b || rest.length || m.has(a) || m.has(b)) return;
    m.set(a, b);
    m.set(b, a);
  });
  return m;
}
const spousesOf = partnersOf;

function parentsOf(relationships: Relationship[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  const add = (child: string, parent: string) => m.set(child, (m.get(child) ?? new Set()).add(parent));
  for (const r of relationships) {
    if (r.canonicalKind === "parent") add(r.memberId, r.relationMemberId);
    if (r.canonicalKind === "child") add(r.relationMemberId, r.memberId);
  }
  return m;
}

export function households(members: Member[], relationships: Relationship[]): Household[] {
  const spouse = spousesOf(relationships);
  const parents = parentsOf(relationships);
  const byId = new Map(members.map((m) => [m.id, m]));
  const placed = new Set<string>();
  const out: Household[] = [];
  // Adults first (elders, then parents' generation), so children join a home.
  const order = [...members].sort((a, b) => rank(a) - rank(b));
  for (const m of order) {
    if (placed.has(m.id) || m.role === "child") continue;
    const home: Member[] = [m];
    placed.add(m.id);
    const sp = byId.get(spouse.get(m.id) ?? "");
    if (sp && !placed.has(sp.id) && sp.tz === m.tz) {
      home.push(sp);
      placed.add(sp.id);
    }
    out.push({ id: `home-${home.map((h) => h.id).sort().join("-")}`, members: home, tz: m.tz, elders: home.some((h) => h.role === "elder") });
  }
  // Children live with a parent in the same zone; otherwise they are their own home.
  for (const c of members.filter((x) => x.role === "child" && !placed.has(x.id))) {
    const ps = Array.from(parents.get(c.id) ?? []);
    const home = out.find((h) => h.tz === c.tz && h.members.some((x) => ps.includes(x.id)));
    if (home) home.members.push(c);
    else out.push({ id: `home-${c.id}`, members: [c], tz: c.tz, elders: false });
    placed.add(c.id);
  }
  return out;
}

function rank(m: Member): number {
  return m.role === "elder" ? 0 : m.role === "adult" ? 1 : 2;
}

export function householdOf(memberId: string, homes: Household[]): Household | undefined {
  return homes.find((h) => h.members.some((m) => m.id === memberId));
}

/** "Maa & Papa", "Dadi, Dada & Meera", or "Arjun's home" when it's bigger. */
export function householdName(home: Household, call: (m: Member) => string, excludeId?: string): string {
  const people = home.members.filter((m) => m.id !== excludeId);
  const adults = people.filter((m) => m.role !== "child");
  const named = (adults.length ? adults : people).map(call);
  if (named.length === 0) return "";
  if (people.length > 3 && adults.length) return `${call(adults[0])}'s home`;
  const list = people.length <= 3 ? people.map(call) : named;
  return list.length === 1 ? list[0] : `${list.slice(0, -1).join(", ")} & ${list[list.length - 1]}`;
}

/** Recipients of a card: one id, a household ("a,b"), or null for everyone. */
export function addressees(card: Pick<Card, "addressedTo">): string[] {
  return (card.addressedTo ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}
export function addressTo(ids: string[]): string | null {
  const clean = Array.from(new Set(ids.filter(Boolean)));
  return clean.length ? clean.join(",") : null;
}

export interface TalkTarget {
  home: Household;
  reason: "reply" | "longest";
}

/**
 * Who the dock's "Talk to …" should open, chosen so it brings people closer:
 *  1. Reply first: a home that sent you a voice you haven't answered yet.
 *  2. Otherwise the far home you've spoken to least recently (for children
 *     and grandchildren that is usually the parents' home; for parents, their
 *     children's homes). Recency alone would keep you talking to the same
 *     person and let the quieter home drift.
 */
export function talkTarget(viewer: Member, members: Member[], relationships: Relationship[], cards: Card[]): TalkTarget | undefined {
  const homes = households(members, relationships).filter((h) => !h.members.some((m) => m.id === viewer.id));
  if (homes.length === 0) return undefined;
  const voices = cards.filter((c) => c.type === "audio" && c.authorId);
  const lastFrom = (h: Household) => Math.max(0, ...voices.filter((c) => h.members.some((m) => m.id === c.authorId)).map((c) => Date.parse(c.takenAt)));
  const lastTo = (h: Household) =>
    Math.max(
      0,
      ...voices
        .filter((c) => c.authorId === viewer.id)
        .filter((c) => {
          const to = addressees(c);
          return to.length === 0 || to.some((id) => h.members.some((m) => m.id === id));
        })
        .map((c) => Date.parse(c.takenAt)),
    );

  const unanswered = homes
    .filter((h) => lastFrom(h) > lastTo(h))
    .sort((a, b) => lastFrom(b) - lastFrom(a))[0];
  if (unanswered) return { home: unanswered, reason: "reply" };

  // Prefer the other generation's homes (elders ↔ their children).
  const preferred = homes.filter((h) => (viewer.role === "elder" ? !h.elders : h.elders));
  const pool = preferred.length ? preferred : homes;
  const longest = [...pool].sort((a, b) => lastTo(a) - lastTo(b))[0];
  return { home: longest, reason: "longest" };
}
