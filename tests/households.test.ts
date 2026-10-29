import { describe, expect, it } from "vitest";
import { addressTo, addressees, householdName, households, partnersOf, talkTarget } from "@/lib/households";
import { CardSchema, MemberSchema, type Member, type Relationship } from "@/lib/schemas";

const m = (id: string, role: Member["role"], tz: string): Member => MemberSchema.parse({ id, familyId: "f", firstName: id, displayName: id, role, tz });
const rel = (memberId: string, relationMemberId: string, relation: string, canonicalKind: Relationship["canonicalKind"]): Relationship => ({ id: `${memberId}-${relationMemberId}`, familyId: "f", memberId, relationMemberId, relation, canonicalKind });
const voice = (authorId: string, at: string, to: string[] = []) => CardSchema.parse({ id: `${authorId}-${at}`, familyId: "f", type: "audio", caption: "hello there", lang: "en", takenAt: at, authorId, addressedTo: addressTo(to) });

// You in New York; Maa and Papa at home in India (added separately, never as spouses);
// your wife's parents in Chennai; your kids with you.
const me = m("me", "adult", "America/New_York");
const maa = m("Maa", "elder", "Asia/Kolkata");
const papa = m("Papa", "elder", "Asia/Kolkata");
const wife = m("Priya", "adult", "America/New_York");
const amma = m("Amma", "elder", "Asia/Kolkata");
const appa = m("Appa", "elder", "Asia/Kolkata");
const kid = m("Kabir", "child", "America/New_York");
const members = [me, maa, papa, wife, amma, appa, kid];
const rels = [
  rel("me", "Maa", "mother", "parent"),
  rel("me", "Papa", "father", "parent"),
  rel("me", "Priya", "wife", "spouse"),
  rel("Priya", "Amma", "mother", "parent"),
  rel("Priya", "Appa", "father", "parent"),
  rel("Kabir", "me", "father", "parent"),
];

describe("households", () => {
  it("pairs a child's two parents as a couple even if nobody said 'husband'", () => {
    expect(partnersOf(rels).get("Maa")).toBe("Papa");
    expect(partnersOf(rels).get("Amma")).toBe("Appa");
  });

  it("groups homes by roof: Maa & Papa, Amma & Appa, and you with your wife and kids", () => {
    const homes = households(members, rels).map((h) => h.members.map((x) => x.id).sort().join("+"));
    expect(homes).toEqual(expect.arrayContaining(["Maa+Papa", "Amma+Appa", "Kabir+Priya+me"]));
    expect(homes).toHaveLength(3);
  });

  it("names a home the way people say it", () => {
    const home = households(members, rels).find((h) => h.members.some((x) => x.id === "Maa"))!;
    expect(householdName(home, (x) => x.displayName)).toBe("Maa & Papa");
  });

  it("talks to the home waiting for your reply first", () => {
    const cards = [voice("Amma", "2026-10-28T03:00:00Z"), voice("me", "2026-10-27T03:00:00Z", ["Maa", "Papa"])];
    const t = talkTarget(me, members, rels, cards)!;
    expect(t.reason).toBe("reply");
    expect(t.home.members.map((x) => x.id).sort()).toEqual(["Amma", "Appa"]);
  });

  it("otherwise picks the far home you've spoken to least recently, not the loudest", () => {
    const cards = [voice("me", "2026-10-28T03:00:00Z", ["Maa", "Papa"]), voice("me", "2026-10-20T03:00:00Z", ["Amma", "Appa"])];
    const t = talkTarget(me, members, rels, cards)!;
    expect(t.reason).toBe("longest");
    expect(t.home.members.map((x) => x.id).sort()).toEqual(["Amma", "Appa"]);
  });

  it("encodes a household as recipients and reads it back", () => {
    expect(addressees({ addressedTo: addressTo(["Maa", "Papa", "Maa"]) })).toEqual(["Maa", "Papa"]);
    expect(addressees({ addressedTo: null })).toEqual([]);
  });
});
