import { describe, expect, it } from "vitest";
import { constellation, kinLabel } from "@/lib/constellation";
import { DEMO_MEMBERS } from "@/lib/family";
import { clearRelationships, listRelationships } from "@/lib/store";

clearRelationships();
const rels = listRelationships();
const at = (focus: string) => {
  const c = constellation(DEMO_MEMBERS, rels, focus);
  return { c, n: (id: string) => c.nodes.find((x) => x.id === id)! };
};

describe("family constellation", () => {
  it("puts parents above, siblings to the sides, spouse and children below", () => {
    const { c, n } = at("arjun");
    expect(n("arjun")).toMatchObject({ x: 0, y: 0, depth: 0 });
    expect(n("dadi").y).toBeLessThan(-50);
    expect(n("dada").y).toBeLessThan(-50);
    expect(n("leo").y).toBeGreaterThan(50);
    expect(n("aria").y).toBeGreaterThan(50);
    expect(Math.abs(n("kavya").x)).toBeGreaterThan(Math.abs(n("kavya").y) * 0.5);
    expect(n("priya").depth).toBe(1);
    expect(Math.hypot(n("priya").x, n("priya").y)).toBeLessThan(Math.hypot(n("leo").x, n("leo").y));
    expect(c.loose).toEqual([]);
    expect(c.nodes).toHaveLength(DEMO_MEMBERS.length);
  });

  it("labels kinship from whoever is at the centre", () => {
    expect(at("arjun").n("dadi").label).toBe("Mother");
    expect(at("arjun").n("kavya").label).toBe("Sister");
    expect(at("arjun").n("rahul").label).toBe("Brother-in-law");
    expect(at("arjun").n("anaya").label).toBe("Niece");
    expect(at("leo").n("dadi").label).toBe("Grandmother");
    expect(at("leo").n("kavya").label).toBe("Aunt");
    expect(at("leo").n("anaya").label).toBe("Cousin");
    expect(at("leo").n("aria").label).toBe("Sister");
    expect(at("anaya").n("arjun").label).toBe("Uncle");
    expect(at("priya").n("dadi").label).toBe("Mother-in-law");
  });

  it("draws one line per person plus couples, and no two lines cross", () => {
    const cross = (p1: [number, number], p2: [number, number], p3: [number, number], p4: [number, number]) => {
      const d = (a: [number, number], b: [number, number], c: [number, number]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      return d(p1, p2, p3) * d(p1, p2, p4) < 0 && d(p3, p4, p1) * d(p3, p4, p2) < 0;
    };
    for (const focus of DEMO_MEMBERS.map((m) => m.id)) {
      const { c } = at(focus);
      const xy = (id: string) => { const n = c.nodes.find((x) => x.id === id)!; return [n.x, n.y] as [number, number]; };
      const tree = c.links.filter((l) => l.kind !== "spouse" || c.nodes.find((n) => n.id === l.to)?.via === l.from);
      expect(tree).toHaveLength(c.nodes.length - 1 - c.loose.length);
      for (const a of c.links) for (const b of c.links) {
        if (a === b || [a.from, a.to].some((x) => x === b.from || x === b.to)) continue;
        expect(cross(xy(a.from), xy(a.to), xy(b.from), xy(b.to)), `${focus}: ${a.from}-${a.to} × ${b.from}-${b.to}`).toBe(false);
      }
    }
    const spouse = at("leo").c.links.filter((l) => l.kind === "spouse").map((l) => [l.from, l.to].sort().join("|"));
    expect(spouse).toEqual(expect.arrayContaining(["arjun|priya", "dada|dadi", "kavya|rahul"]));
  });

  it("never overlaps two people", () => {
    for (const focus of DEMO_MEMBERS.map((m) => m.id)) {
      const ns = at(focus).c.nodes;
      for (const a of ns) for (const b of ns) if (a.id < b.id) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(60);
    }
  });

  it("keeps people with no link visible", () => {
    const c = constellation([...DEMO_MEMBERS, { ...DEMO_MEMBERS[3], id: "stray", firstName: "Stray" }], rels, "arjun");
    expect(c.loose).toEqual(["stray"]);
    expect(c.nodes.find((x) => x.id === "stray")).toBeTruthy();
  });

  it("falls back to possessive phrases past the common words", () => {
    expect(kinLabel(["parent", "sibling", "child", "child"], "m")).toBe("Cousin's son");
    expect(kinLabel(["spouse"], null)).toBe("Partner");
  });
});
