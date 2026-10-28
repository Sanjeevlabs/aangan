// Viewer-relative kinship resolver (M3).
// Deterministic BFS over guided Bond edges -> path -> kinship_cache keyed by
// (path, display_lang). The model runs ONLY on a cache miss, via the injected
// translate function (live: translateText with the server store/ledger;
// tests: a stub). Relation words themselves are family data, never logic.
import type { Relationship } from "./schemas";

export interface KinshipStep {
  fromId: string;
  toId: string;
  /** The family's own word for this hop, e.g. "mother". */
  label: string;
  kind: Relationship["canonicalKind"];
}

export interface KinshipPath {
  /** Member ids from viewer to target, inclusive. */
  members: string[];
  steps: KinshipStep[];
  /** Cache key: the labelled path, e.g. "leo>father>arjun>mother>dadi". */
  key: string;
}

const INVERSE: Record<Relationship["canonicalKind"], Relationship["canonicalKind"]> = {
  parent: "child",
  child: "parent",
  spouse: "spouse",
  sibling: "sibling",
};

function inverseLabel(step: KinshipStep): string {
  // The reverse hop keeps the family's word when symmetric, else a generic.
  if (step.kind === "spouse" || step.kind === "sibling") return step.label;
  return step.kind === "parent" ? "child" : "parent";
}

/** Deterministic BFS from `fromId` to `toId`. Returns null when unconnected. */
export function findKinshipPath(
  fromId: string,
  toId: string,
  relationships: Relationship[],
): KinshipPath | null {
  if (fromId === toId) {
    return { members: [fromId], steps: [], key: `${fromId}` };
  }
  interface Edge {
    to: string;
    label: string;
    kind: Relationship["canonicalKind"];
  }
  const adj = new Map<string, Edge[]>();
  const add = (from: string, edge: Edge) => {
    const list = adj.get(from) ?? [];
    list.push(edge);
    adj.set(from, list);
  };
  for (const r of relationships) {
    add(r.memberId, { to: r.relationMemberId, label: r.relation, kind: r.canonicalKind });
    add(r.relationMemberId, {
      to: r.memberId,
      label: inverseLabel({ fromId: r.memberId, toId: r.relationMemberId, label: r.relation, kind: r.canonicalKind }),
      kind: INVERSE[r.canonicalKind],
    });
  }
  const prev = new Map<string, { from: string; label: string; kind: Relationship["canonicalKind"] }>();
  const seen = new Set([fromId]);
  const queue = [fromId];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    for (const e of adj.get(cur) ?? []) {
      if (seen.has(e.to)) continue;
      seen.add(e.to);
      prev.set(e.to, { from: cur, label: e.label, kind: e.kind });
      if (e.to === toId) {
        const members = [toId];
        const steps: KinshipStep[] = [];
        let node = toId;
        while (node !== fromId) {
          const p = prev.get(node) as { from: string; label: string; kind: Relationship["canonicalKind"] };
          steps.unshift({ fromId: p.from, toId: node, label: p.label, kind: p.kind });
          node = p.from;
          members.unshift(node);
        }
        const key = [fromId, ...steps.flatMap((s) => [s.label, s.toId])].join(">");
        return { members, steps, key };
      }
      queue.push(e.to);
    }
  }
  return null;
}

/** Generic English term for a short path; longer chains stay "family". */
export function genericTerm(path: KinshipPath): string {
  if (path.steps.length === 0) return "you";
  if (path.steps.length === 1) return path.steps[0].label;
  if (path.steps.length === 2) return `${path.steps[0].label}'s ${path.steps[1].label}`;
  return "family";
}

export interface KinshipDeps {
  relationships: Relationship[];
  getCached: (path: string, lang: string) => string | undefined | Promise<string | undefined>;
  setCached: (path: string, lang: string, terms: string) => void | Promise<void>;
  /** Model call — invoked at most once per (path, lang), only on a miss. */
  translate: (text: string, lang: string) => Promise<string>;
}

/**
 * Resolve viewer-relative kinship terms. Cache first; the model
 * (translate) runs only on a cache miss. Never throws — falls back to the
 * English generic term.
 */
export async function resolveKinship(
  fromId: string,
  toId: string,
  displayLang: string,
  deps: KinshipDeps,
): Promise<{ path: KinshipPath | null; terms: string; cached: boolean }> {
  const path = findKinshipPath(fromId, toId, deps.relationships);
  if (!path) return { path: null, terms: "family", cached: false };
  const hit = await deps.getCached(path.key, displayLang);
  if (hit !== undefined) return { path, terms: hit, cached: true };
  const en = genericTerm(path);
  let terms = en;
  if (displayLang !== "en") {
    try {
      terms = await deps.translate(en, displayLang);
    } catch {
      terms = en;
    }
  }
  await deps.setCached(path.key, displayLang, terms);
  return { path, terms, cached: false };
}
