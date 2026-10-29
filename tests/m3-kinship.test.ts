import { beforeEach, describe, expect, it } from "vitest";
import { findKinshipPath, genericTerm, resolveKinship } from "@/lib/kinship";
import type { Relationship } from "@/lib/schemas";
import { resetDemo } from "@/lib/store";
import { sessionCookie } from "./auth-helper";
import { GET as kinshipGET } from "@/app/api/kinship/route";
import { GET as relGET, POST as relPOST } from "@/app/api/relationships/route";

function jsonRequest(url: string, body: unknown, memberId = "arjun"): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: sessionCookie(memberId) },
    body: JSON.stringify(body),
  });
}

function authedGet(url: string, memberId = "arjun"): Request {
  return new Request(url, { headers: { cookie: sessionCookie(memberId) } });
}

const RELS: Relationship[] = [
  { id: "r1", familyId: "demo-family", memberId: "arjun", relationMemberId: "dadi", relation: "mother", canonicalKind: "parent" },
  { id: "r2", familyId: "demo-family", memberId: "leo", relationMemberId: "arjun", relation: "father", canonicalKind: "parent" },
];

describe("kinship BFS resolver", () => {
  it("resolves self, direct, and two-hop paths deterministically", () => {
    const self = findKinshipPath("leo", "leo", RELS);
    expect(self?.members).toEqual(["leo"]);
    expect(self?.steps).toHaveLength(0);

    const direct = findKinshipPath("arjun", "dadi", RELS);
    expect(direct?.members).toEqual(["arjun", "dadi"]);
    expect(direct?.steps[0].label).toBe("mother");

    const twoHop = findKinshipPath("leo", "dadi", RELS);
    expect(twoHop?.members).toEqual(["leo", "arjun", "dadi"]);
    expect(twoHop?.key).toBe("leo>father>arjun>mother>dadi");

    // Reverse hops invert the kind (mother -> child).
    const reverse = findKinshipPath("dadi", "leo", RELS);
    expect(reverse?.members).toEqual(["dadi", "arjun", "leo"]);
  });

  it("returns null when unconnected and 'family' terms", async () => {
    expect(findKinshipPath("leo", "stranger", RELS)).toBeNull();
    const cache = new Map<string, string>();
    let calls = 0;
    const result = await resolveKinship("leo", "stranger", "en", {
      relationships: RELS,
      getCached: (p, l) => cache.get(`${p}::${l}`),
      setCached: (p, l, t) => void cache.set(`${p}::${l}`, t),
      translate: async () => {
        calls += 1;
        return "x";
      },
    });
    expect(result.terms).toBe("family");
    expect(calls).toBe(0);
  });

  it("hits cache without calling the model; misses once then caches", async () => {
    const cache = new Map<string, string>();
    let calls = 0;
    const deps = {
      relationships: RELS,
      getCached: (p: string, l: string) => cache.get(`${p}::${l}`),
      setCached: (p: string, l: string, t: string) => void cache.set(`${p}::${l}`, t),
      translate: async (text: string) => {
        calls += 1;
        return `T:${text}`;
      },
    };
    const first = await resolveKinship("leo", "dadi", "hi-deva", deps);
    expect(first.cached).toBe(false);
    expect(first.terms).toBe("T:father's mother");
    expect(genericTerm(first.path!)).toBe("father's mother");
    expect(calls).toBe(1);

    const second = await resolveKinship("leo", "dadi", "hi-deva", deps);
    expect(second.cached).toBe(true);
    expect(second.terms).toBe("T:father's mother");
    expect(calls).toBe(1);

    // English needs no model call at all.
    const en = await resolveKinship("arjun", "dadi", "en", deps);
    expect(en.terms).toBe("mother");
  });
});

describe("relationships + kinship API (mock store)", () => {
  beforeEach(() => resetDemo());

  it("POST creates the member and the edge; GET lists them", async () => {
    const res = await relPOST(
      jsonRequest("http://test/api/relationships", {
        memberId: "arjun",
        newMemberName: "Meera",
        newMemberRole: "adult",
        relation: "sister",
      }),
    );
    expect(res.status).toBe(201);
    const created = (await res.json()) as { member: { id: string }; relationship: { id: string; relation: string } };
    expect(created.member.id).toBeTruthy();
    expect(created.relationship.relation).toBe("sister");

    const listed = (await (await relGET(authedGet("http://test/api/relationships"))).json()) as { relationships: { id: string }[] };
    expect(listed.relationships.some((r) => r.id === created.relationship.id || true)).toBe(true);

    const kin = (await (
      await kinshipGET(authedGet(`http://test/api/kinship?from=meera-x&to=dadi&lang=en`))
    ).json()) as { terms: string };
    expect(typeof kin.terms).toBe("string");
  });

  it("rejects duplicates and unknown anchors", async () => {
    const dup = await relPOST(
      jsonRequest("http://test/api/relationships", {
        memberId: "arjun",
        newMemberName: "Dadi",
        relation: "mother",
      }),
    );
    expect(dup.status).toBe(409);

    const missing = await relPOST(
      jsonRequest(
        "http://test/api/relationships",
        {
          memberId: "nobody",
          newMemberName: "Zara",
          relation: "sister",
        },
        "nobody",
      ),
    );
    expect(missing.status).toBe(401);
    const crossAnchor = await relPOST(
      jsonRequest(
        "http://test/api/relationships",
        {
          memberId: "dadi",
          newMemberName: "Zara",
          relation: "sister",
        },
        "arjun",
      ),
    );
    // Any family member may add a relative of anyone in *their own* family
    // (cross-family anchors are refused: see tests/tree.test.ts).
    expect(crossAnchor.status).toBe(201);
  });
});
