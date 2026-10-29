// Family constellation: everyone, arranged around one person.
//
//          Father   Mother            ← ancestors fan out upward
//               \   /
//   Sister ——— YOU ——— Sister         ← your generation to the sides
//               / | \
//          Wife  Son  Daughter        ← spouse and children below
//
// Each person sits at the centre of the angle their part of the family
// needs (a sunburst partition), one ring further out per step of kinship.
// Parents' siblings, cousins, in-laws grow outward from whoever connects
// them, so the picture stays readable at 5 people or 50. Pure: client + server.
import { partnersOf } from "./households";
import type { Member, Relationship } from "./schemas";

export type Step = "parent" | "child" | "spouse" | "sibling";
export type Sex = "f" | "m" | null;

export interface Graph {
  parents: Map<string, Set<string>>;
  children: Map<string, Set<string>>;
  spouse: Map<string, string>;
  siblings: Map<string, Set<string>>;
  sex: Map<string, Sex>;
}

export interface Placed {
  id: string;
  x: number;
  y: number;
  depth: number;
  /** Generations above (−) or below (+) the centre. */
  gen: number;
  /** The kinship steps from the centre to this person. */
  path: Step[];
  /** Who connects them to the centre (the line is drawn to this person). */
  via: string | null;
  label: string;
}

export interface Link {
  from: string;
  to: string;
  kind: "parent" | "spouse" | "sibling";
}

export interface Constellation {
  nodes: Placed[];
  links: Link[];
  /** Ring radii actually used, for the faint guide circles. */
  rings: number[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** People not connected to the centre at all (shown in an outer arc). */
  loose: string[];
}

const FEMALE = /^(mother|mom|mum|mummy|maa|ma|amma|ammi|sister|didi|daughter|wife|grandmother|grandma|nani|dadi|aunt|aunty|auntie|niece|bua|mausi|chachi|mami|tai|bhabhi)$/i;
const MALE = /^(father|dad|papa|pappa|appa|abba|brother|bhaiya|bhai|son|husband|grandfather|grandpa|nana|dada|uncle|nephew|chacha|chachu|mama|mamu|tau|fufa|mausa|jiju)$/i;

function add(m: Map<string, Set<string>>, a: string, b: string): void {
  m.set(a, (m.get(a) ?? new Set()).add(b));
}

export function buildGraph(members: Member[], rels: Relationship[]): Graph {
  const ids = new Set(members.map((m) => m.id));
  const live = rels.filter((r) => ids.has(r.memberId) && ids.has(r.relationMemberId) && r.memberId !== r.relationMemberId);
  const parents = new Map<string, Set<string>>();
  const children = new Map<string, Set<string>>();
  const siblings = new Map<string, Set<string>>();
  const sex = new Map<string, Sex>();
  const link = (child: string, parent: string) => {
    add(parents, child, parent);
    add(children, parent, child);
  };
  for (const r of live) {
    // relationMemberId is memberId's <relation>: "Dada is Arjun's father".
    if (r.canonicalKind === "parent") link(r.memberId, r.relationMemberId);
    if (r.canonicalKind === "child") link(r.relationMemberId, r.memberId);
    if (r.canonicalKind === "sibling") {
      add(siblings, r.memberId, r.relationMemberId);
      add(siblings, r.relationMemberId, r.memberId);
    }
    const word = r.relation.trim().split(/\s+/).pop() ?? "";
    if (FEMALE.test(word)) sex.set(r.relationMemberId, "f");
    else if (MALE.test(word)) sex.set(r.relationMemberId, "m");
  }
  const spouse = partnersOf(live);
  // A partner of known sex is usually the other one (fine for most families;
  // unknown stays neutral: "Partner", "Parent").
  spouse.forEach((b, a) => {
    if (!sex.has(a) && sex.get(b)) sex.set(a, sex.get(b) === "f" ? "m" : "f");
  });
  // Siblings share parents (Chachu hangs from the same grandparents) and
  // children of the same parents are siblings.
  for (let pass = 0; pass < 3; pass++) {
    siblings.forEach((sibs, a) => sibs.forEach((b) => parents.get(a)?.forEach((p) => link(b, p))));
  }
  children.forEach((kids) => {
    const list = Array.from(kids);
    for (const a of list) for (const b of list) if (a !== b) add(siblings, a, b);
  });
  return { parents, children, spouse, siblings, sex };
}

const WORD: Record<Step, [string, string, string]> = {
  parent: ["Mother", "Father", "Parent"],
  child: ["Daughter", "Son", "Child"],
  spouse: ["Wife", "Husband", "Partner"],
  sibling: ["Sister", "Brother", "Sibling"],
};
const NAMED: Record<string, [string, string, string]> = {
  "parent,parent": ["Grandmother", "Grandfather", "Grandparent"],
  "parent,parent,parent": ["Great-grandmother", "Great-grandfather", "Great-grandparent"],
  "child,child": ["Granddaughter", "Grandson", "Grandchild"],
  "child,child,child": ["Great-granddaughter", "Great-grandson", "Great-grandchild"],
  "parent,sibling": ["Aunt", "Uncle", "Aunt or uncle"],
  "parent,sibling,spouse": ["Aunt", "Uncle", "Aunt or uncle"],
  "parent,sibling,child": ["Cousin", "Cousin", "Cousin"],
  "parent,parent,child": ["Aunt", "Uncle", "Aunt or uncle"],
  "parent,parent,child,child": ["Cousin", "Cousin", "Cousin"],
  "parent,child": ["Sister", "Brother", "Sibling"],
  "sibling,child": ["Niece", "Nephew", "Niece or nephew"],
  "sibling,child,child": ["Grandniece", "Grandnephew", "Grandniece or nephew"],
  "sibling,spouse": ["Sister-in-law", "Brother-in-law", "Sibling-in-law"],
  "spouse,sibling": ["Sister-in-law", "Brother-in-law", "Sibling-in-law"],
  "spouse,parent": ["Mother-in-law", "Father-in-law", "Parent-in-law"],
  "child,spouse": ["Daughter-in-law", "Son-in-law", "Child-in-law"],
  "spouse,child": ["Daughter", "Son", "Child"],
  "parent,spouse": ["Stepmother", "Stepfather", "Step-parent"],
  "parent,parent,sibling": ["Great-aunt", "Great-uncle", "Great-aunt or uncle"],
};

/** "Mother", "Cousin", "Sister-in-law", or "Cousin's son" past the common words. */
export function kinLabel(path: Step[], sex: Sex): string {
  if (path.length === 0) return "";
  const pick = (w: [string, string, string]) => (sex === "f" ? w[0] : sex === "m" ? w[1] : w[2]);
  const named = NAMED[path.join(",")];
  if (named) return pick(named);
  if (path.length === 1) return pick(WORD[path[0]]);
  const head = kinLabel(path.slice(0, -1), null);
  return `${head.replace(/ or .*$/, "")}'s ${pick(WORD[path[path.length - 1]]).toLowerCase()}`;
}

interface Tree {
  id: string;
  via: string | null;
  step: Step | null;
  depth: number;
  gen: number;
  path: Step[];
  kids: Tree[];
  weight: number;
}

/** Breadth-first from the centre, closest kinship first. */
function spanningTree(g: Graph, focus: string, known: Set<string>): { root: Tree; seen: Set<string> } {
  const root: Tree = { id: focus, via: null, step: null, depth: 0, gen: 0, path: [], kids: [], weight: 1 };
  const seen = new Set([focus]);
  let frontier = [root];
  while (frontier.length) {
    const next: Tree[] = [];
    for (const t of frontier) {
      const out: [string, Step][] = [];
      const sp = g.spouse.get(t.id);
      if (sp) out.push([sp, "spouse"]);
      g.parents.get(t.id)?.forEach((p) => out.push([p, "parent"]));
      g.siblings.get(t.id)?.forEach((s) => out.push([s, "sibling"]));
      g.children.get(t.id)?.forEach((c) => out.push([c, "child"]));
      for (const [id, step] of out) {
        if (seen.has(id) || !known.has(id)) continue;
        seen.add(id);
        const gen = t.gen + (step === "parent" ? -1 : step === "child" ? 1 : 0);
        const kid: Tree = { id, via: t.id, step, depth: t.depth + 1, gen, path: [...t.path, step], kids: [], weight: 1 };
        t.kids.push(kid);
        next.push(kid);
      }
    }
    frontier = next;
  }
  const weigh = (t: Tree): number => (t.weight = Math.max(1, t.kids.reduce((s, k) => s + weigh(k), 0) * 0.85 + (t.kids.length ? 0.4 : 0)));
  weigh(root);
  return { root, seen };
}

// The first ring's groups, clockwise from the top.
const SIDE_ORDER = ["parent", "sibling-right", "spouse", "child", "sibling-left"] as const;

/**
 * Place everyone around `focusId`. Coordinates are centred on the focus
 * (0, 0); the caller fits the bounds to the screen.
 */
export function constellation(members: Member[], rels: Relationship[], focusId: string, opts: { nodeArc?: number } = {}): Constellation {
  const byId = new Map(members.map((m) => [m.id, m]));
  const focus = byId.has(focusId) ? focusId : (members[0]?.id ?? "");
  const g = buildGraph(members, rels);
  const { root, seen } = spanningTree(g, focus, new Set(byId.keys()));

  // First ring: parents on top, siblings split left/right, spouse and children below.
  const first = root.kids;
  // With a partner on the right, the first sibling goes left.
  let flip = first.some((t) => t.step === "spouse");
  const side = (t: Tree): (typeof SIDE_ORDER)[number] => {
    if (t.step === "sibling") return (flip = !flip) ? "sibling-right" : "sibling-left";
    return t.step as "parent" | "spouse" | "child";
  };
  const groups = new Map<string, Tree[]>(SIDE_ORDER.map((s) => [s, []]));
  for (const t of first) groups.get(side(t))?.push(t);
  // Older siblings to the right reads naturally clockwise; children by weight is enough.
  // Each group keeps its direction: parents up, siblings to the sides,
  // spouse and children down. Boundaries between neighbouring groups slide
  // toward the lighter one, so a big side of the family gets more room
  // without pushing anyone out of place. Weights are damped and every close
  // relative keeps a minimum share.
  const MIN: Record<Step, number> = { parent: 0.95, spouse: 0.7, child: 0.75, sibling: 0.8 };
  const want = (t: Tree) => Math.max(MIN[t.step as Step], Math.sqrt(t.weight));
  const DIR: Record<(typeof SIDE_ORDER)[number], number> = { parent: -Math.PI / 2, "sibling-right": 0, spouse: Math.PI / 2, child: Math.PI / 2, "sibling-left": Math.PI };
  // A partner stands beside you (right, nearest the children); children below.
  const sectors = (
    [
      ["parent", groups.get("parent") ?? []],
      ["sibling-right", [...(groups.get("sibling-right") ?? []), ...(groups.get("spouse") ?? [])]],
      ["child", groups.get("child") ?? []],
      ["sibling-left", groups.get("sibling-left") ?? []],
    ] as const
  ).filter(([, list]) => list.length > 0);
  const wedge = new Map<string, [number, number]>();
  const TAU = Math.PI * 2;
  const weightOf = (list: readonly Tree[]) => list.reduce((s, t) => s + want(t), 0);
  // Each group is centred on its own direction with a span that grows with
  // its weight (capped), and may only reach into the gap toward a neighbour
  // in proportion to their weights. Empty directions stay empty.
  const CAP: Record<string, number> = { parent: (200 / 180) * Math.PI, child: (200 / 180) * Math.PI, "sibling-right": (130 / 180) * Math.PI, "sibling-left": (130 / 180) * Math.PI };
  const all = sectors.reduce((s, [, list]) => s + weightOf(list), 0) || 1;
  sectors.forEach(([key, list], i) => {
    const c = DIR[key];
    const w = weightOf(list);
    const half = Math.min(CAP[key], (TAU * w) / all) / 2;
    if (sectors.length === 1) return spread(list, c - Math.max(half, Math.PI * 0.45), c + Math.max(half, Math.PI * 0.45));
    const [nk, nl] = sectors[(i + 1) % sectors.length];
    const [pk, pl] = sectors[(i - 1 + sectors.length) % sectors.length];
    const gapTo = (from: number, to: number) => {
      let g = to - from;
      while (g <= 0) g += TAU;
      return g;
    };
    const right = Math.min(half, (gapTo(c, DIR[nk]) * w) / (w + weightOf(nl)));
    const left = Math.min(half, (gapTo(DIR[pk], c) * w) / (w + weightOf(pl)));
    spread(list, c - left, c + right);
  });
  function spread(list: readonly Tree[], lo: number, hi: number) {
    const sum = weightOf(list);
    let a = lo;
    for (const t of list) {
      const span = ((hi - lo) * want(t)) / sum;
      wedge.set(t.id, [a, a + span]);
      a += span;
    }
  }
  const centre = (id: string) => {
    const w = wedge.get(id) as [number, number];
    return (w[0] + w[1]) / 2;
  };

  // Deeper rings inherit a slice of their connector's wedge.
  const allTrees: Tree[] = [];
  const walk = (t: Tree) => {
    allTrees.push(t);
    const w = wedge.get(t.id);
    if (w && t.kids.length) {
      const sum = t.kids.reduce((s, k) => s + k.weight, 0);
      let start = w[0];
      for (const k of t.kids) {
        const span = ((w[1] - w[0]) * k.weight) / sum;
        wedge.set(k.id, [start, start + span]);
        start += span;
      }
    }
    t.kids.forEach(walk);
  };
  walk(root);

  // A partner sits closer than a parent or child: they're the same home.
  const relR = (step: Step | null) => (step === "spouse" ? 0.82 : 1);
  const radius = new Map<string, number>();
  const unitR = (R: number) => {
    radius.set(root.id, 0);
    const go = (t: Tree, r: number) => t.kids.forEach((k) => {
      const rk = r + relR(k.step) * R;
      radius.set(k.id, rk);
      go(k, rk);
    });
    go(root, 0);
  };
  // Grow the rings until every person has room for their photo and name.
  const need = opts.nodeArc ?? 104;
  let R = 150;
  for (; R < 300; R += 6) {
    unitR(R);
    const crowded = allTrees.some((t) => {
      if (t.depth === 0) return false;
      const w = wedge.get(t.id) as [number, number];
      return (radius.get(t.id) as number) * Math.min(Math.PI, w[1] - w[0]) < need;
    });
    if (!crowded) break;
  }
  unitR(R);

  const nodes: Placed[] = allTrees.map((t) => {
    const r = radius.get(t.id) as number;
    const ang = t.depth === 0 ? 0 : centre(t.id);
    return { id: t.id, via: t.via, x: Math.cos(ang) * r, y: Math.sin(ang) * r, depth: t.depth, gen: t.gen, path: t.path, label: kinLabel(t.path, g.sex.get(t.id) ?? null) };
  });

  // People with no path to the centre: a gentle arc below, so nobody vanishes.
  const loose = members.filter((m) => !seen.has(m.id)).map((m) => m.id);
  const maxR = Math.max(R, ...nodes.map((n) => Math.hypot(n.x, n.y)));
  loose.forEach((id, i) => {
    const span = Math.min(Math.PI * 0.6, loose.length * 0.32);
    const ang = Math.PI / 2 - span / 2 + (loose.length > 1 ? (span * i) / (loose.length - 1) : span / 2);
    const r = maxR + R * 0.9;
    nodes.push({ id, via: null, x: Math.cos(ang) * r, y: Math.sin(ang) * r, depth: -1, gen: 0, path: [], label: "" });
  });

  // One line per person, to whoever connects them. In a radial layout where
  // each branch keeps to its own wedge these never cross. Couples who aren't
  // already joined that way get one short gold line between them (they sit
  // side by side, so it never crosses either).
  const links: Link[] = [];
  const placed = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    if (!n.via) continue;
    links.push({ from: n.via, to: n.id, kind: n.path[n.path.length - 1] === "spouse" ? "spouse" : n.path[n.path.length - 1] === "sibling" ? "sibling" : "parent" });
  }
  const joined = new Set(links.map((l) => [l.from, l.to].sort().join("|")));
  g.spouse.forEach((b, a) => {
    const key = [a, b].sort().join("|");
    if (joined.has(key) || !placed.has(a) || !placed.has(b)) return;
    const pa = placed.get(a) as Placed;
    const pb = placed.get(b) as Placed;
    // Only when they're neighbours on the same ring (true for a parent couple).
    if (pa.depth !== pb.depth || Math.hypot(pa.x - pb.x, pa.y - pb.y) > R * 1.4) return;
    joined.add(key);
    links.push({ from: a, to: b, kind: "spouse" });
  });

  const rings = Array.from(new Set(allTrees.filter((t) => t.depth > 0).map((t) => t.depth))).map((d) => d * R);
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  return { nodes, links, rings, bounds: { minX: Math.min(0, ...xs), minY: Math.min(0, ...ys), maxX: Math.max(0, ...xs), maxY: Math.max(0, ...ys) }, loose };
}

/** "9 people · 4 generations · 3 homes · 3 time zones". */
export function familyStats(c: Constellation, members: Member[]): { people: number; generations: number; zones: number } {
  const gens = new Set(c.nodes.filter((n) => n.depth >= 0).map((n) => n.gen));
  return { people: members.length, generations: Math.max(1, gens.size), zones: new Set(members.map((m) => m.tz)).size };
}
