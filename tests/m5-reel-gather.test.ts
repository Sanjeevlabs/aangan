import { beforeEach, describe, expect, it } from "vitest";
import { buildReelSegments, reelTitle } from "@/lib/reel";
import { curatePlaylist } from "@/lib/llm";
import { DEMO_MEMBERS } from "@/lib/family";
import { MemberSchema, type Card, type RitualRun, type Wish } from "@/lib/schemas";
import { resetDemo } from "@/lib/store";
import { POST as gatherPOST } from "@/app/api/gather/route";
import { GET as invitesGET, POST as invitesPOST } from "@/app/api/invites/route";
import { DELETE as removeMemories } from "@/app/api/privacy/cards/route";
import { DELETE as leaveFamily } from "@/app/api/privacy/membership/route";
import { POST as wishesPOST } from "@/app/api/wishes/route";
import { addPlay, addWish, setReaction } from "@/lib/store";
import { authedGet, authedJson, sessionCookie } from "./auth-helper";

const members = DEMO_MEMBERS.map((m) => MemberSchema.parse(m));

function jsonRequest(url: string, body: unknown, method = "POST", memberId = "dadi"): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", cookie: sessionCookie(memberId) },
    body: JSON.stringify(body),
  });
}

const RUN: RitualRun = {
  id: "birthday:2026-11-09",
  familyId: "demo-family",
  ritualSlug: "birthday",
  occasionDate: "2026-11-09",
  status: "delivered",
  createdAt: "2026-11-09T00:00:00.000Z",
};

const WISHES: Wish[] = [
  { id: "w1", familyId: "demo-family", ritualRunId: RUN.id, cardId: "c1", memberId: "arjun", kind: "wish", createdAt: "2026-11-04T10:00:00.000Z" },
  { id: "w2", familyId: "demo-family", ritualRunId: RUN.id, cardId: null, memberId: "dadi", kind: "blessing", createdAt: "2026-11-03T10:00:00.000Z" },
];

const CARDS = [
  { id: "c1", familyId: "demo-family", type: "audio", caption: "Happy birthday Leo!", transcript: "", summary: "", lang: "en", takenAt: "2026-11-04T10:00:00.000Z", ritualSlug: null, source: "upload", mediaRef: null, peaks: [], palette: [], transcriptLang: "en", segments: [], authorId: "arjun", coverRef: null, addressedTo: null },
] as Card[];

describe("reel sequencing (pure)", () => {
  it("orders oldest-first and joins members + cards", () => {
    const segments = buildReelSegments(RUN, WISHES, CARDS, members);
    expect(segments).toHaveLength(2);
    // Oldest first: dadi's blessing (no card yet), then arjun's wish.
    expect(segments[0].member?.id).toBe("dadi");
    expect(segments[0].card).toBeNull();
    expect(segments[1].member?.id).toBe("arjun");
    expect(segments[1].card?.id).toBe("c1");
  });

  it("titles with the kinship term when known", () => {
    expect(reelTitle("Leo", "father's mother")).toBe("Happy birthday, father's mother");
    expect(reelTitle("Leo", null)).toBe("Happy birthday, Leo");
  });
});

describe("gather playlist (mock)", () => {
  beforeEach(() => resetDemo());

  it("curates from Lane audio only and never invents ids", async () => {
    const { tracks, cost } = await curatePlaylist([
      { id: "a", caption: "Lullaby" },
      { id: "b", caption: "Courtyard game" },
    ]);
    expect(cost).toBe(0);
    expect(tracks.length).toBeGreaterThan(0);
    expect(tracks.every((t) => t.cardId === "a" || t.cardId === "b")).toBe(true);
  });

  it("POST creates a session with a Lane-derived playlist", async () => {
    const res = await gatherPOST(
      jsonRequest("http://test/api/gather", {
        title: "Family evening",
        startsAt: "2026-11-09T19:00:00.000Z",
        invites: ["dadi", "leo"],
      }),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as { session: { invites: string[] }; playlist: unknown[] };
    expect(data.session.invites).toEqual(["dadi", "leo"]);
    expect(Array.isArray(data.playlist)).toBe(true);
  });
});

describe("privacy set + invites (mock store)", () => {
  beforeEach(() => resetDemo());

  it("remove-my-memories deletes traces but keeps the member", async () => {
    addWish({ id: "x", familyId: "demo-family", ritualRunId: null, cardId: null, memberId: "leo", kind: "wish", createdAt: new Date().toISOString() });
    setReaction({ id: "y", familyId: "demo-family", cardId: "c", memberId: "leo", kind: "love", createdAt: new Date().toISOString() });
    addPlay({ id: "z", familyId: "demo-family", cardId: "c", memberId: "leo", playedAt: new Date().toISOString() });

    const res = await removeMemories(jsonRequest("http://test/privacy", { memberId: "leo" }, "DELETE", "leo"));
    expect(res.status).toBe(200);
    const { deleted } = (await res.json()) as { deleted: Record<string, number> };
    expect(deleted.wishes).toBe(1);
    expect(deleted.reactions).toBe(1);

    // Unknown members 404.
    const missing = await removeMemories(jsonRequest("http://test/privacy", { memberId: "nobody" }, "DELETE", "nobody"));
    expect(missing.status).toBe(404);
  });

  it("leave-family removes the member, and invites expire in 7 days", async () => {
    const left = await leaveFamily(jsonRequest("http://test/privacy", { memberId: "aria" }, "DELETE", "aria"));
    expect(left.status).toBe(200);

    const again = await leaveFamily(jsonRequest("http://test/privacy", { memberId: "aria" }, "DELETE", "aria"));
    expect(again.status).toBe(404);

    const invite = (await (await invitesPOST(authedJson("http://test/api/invites", {}))).json()) as {
      invite: { code: string; expiresAt: string };
    };
    expect(invite.invite.code).toMatch(/^[A-Z2-9]{6}$/);
    const ms = new Date(invite.invite.expiresAt).getTime() - Date.now();
    expect(ms).toBeGreaterThan(6 * 86400000);
    expect(ms).toBeLessThanOrEqual(7 * 86400000 + 60000);

    const listed = (await (await invitesGET(authedGet("http://test/api/invites"))).json()) as { invites: { code: string }[] };
    expect(listed.invites.some((i) => i.code === invite.invite.code)).toBe(true);
  });

  it("wishes link voice cards to a run (reel replies)", async () => {
    const res = await wishesPOST(
      jsonRequest("http://test/api/wishes", { ritualRunId: RUN.id, cardId: "c1", memberId: "leo", kind: "wish" }, "POST", "leo"),
    );
    expect(res.status).toBe(201);
  });
});
